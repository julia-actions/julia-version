import * as core from "@actions/core"
import fetch from "node-fetch"
import retry from "async-retry"
import * as semver from "semver"

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

type JuliaVersionInfo = {
    [key: string]: {
        files: Array<Download>
        stable: boolean
    }
}

/**
 * Fetch and parse the Julia versions.json file.
 *
 * @returns The content of the downloaded versions.json file as object.
 */
export async function getJuliaVersionInfo(): Promise<JuliaVersionInfo> {
  // Occasionally the connection is reset for unknown reasons
  // In those cases, retry the download
  const versionsFile = await retry(
    async (bail: Function) => {
      const response = await fetch(VERSIONS_JSON_URL)
      return response.text()
    }, {
      retries: 5,
      onRetry: (err: Error) => {
        core.info(`Download of versions.json failed, trying again. Error: ${err}`)
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
 * @param availableReleases: An array of available Julia versions.
 * @param includePrereleases: Allow prereleases to be used when determining
 * the version number.
 * @param juliaCompatRange: The semver range to further restrict the results (TODO: We could probably roll this into versionSpecifier)
 * @returns The full semver version number
 * @throws Error if the version specifier doesn't overlap with any available
 * Julia releases.
 */
export function resolveJuliaVersion(versionSpecifier: string, availableReleases: string[], includePrerelease: boolean = false, juliaCompatRange: string = ""): string {
    // Note: `juliaCompatRange` is ignored unless `versionSpecifier` is `min`
    let version: string | null

    if (semver.valid(versionSpecifier) == versionSpecifier) {
        // versionSpecifier is already a valid semver version (not a semver range)
        version = versionSpecifier
    } else if (versionSpecifier === "min") {
        // Resolve "min" to the minimum supported Julia version compatible with the project file
        if (!juliaCompatRange) {
            throw new Error('Unable to use version "min" when the Julia project file does not specify a compat for Julia')
        }
        version = semver.minSatisfying(availableReleases, juliaCompatRange, {includePrerelease})
    } else if (versionSpecifier === "lts") {
        version = semver.maxSatisfying(availableReleases, LTS_VERSION, { includePrerelease: false });
    } else if (versionSpecifier === "pre") {
        version = semver.maxSatisfying(availableReleases, "*", { includePrerelease: true });
    } else {
        // Use the highest available version that match the versionSpecifier
        version = semver.maxSatisfying(availableReleases, versionSpecifier, {includePrerelease})
    }

    if (!version) {
        throw new Error(`Could not find a Julia version that matches ${versionSpecifier}`)
    }

    return version
}

/**
 * Generates a list of nightly downloads. Verifies the generated URLs exist
 * and avoids returning any entries which do not exist.
 *
 * @param majorMinorVersion: The partial nightly version number
 * @returns A list of downloads which exist.
 */
export async function genNightlies(majorMinorVersion: string = ""): Promise<Array<Download>> {
    const baseUrl = "https://julialangnightlies-s3.julialang.org/bin"
    const nightlies = [
        {platform: "winnt", arch: "x64", suffix: "win64", ext: "tar.gz"},
        // {platform: "winnt", arch: "x64", suffix: "win64", ext: "zip"},
        {platform: "winnt", arch: "x64", suffix: "win64", ext: "exe"},
        {platform: "winnt", arch: "x86", suffix: "win32", ext: "tar.gz"},
        // {platform: "winnt", arch: "x86", suffix: "win32", ext: "zip"},
        {platform: "winnt", arch: "x86", suffix: "win32", ext: "exe"},
        {platform: "macos", arch: "aarch64", ext: "tar.gz"},
        {platform: "macos", arch: "aarch64", ext: "dmg"},
        {platform: "macos", arch: "x86_64", ext: "tar.gz"},
        {platform: "macos", arch: "x86_64", ext: "dmg"},
        {platform: "linux", arch: "x86_64", ext: "tar.gz"},
        {platform: "linux", arch: "aarch64", ext: "tar.gz"},
        {platform: "linux", arch: "i686", ext: "tar.gz"},
        {platform: "freebsd", arch: "x86_64", ext: "tar.gz"},
    ]
    const majorMinorDir = majorMinorVersion ? majorMinorVersion + "/" : ""

    let downloads = []
    for (var nightly of nightlies) {
        let kind = "unknown"
        if (nightly.ext === "exe") {
            kind = "installer"
        } else if (nightly.ext === "tar.gz" || nightly.ext === "zip" || nightly.ext === "dmg") {
            kind = "archive"
        }

        const suffix = nightly.suffix ?? `${nightly.platform}-${nightly.arch}`
        const url = `${baseUrl}/${nightly.platform}/${nightly.arch}/${majorMinorDir}julia-latest-${suffix}.${nightly.ext}`

        // Perform a HEAD request to validate the specified nightly exists.
        // TODO: Verify the performance of these requests in CI.
        const response = await fetch(url, {method: "HEAD"})
        if (response.status == 200) {
            const size = parseInt(response.headers.get("content-length") ?? "0")

            // TODO: Ideally we would return a proper semver version but this information appears to be unavailable
            // from metadata alone.
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
            console.error(`HTTP HEAD request to ${url} failed with response: ${response.status} ${response.statusText}`)
            const errorBody = await response.text();
            console.error(`${errorBody}`)
        }
    }

    return downloads
}
