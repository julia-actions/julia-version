import * as core from "@actions/core"
import * as fs from "fs"
import * as toml from "toml"

import {getJuliaProjectFile, getJuliaCompatRange} from "./project.js"
import {getJuliaVersionInfo, resolveJuliaVersion, genNightlies} from "./version.js"

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
