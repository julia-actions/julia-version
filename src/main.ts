import * as core from "@actions/core"
import { parseVersionSpecifiers } from "./input.js"
import { resolveVersionSpecifiers } from "./version.js"

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

    const resolvedVersions = await resolveVersionSpecifiers(
      versionSpecifiers,
      juliaProject
    )

    core.setOutput("versions", JSON.stringify(resolvedVersions))

    // Display output in CI logs to assist with debugging.
    if (process.env.CI) {
      core.info(`version=${JSON.stringify(resolvedVersions)}`)
    }

    // core.setOutput("downloads-json", JSON.stringify(downloads, null, 4))
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
