import * as core from "@actions/core"
import * as fs from "node:fs"
import fetch from "node-fetch"
import retry from "async-retry"
import * as semver from "semver"
import * as toml from "toml"

import { IfMissing } from "./input.js"
import {
  getJuliaProjectFile,
  getJuliaManifestFile,
  getJuliaCompatRange,
} from "./project.js"

export const VERSIONS_JSON_URL =
  "https://julialang-s3.julialang.org/bin/versions.json"

// TODO: Add marker to versions.json to indicate LTS?
const LTS_VERSION = "1.10"

export const NIGHTLY_BASE_URL =
  "https://julialangnightlies-s3.julialang.org/bin"
const NIGHTLY_PLATFORMS = [
  { platform: "winnt", arch: "x64", suffix: "win64", ext: "tar.gz" },
  // {platform: "winnt", arch: "x64", suffix: "win64", ext: "zip"},
  { platform: "winnt", arch: "x64", suffix: "win64", ext: "exe" },
  { platform: "winnt", arch: "x86", suffix: "win32", ext: "tar.gz" },
  // {platform: "winnt", arch: "x86", suffix: "win32", ext: "zip"},
  { platform: "winnt", arch: "x86", suffix: "win32", ext: "exe" },
  { platform: "macos", arch: "aarch64", ext: "tar.gz" },
  { platform: "macos", arch: "aarch64", ext: "dmg" },
  { platform: "macos", arch: "x86_64", ext: "tar.gz" },
  { platform: "macos", arch: "x86_64", ext: "dmg" },
  { platform: "linux", arch: "x86_64", ext: "tar.gz" },
  { platform: "linux", arch: "aarch64", ext: "tar.gz" },
  { platform: "linux", arch: "i686", ext: "tar.gz" },
  { platform: "freebsd", arch: "x86_64", ext: "tar.gz" },
]
const DEFAULT_NIGHTLY_PLATFORM = {
  platform: "linux",
  arch: "x86_64",
  ext: "tar.gz",
}

type Download = {
  url: string
  triplet?: string
  kind: string
  arch: string
  asc?: string
  sha256?: string
  size: number
  version: string
  os: string
  extension: string
}

type JuliaVersionsJson = {
  [key: string]: {
    files: Array<Download>
    stable: boolean
  }
}

type NightlyPlatform = {
  platform: string
  arch: string
  suffix?: string
  ext: string
}

/**
 * Determine a specific Julia version for each version specifier.
 *
 * @param versionSpecifiers: A list of version specifiers. See the README for
 * details on the syntax.
 * @param project: The Julia project directory or file to use when determining
 * Julia compatibility with a project.
 * @param options: The `ifMissing` option controls the behavior of this
 * function when a version specifier cannot be resolved.
 * @returns A list of resolved versions
 * @throws Error if a version specifier doesn't resolve to any available
 * Julia release
 */
export async function resolveVersions(
  versionSpecifiers: Array<string>,
  project: string = ".",
  options?: { ifMissing: IfMissing }
): Promise<Array<string | null>> {
  // Determine the Julia compat ranges as specified by the Project.toml only
  // for aliases that require them.
  let juliaCompatRange: string = ""
  if (versionSpecifiers.includes("min")) {
    const juliaProjectFile = getJuliaProjectFile(project)
    const juliaProjectToml = toml.parse(
      fs.readFileSync(juliaProjectFile).toString()
    )

    // Extract the compat range for the "julia" entry and convert it to the
    // node semver range syntax.
    juliaCompatRange = getJuliaCompatRange(juliaProjectToml)
    core.debug(`Julia project compatibility range: ${juliaCompatRange}`)
  }

  let manifestJuliaVersion: string | null = null
  if (versionSpecifiers.includes("manifest")) {
    const juliaManifestFile = getJuliaManifestFile(project)
    const juliaManifestToml = toml.parse(
      fs.readFileSync(juliaManifestFile).toString()
    )

    manifestJuliaVersion = juliaManifestToml.julia_version
    core.debug(`Julia manifest version: ${manifestJuliaVersion}`)
  }

  const availableVersions = Object.keys(await fetchJuliaVersionsJson())

  const resolvedVersions = new Array<string | null>()
  for (const versionSpecifier of versionSpecifiers) {
    let resolvedVersion: string | null

    // Nightlies are not included in the versions.json file
    const nightlyMatch = /^(?:(\d+\.\d+)-)?nightly$/.exec(versionSpecifier)
    if (nightlyMatch && nightlyMatch[1]) {
      const url = getNightlyUrl(DEFAULT_NIGHTLY_PLATFORM, nightlyMatch[1])
      resolvedVersion = (await urlExists(url)) ? versionSpecifier : null
    } else if (nightlyMatch) {
      // Skip URL check for "nightly" as it should always be available
      resolvedVersion = versionSpecifier
    } else {
      resolvedVersion = resolveVersion(
        versionSpecifier,
        availableVersions,
        juliaCompatRange,
        manifestJuliaVersion
      )
    }

    core.debug(`${versionSpecifier} -> ${resolvedVersion}`)

    if (resolvedVersion) {
      resolvedVersions.push(resolvedVersion)
    } else if (options?.ifMissing === "warn") {
      core.warning(
        `No Julia version exists matching specifier: "${versionSpecifier}"`
      )
    } else {
      throw new Error(
        `No Julia version exists matching specifier: "${versionSpecifier}"`
      )
    }
  }

  return resolvedVersions
}

/**
 * Fetch and parse the Julia versions.json file.
 *
 * @returns The content of the downloaded versions.json file as object.
 */
