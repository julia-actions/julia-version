/**
 * Unit tests for the action's main functionality, src/main.ts
 *
 * To mock dependencies in ESM, you can create fixtures that export mock
 * functions and objects. For example, the core module is mocked in this test,
 * so that the actual '@actions/core' module is not imported.
 */
import { jest } from "@jest/globals"
import * as fs from "fs"
import * as core from "../__fixtures__/core.js"
// import fetch from "jest-fetch-mock"
import { fetch } from "../__fixtures__/fetch.js"

// Mocks should be declared before the module being tested is imported.
jest.unstable_mockModule("@actions/core", () => core)
jest.unstable_mockModule("../src/fetch.js", () => ({ fetch }))
// jest.unstable_mockModule("../src/wait.js", () => ({ wait }))
// jest.unstable_mockModule("../src/version.js", () => ({ getJuliaVersionInfo, genNightlies }))

// https://github.com/node-fetch/node-fetch/issues/1263

import { Response } from "../src/fetch.js"

// The module being tested should be imported dynamically. This ensures that the
// mocks are used in place of any actual dependencies.
const { run } = await import("../src/main.js")

describe("main.ts", () => {
  beforeEach(() => {
    // Set the action's inputs as return values from core.getInput().
    core.getInput.mockImplementation((name: string) => {
      if (name === "version") {
        return "1"
      } else if (name === "project") {
        return ""
      } else {
        throw new Error(`Unknown input name ${name}`)
      }
    })

    // Set the action's inputs as return values from core.getBooleanInput().
    core.getBooleanInput.mockImplementation((name: string) => {
      if (name === "include-all-prereleases") {
        return false
      } else {
        throw new Error(`Unknown boolean input name ${name}`)
      }
    })

    // Mock the wait function so that it does not actually wait.
    fetch.mockImplementation(() => {
      return Promise.resolve<Response>({
        text: () => Promise.resolve<string>(fs.readFileSync("__fixtures__/versions.json").toString()),
        ok: true,
        status: 200,
        headers: {
          get: () => null
        }
      })
    })
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it("Sets the time output", async () => {
    await run()

    // Verify the time output was set.
    expect(core.setOutput).toHaveBeenNthCalledWith(
      1,
      "version",
      // Simple regex to match a time string in the format HH:MM:SS.
      // expect.stringMatching(/^\d+\.\d+\.\d+/)
      expect.stringMatching(/^1\.11\.4$/)
    )

    // TODO: Test downloads-json?
  }, 10000)

  // it("Sets a failed status", async () => {
  //   // Clear the getInput mock and return an invalid value.
  //   core.getInput.mockClear().mockReturnValueOnce("this is not a number")

  //   // Clear the wait mock and return a rejected promise.
  //   wait
  //     .mockClear()
  //     .mockRejectedValueOnce(new Error("milliseconds is not a number"))

  //   await run()

  //   // Verify that the action was marked as failed.
  //   expect(core.setFailed).toHaveBeenNthCalledWith(
  //     1,
  //     "milliseconds is not a number"
  //   )
  // })
})
