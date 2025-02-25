import * as core from "@actions/core"
import * as fs from "node:fs"
import * as toml from "toml"

import { parseVersionSpecifiers } from "./input.js"
import { getJuliaProjectFile, getJuliaCompatRange } from "./project.js"
import { getJuliaVersionInfo, resolveJuliaVersion } from "./version.js"

/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const versionSpecifiers = parseVersionSpecifiers(
      core.getInput("version", {
        required: true
      })
    )
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
        versionSpecifiers,
        includePrereleases,
        juliaProject
      },
      null,
      4
    )
    core.debug(`User inputs: ${inputs}`)

    // Determine the Julia compat ranges as specified by the Project.toml only for special versions that require them.
    let juliaCompatRange: string = ""
    if (versionSpecifiers.includes("min")) {
      const juliaProjectFile = getJuliaProjectFile(juliaProject)
      const juliaProjectToml = toml.parse(
        fs.readFileSync(juliaProjectFile).toString()
      )
      juliaCompatRange = getJuliaCompatRange(juliaProjectToml)
      core.debug(`Julia project compatibility range: ${juliaCompatRange}`)
    }

    const availableVersions = Object.keys(await getJuliaVersionInfo())

    // const resolvedVersions = new Set<string>([])
    const resolvedVersions = new Array<string>()
    for (const versionSpecifier of versionSpecifiers) {
      let resolvedVersion: string | null

      // Nightlies are not included in the versions.json file
      const nightlyMatch = /^(?:(\d+\.\d+)-)?nightly$/.exec(versionSpecifier)
      if (nightlyMatch) {
        resolvedVersion = nightlyMatch[1]
      } else {
        resolvedVersion = resolveJuliaVersion(
          versionSpecifier,
          availableVersions,
          includePrereleases,
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

    core.setOutput("versions", JSON.stringify(resolvedVersions.sort()))

    // Display output in CI logs to assist with debugging.
    if (process.env.CI) {
      core.info(`version=${JSON.stringify(resolvedVersions.sort())}`)
    }

    // core.setOutput("downloads-json", JSON.stringify(downloads, null, 4))
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
