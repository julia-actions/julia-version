/**
 * Unit tests for the action's main functionality, src/main.ts
 *
 * To mock dependencies in ESM, you can create fixtures that export mock
 * functions and objects. For example, the core module is mocked in this test,
 * so that the actual '@actions/core' module is not imported.
 */
import { jest } from "@jest/globals"
import nock from "nock"

import * as constants from "../__fixtures__/constants.js"
import * as core from "../__fixtures__/core.js"

// Mocks should be declared before the module being tested is imported.
jest.unstable_mockModule("@actions/core", () => core)

// The module being tested should be imported dynamically. This ensures that the
// mocks are used in place of any actual dependencies.
const { run } = await import("../src/main.js")

describe("run", () => {
  beforeEach(() => {
    // Set the action's inputs as return values from core.getInput().
    core.getInput.mockImplementation((name: string) => {
      if (name === "versions") {
        return "1"
      } else if (name === "project") {
        return ""
      } else if (name === "if-missing") {
        return "error"
      } else {
        throw new Error(`Unknown input name ${name}`)
      }
    })

    // Set the action's inputs as return values from core.getBooleanInput().
    core.getBooleanInput.mockImplementation((name: string) => {
      throw new Error(`Unknown boolean input name ${name}`)
    })

    // Instead of downloading versions.json, use `__fixtures__/versions.json`.
    // Mocking `node-fetch` with `jest` directly or `jest-fetch-mock` doesn't work well with ESM:
    // https://github.com/node-fetch/node-fetch/issues/1263
    nock("https://julialang-s3.julialang.org")
      .persist()
      .get("/bin/versions.json")
      .replyWithFile(200, constants.versionsJsonFile)
  })

  afterEach(() => {
    jest.resetAllMocks()
    nock.cleanAll()
  })

  it("Sets the output", async () => {
    await run()

    // Verify the time output was set.
    expect(core.setOutput).toHaveBeenNthCalledWith(
      1,
      "unique-json",
      // Regex to confirm that version output is a JSON list of version strings
      expect.stringMatching(/^\["1\.\d+\.\d+"\]$/)
    )

    expect(core.setOutput).toHaveBeenNthCalledWith(
      2,
      "version",
      expect.stringMatching(/^1\.\d+\.\d+$/)
    )
  })

  it("Sets a failed status", async () => {
    // Clear the getInput mock and return an invalid value.
    core.getInput.mockClear().mockReturnValueOnce("unknown")

    await run()

    // Verify that the action was marked as failed.
    expect(core.setFailed).toHaveBeenNthCalledWith(
      1,
      'Invalid version specifier provided: "unknown"'
    )
  })
})
