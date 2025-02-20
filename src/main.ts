import * as core from "@actions/core"
import * as tc from "@actions/tool-cache"

import * as fs from "fs"
import * as path from "path"
import retry from "async-retry"
import * as semver from 'semver'
import * as toml from 'toml'
import fetch from "node-fetch"

import { wait } from "./wait.js"

// TODO: Add marker to versions.json to indicate LTS?
const LTS_VERSION = "1.10"


/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    // Intentionally striping leading and trailing whitespace
    const versionSpecifier: string = core.getInput("version", { required: true }).trim()
    const includePrereleases: boolean = core.getBooleanInput("include-all-prereleases", { required: false })
    const juliaProject: string = core.getInput("project", { required: false }) ||
      process.env.JULIA_PROJECT ||
      "."

    // Debug logs are only output if the `ACTIONS_STEP_DEBUG` secret is true
    core.debug(`User inputs: ${JSON.stringify({versionSpecifier, includePrereleases, juliaProject}, null, 4)}`)

    // Determine the Julia compat ranges as specified by the Project.toml only for special versions that require them.
    let juliaCompatRange: string = "";
    if (versionSpecifier === "min") {
        const juliaProjectFile = getJuliaProjectFile(juliaProject)
        const juliaProjectToml = toml.parse(fs.readFileSync(juliaProjectFile).toString())
        juliaCompatRange = getJuliaCompatRange(juliaProjectToml)
        core.debug(`Julia project compatibility range: ${juliaCompatRange}`)
    }

    let version
    let versionDownloads

    const nightlyMatch = /^(?:(\d+\.\d+)-)?nightly$/.exec(versionSpecifier)
    if (nightlyMatch) {
        versionDownloads = await genNightlies(nightlyMatch[1])
        version = versionDownloads.length ? versionSpecifier : ""
    } else {
        const versionInfo = await getJuliaVersionInfo()
        const availableReleases = Object.keys(versionInfo)
        version = resolveJuliaVersion(versionSpecifier, availableReleases, includePrereleases, juliaCompatRange)
        versionDownloads = versionInfo[version].files
    }

    core.debug(`Selected Julia version: ${version}`)
    core.setOutput("version", version)
    core.setOutput("downloads", JSON.stringify(versionDownloads, null, 4))
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}

/**
 * @returns The content of the downloaded versions.json file as object.
 */
async function getJuliaVersionInfo(): Promise<object> {
    // Occasionally the connection is reset for unknown reasons
    // In those cases, retry the download
    const versionsFile = await retry(async (bail: Function) => {
        return await tc.downloadTool("https://julialang-s3.julialang.org/bin/versions.json")
    }, {
        retries: 5,
        onRetry: (err: Error) => {
            core.info(`Download of versions.json failed, trying again. Error: ${err}`)
        }
    })

    return JSON.parse(fs.readFileSync(versionsFile).toString())
}

function resolveJuliaVersion(versionSpecifier: string, availableReleases: string[], includePrerelease: boolean = false, juliaCompatRange: string = ""): string {
    // Note: `juliaCompatRange` is ignored unless `versionSpecifier` is `min`
    let version: string | null

    if (semver.valid(versionSpecifier) == versionSpecifier || versionSpecifier.endsWith('nightly')) {
        // versionSpecifier is already a valid version or "nightly", use it directly
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
 * Determine the path to an existing Julia project file from a directory or filename.
 *
 * @returns The path to the Julia project file
 */
function getJuliaProjectFile(juliaProject: string): string {
    let juliaProjectFile: string = ""

    if (fs.existsSync(juliaProject) && fs.lstatSync(juliaProject).isFile()) {
        juliaProjectFile = juliaProject
    } else {
        for (let filename of ["JuliaProject.toml", "Project.toml"]) {
            let p = path.join(juliaProject, filename)
            if (fs.existsSync(p) && fs.lstatSync(p).isFile()) {
                juliaProjectFile = p
                break
            }
        }
    }

    if (!juliaProjectFile) {
        throw new Error(`Unable to locate project file with project input: ${juliaProject}`)
    }

    return juliaProjectFile
}

/**
 * @returns An array of version ranges compatible with the Julia project
 */
function getJuliaCompatRange(project: { compat: { julia: string | undefined } }): string {
    let compatRange: string | null

    if (project.compat?.julia !== undefined) {
        compatRange = validJuliaCompatRange(project.compat.julia)
    } else {
        compatRange = "*"
    }

    if (!compatRange) {
        throw new Error(`Invalid version range found in Julia compat: ${compatRange}`)
    }

    return compatRange
}

/**
 * Convert a Julia compat range into a NPM semver range.
 *
 * @returns An NPM semver range string or null if the input is invalid.
 */
function validJuliaCompatRange(compatRange: string): string | null {
    let ranges: Array<string> = []
    for(let range of compatRange.split(",")) {
        range = range.trim()

        // An empty range isn't supported by Julia
        if (!range) {
            return null
        }

        // NPM's semver doesn't understand unicode characters such as `≥` so we'll convert to alternatives
        range = range.replace("≥", ">=").replace("≤", "<=")

        // Cleanup whitespace. Julia only allows whitespace between the specifier and version with certain specifiers
        range = range.replace(/\s+/g, " ").replace(/(?<=(>|>=|≥|<)) (?=\d)/g, "")

        if (!semver.validRange(range) || range.split(/(?<! -) (?!- )/).length > 1 || range.startsWith("<=") || range === "*") {
            return null
        } else if (range.search(/^\d/) === 0 && !range.includes(" ")) {
            // Compat version is just a basic version number (e.g. 1.2.3). Since Julia's Pkg.jl's uses caret
            // as the default specifier (e.g. `1.2.3 == ^1.2.3`) and NPM's semver uses tilde as the default
            // specifier (e.g. `1.2.3 == 1.2.x == ~1.2.3`) we will introduce the caret specifier to ensure the
            // orignal intent is respected.
            // https://pkgdocs.julialang.org/v1/compatibility/#Version-specifier-format
            // https://github.com/npm/node-semver#x-ranges-12x-1x-12-
            range = "^" + range
        }

        ranges.push(range)
    }

    return semver.validRange(ranges.join(" || "))
}

async function genNightlies(majorMinorVersion: string = "") {
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
