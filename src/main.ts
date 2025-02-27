import * as core from "@actions/core"
import { parseVersionSpecifiers } from "./input.js"
import { resolveVersions, uniqueArray, versionSort } from "./version.js"

/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const versionSpecifiers = parseVersionSpecifiers(
      core.getInput("versions", {
        required: true,
      })
    )
    const juliaProject =
      core.getInput("project", { required: false }) ||
      process.env.JULIA_PROJECT ||
      "."
    const ifMissing = core.getInput("if-missing", { required: false })

    // Debug logs are only output if the `ACTIONS_STEP_DEBUG` secret is true
    core.debug(`versionSpecifiers=${JSON.stringify(versionSpecifiers)}`)

    const resolvedVersions = await resolveVersions(
      versionSpecifiers,
      juliaProject,
      { ifMissing }
    )

    const uniqueVersions = versionSort(
      uniqueArray(resolvedVersions.filter<string>((value) => value !== null))
    )

    setOutput("unique-json", JSON.stringify(uniqueVersions))
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}

function setOutput(key: string, value: string): void {
  core.setOutput(key, value)

  // Display output in CI logs to assist with debugging.
  if (process.env.CI) {
    core.info(`${key}=${value}`)
  }
}
