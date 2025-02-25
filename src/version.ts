import * as core from "@actions/core"
import * as fs from "node:fs"
import fetch from "node-fetch"
import retry from "async-retry"
import * as semver from "semver"
import * as toml from "toml"

import { getJuliaProjectFile, getJuliaCompatRange } from "./project.js"

const VERSIONS_JSON_URL = "https://julialang-s3.julialang.org/bin/versions.json"

// TODO: Add marker to versions.json to indicate LTS?
const LTS_VERSION = "1.10"

export type Download = {
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

const NIGHTLY_BASE_URL = "https://julialangnightlies-s3.julialang.org/bin"
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
  { platform: "freebsd", arch: "x86_64", ext: "tar.gz" }
]
const DEFAULT_NIGHTLY_PLATFORM = {
  platform: "linux",
  arch: "x86_64",
  ext: "tar.gz"
}

// https://stackoverflow.com/questions/40201533/sort-version-dotted-number-strings-in-javascript
function versionSort(versions: Array<string>): Array<string> {
  return versions.sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  )
}
// var arr = ['5.5.1', '4.21.0', '4.22.0', '6.1.0', '5.1.0', '4.5.0'];

export async function resolveVersionSpecifiers(
  versionSpecifiers: Array<string>,
  project: string
): Promise<Array<string>> {
  // Determine the Julia compat ranges as specified by the Project.toml only for aliases that require them.
  let juliaCompatRange: string = ""
  if (versionSpecifiers.includes("min")) {
    const juliaProjectFile = getJuliaProjectFile(project)
    const juliaProjectToml = toml.parse(
      fs.readFileSync(juliaProjectFile).toString()
    )
    juliaCompatRange = getJuliaCompatRange(juliaProjectToml)
    core.debug(`Julia project compatibility range: ${juliaCompatRange}`)
  }

  const availableVersions = Object.keys(await fetchJuliaVersionsJson())

  // const resolvedVersions = new Set<string>([])
  const resolvedVersions = new Array<string>()
  for (const versionSpecifier of versionSpecifiers) {
    let resolvedVersion: string | null

    // Nightlies are not included in the versions.json file
    const nightlyMatch = /^(?:(\d+\.\d+)-)?nightly$/.exec(versionSpecifier)
    if (nightlyMatch) {
      const url = getNightlyUrl(DEFAULT_NIGHTLY_PLATFORM, nightlyMatch[1])
      resolvedVersion = (await urlExists(url)) ? versionSpecifier : null
    } else {
      resolvedVersion = resolveVersionSpecifier(
        versionSpecifier,
        availableVersions,
        juliaCompatRange
      )
    }

    core.debug(`${versionSpecifier} -> ${resolvedVersion}`)

    if (
      resolvedVersion !== null &&
      !resolvedVersions.includes(resolvedVersion)
    ) {
      resolvedVersions.push(resolvedVersion)
    }
  }

  return versionSort(resolvedVersions)
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
      }
    }
  )

  if (!versionsFile) {
    throw new Error(`Unable to download versions.json after 5 attempts`)
  }

  return JSON.parse(versionsFile)
}

/**
 * Determine the latest Julia release associated with the version specifier
 * (e.g. "1", "^1.2.3", "~1.2.3"). Additionally, supports the version aliases:
 *
 * - `lts`: The latest released long-term stable (LTS) version of Julia.
 * - `pre`: The latest prerelease (or release) of Julia.
 * - `min`: The earliest version of Julia within the `juliaCompatRange`.
 *
 * @param versionSpecifier: The version number specifier or alias.
 * @param availableVersions: An array of available Julia versions.
 * @param includePrereleases: Allow prereleases to be used when determining
 * the version number.
 * @param juliaCompatRange: The semver range to further restrict the results
 * @returns The full semver version number
 * @throws Error if the version specifier doesn't overlap with any available
 * Julia releases.
 */
export function resolveVersionSpecifier(
  versionSpecifier: string,
  availableVersions: string[],
  juliaCompatRange: string = ""
): string | null {
  // Note: `juliaCompatRange` is ignored unless `versionSpecifier` is `min`
  let version: string | null

  if (
    semver.valid(versionSpecifier) == versionSpecifier &&
    availableVersions.includes(versionSpecifier)
  ) {
    // versionSpecifier is already a valid semver version (not a semver range)
    version = versionSpecifier
  } else if (versionSpecifier === "min") {
    // Resolve "min" to the minimum supported Julia version compatible with the
    // project file
    if (!juliaCompatRange) {
      throw new Error(
        'Unable to use version "min" when the Julia project file does not specify a compat for Julia'
      )
    }
    version = semver.minSatisfying(availableVersions, juliaCompatRange)
  } else if (versionSpecifier === "lts") {
    version = semver.maxSatisfying(availableVersions, LTS_VERSION)
  } else {
    // versionSpecifier

    // Use trailing - to indicate pre-release? Not compatable with NPM semver ranges
    // or Julia Pkg.API.VersionRange

    // Use the highest available version that match the versionSpecifier
    version = semver.maxSatisfying(availableVersions, versionSpecifier)

    // TODO: Probably makes sense to throw this when the user provides a specifier which is out of bounds
    if (!version) {
      throw new Error(
        `No Julia version exists matching specifier: "${versionSpecifier}"`
      )
    }
  }

  return version
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
  // TODO: Verify the performance of these requests in CI.
  const response = await fetch(url, { method: "HEAD" })
  if (response.ok) {
    return true
  } else if (response.status != 404) {
    console.error(
      `HTTP HEAD request to ${url} failed with response: ${response.status} ${response.statusText}`
    )
    const errorBody = await response.text()
    console.error(`${errorBody}`)
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
    // TODO: Verify the performance of these requests in CI.
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
        extension: nightly.ext
      })
    } else if (response.status != 404) {
      console.error(
        `HTTP HEAD request to ${url} failed with response: ${response.status} ${response.statusText}`
      )
      const errorBody = await response.text()
      console.error(`${errorBody}`)
    }
  }

  return downloads
}
