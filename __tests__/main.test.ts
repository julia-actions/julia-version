/**
 * Unit tests for the action's main functionality, src/main.ts
 *
 * To mock dependencies in ESM, you can create fixtures that export mock
 * functions and objects. For example, the core module is mocked in this test,
 * so that the actual '@actions/core' module is not imported.
 */
import { jest } from "@jest/globals"
import * as path from "node:path"
import * as url from "node:url"
import nock from "nock"

import * as core from "../__fixtures__/core.js"

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const versionsJsonFile = path.join(
  __dirname,
  "..",
  "__fixtures__",
  "versions.json"
)

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
    nock("https://julialang-s3.julialang.org")
      .persist()
      .get("/bin/versions.json")
      .replyWithFile(200, versionsJsonFile)
  })

  afterEach(() => {
    jest.resetAllMocks()
    nock.cleanAll()
  })

  it("Sets the version output", async () => {
    await run()

    // Verify the time output was set.
    expect(core.setOutput).toHaveBeenNthCalledWith(
      1,
      "version",
      // Basic regex to confirm the result is a valid semver string. The regex
      // used isn't fully aligned with the semver spec but it's close enough
      // for our purposes.
      // https://semver.org/#is-there-a-suggested-regular-expression-regex-to-check-a-semver-string
      expect.stringMatching(/^\d+\.\d+\.\d+(?:-[0-9a-zA-Z.-]+)?$/)
    )
  })

  it("Sets a failed status", async () => {
    // Clear the getInput mock and return an invalid value.
    core.getInput.mockClear().mockReturnValueOnce("unknown")

    await run()

    // Verify that the action was marked as failed.
    expect(core.setFailed).toHaveBeenNthCalledWith(
      1,
      "Could not find a Julia version that matches unknown"
    )
  })
})
