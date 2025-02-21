/**
 * Unit tests for the action's main functionality, src/main.ts
 *
 * To mock dependencies in ESM, you can create fixtures that export mock
 * functions and objects. For example, the core module is mocked in this test,
 * so that the actual '@actions/core' module is not imported.
 */
import { jest } from "@jest/globals"
import * as path from "path"
import * as url from "url"
import nock from "nock"

import * as core from "../__fixtures__/core.js"

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))

// Mocks should be declared before the module being tested is imported.
jest.unstable_mockModule("@actions/core", () => core)

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

    // Instead of downloading versions.json, use `__fixtures__/versions.json`.
    // Mocking `node-fetch` with `jest` directly or `jest-fetch-mock` doesn't work well with ESM:
    // https://github.com/node-fetch/node-fetch/issues/1263
    nock("https://julialang-s3.julialang.org").persist()
      .get("/bin/versions.json")
      .replyWithFile(200, path.join(__dirname, "..", "__fixtures__", "versions.json"))
  })

  afterEach(() => {
    jest.resetAllMocks()
    nock.cleanAll()
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
  })

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
