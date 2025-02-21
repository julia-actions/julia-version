import * as core from "@actions/core"
import * as fs from "node:fs"
import * as toml from "toml"

import { getJuliaProjectFile, getJuliaCompatRange } from "./project.js"
import {
  getJuliaVersionInfo,
  resolveJuliaVersion,
  genNightlies,
  Download
} from "./version.js"

/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const versionSpecifier = core.getInput("version", {
      required: true
    })
    const includePrereleases = core.getBooleanInput("include-all-prereleases", {
      required: false
    })
    const juliaProject =
      core.getInput("project", { required: false }) ||
      process.env.JULIA_PROJECT ||
      "."

    // Debug logs are only output if the `ACTIONS_STEP_DEBUG` secret is true
    const inputs = JSON.stringify(
      {
        versionSpecifier,
        includePrereleases,
        juliaProject
      },
      null,
      4
    )
    core.debug(`User inputs: ${inputs}`)

    // Determine the Julia compat ranges as specified by the Project.toml only for special versions that require them.
    let juliaCompatRange: string = ""
    if (versionSpecifier === "min") {
      const juliaProjectFile = getJuliaProjectFile(juliaProject)
      const juliaProjectToml = toml.parse(
        fs.readFileSync(juliaProjectFile).toString()
      )
      juliaCompatRange = getJuliaCompatRange(juliaProjectToml)
      core.debug(`Julia project compatibility range: ${juliaCompatRange}`)
    }

    let version: string
    let downloads: Array<Download>

    // Nightlies are not included in the versions.json file
    const nightlyMatch = /^(?:(\d+\.\d+)-)?nightly$/.exec(versionSpecifier)
    if (nightlyMatch) {
      downloads = await genNightlies(nightlyMatch[1])
      version = downloads.length ? versionSpecifier : ""
    } else {
      const versionInfo = await getJuliaVersionInfo()
      const availableReleases = Object.keys(versionInfo)
      version = resolveJuliaVersion(
        versionSpecifier,
        availableReleases,
        includePrereleases,
        juliaCompatRange
      )
      downloads = versionInfo[version].files
    }

    core.debug(`Selected Julia version: ${version}`)
    core.setOutput("version", version)
    // core.setOutput("downloads-json", JSON.stringify(downloads, null, 4))
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