export async function fetchJuliaVersionsJson(): Promise<JuliaVersionsJson> {
  // Occasionally the connection is reset for unknown reasons
  // In those cases, retry the download
  const versionsFile = await retry(
    async () => {
      const response = await fetch(VERSIONS_JSON_URL)
      return response.text()
    },
    {
      retries: 5,
      onRetry: (err: Error) => {
        core.info(
          `Download of versions.json failed, trying again. Error: ${err}`
        )
      },
    }
  )

  if (!versionsFile) {
    throw new Error(`Unable to download versions.json after 5 attempts`)
  }

  return JSON.parse(versionsFile)
}

/**
 * Determine the latest Julia release associated with the version range
 * (e.g. "1", "^1.2.3", "~1.2.3"). Additionally, supports the version aliases:
 *
 * - `lts`: The latest released long-term stable (LTS) version of Julia.
 * - `min`: The earliest version of Julia within the `juliaCompatRange`.
 *
 * @param versionRange: The node version range or alias.
 * @param availableVersions: An array of available Julia versions.
 * @param includePrereleases: Allow prereleases to be used when determining
 * the version number.
 * @param juliaCompatRange: The Node semver range to further restrict the results.
 * @param manifestJuliaVersion: The Julia version specified in the Julia manifest.
 * @returns The full semver version number
 * @throws Error if the version specifier doesn't overlap with any available
 * Julia releases.
 */
export function resolveVersion(
  versionRange: string,
  availableVersions: string[],
  juliaCompatRange: string | null = null,
  manifestJuliaVersion: string | null = null
): string | null {
  if (
    semver.valid(versionRange) == versionRange &&
    availableVersions.includes(versionRange)
  ) {
    // versionRange is already a valid semver version (not a semver range)
    return versionRange
  } else if (versionRange === "min") {
    // Resolve "min" to the minimum supported Julia version compatible with the
    // project file
    if (!juliaCompatRange) {
      throw new Error(
        'Unable to use version "min" when the Julia project file does not specify a compat for Julia'
      )
    }
    return semver.minSatisfying(availableVersions, juliaCompatRange)
  } else if (versionRange === "lts") {
    return semver.maxSatisfying(availableVersions, LTS_VERSION)
  } else if (versionRange === "manifest") {
    return manifestJuliaVersion
  } else {
    // Use the highest available version that match the version range
    return semver.maxSatisfying(availableVersions, versionRange)
  }
}

export function getNightlyUrl(
  nightly: NightlyPlatform,
  majorMinorVersion: string | null = null
): string {
  const majorMinorDir = majorMinorVersion ? majorMinorVersion + "/" : ""
  const suffix = nightly.suffix ?? `${nightly.platform}-${nightly.arch}`
  const url = `${NIGHTLY_BASE_URL}/${nightly.platform}/${nightly.arch}/${majorMinorDir}julia-latest-${suffix}.${nightly.ext}`
  return url
}

async function urlExists(url: string): Promise<boolean> {
  // Perform a HEAD request to validate the HTTP server contains the specified file exists.
  const response = await fetch(url, { method: "HEAD" })
  if (response.ok) {
    return true
  } else if (response.status != 404) {
    core.error(
      `HTTP HEAD request to ${url} failed with response: ${response.status} ${response.statusText}`
    )
    const errorBody = await response.text()
    core.error(`${errorBody}`)
  }

  return false
}

/**
 * Generates a list of nightly downloads. Verifies the generated URLs exist
 * and avoids returning any entries which do not exist.
 *
 * @param majorMinorVersion: The partial nightly version number
 * @returns A list of downloads which exist.
 */
export async function genNightlies(
  majorMinorVersion: string | null = null
): Promise<Array<Download>> {
  const downloads = []
  for (const nightly of NIGHTLY_PLATFORMS) {
    let kind = "unknown"
    if (nightly.ext === "exe") {
      kind = "installer"
    } else if (
      nightly.ext === "tar.gz" ||
      nightly.ext === "zip" ||
      nightly.ext === "dmg"
    ) {
      kind = "archive"
    }

    const url = getNightlyUrl(nightly, majorMinorVersion)

    // Perform a HEAD request to validate the specified nightly exists.
    const response = await fetch(url, { method: "HEAD" })
    if (response.status == 200) {
      const size = parseInt(response.headers.get("content-length") ?? "0")

      // TODO: Ideally we would return a proper semver version but this
      // information appears to be unavailable from metadata alone.
      downloads.push({
        url,
        // triplet, // Avoiding including as we cannot determine the ABI from current metadata
        kind,
        arch: nightly.arch,
        // sha256, // Avoiding including as we cannot determine this from the HEAD request
        size,
        version: majorMinorVersion ? majorMinorVersion : "nightly",
        os: nightly.platform,
        extension: nightly.ext,
      })
    } else if (response.status != 404) {
      core.error(
        `HTTP HEAD request to ${url} failed with response: ${response.status} ${response.statusText}`
      )
      const errorBody = await response.text()
      core.error(`${errorBody}`)
    }
  }

  return downloads
}

/**
 * Sort a list of SemVer compatible version strings.
 *
 * @param versions: A list of version strings.
 * @returns The sorted list of versions.
 */
export function versionSort(versions: Array<string>): Array<string> {
  // Based upon: https://stackoverflow.com/a/40201629
  return versions.sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  )
}

/**
 * Create a unique list
 *
 * @param array: An array
 * @returns An array with unique elements in no particular order
 */
export function uniqueArray<T>(array: Array<T>): Array<T> {
  return array.filter((value, index, arr) => arr.indexOf(value) === index)
}
