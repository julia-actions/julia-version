/**
 * Unit tests for src/version.ts
 */
import { jest } from "@jest/globals"
import nock from "nock"
import semver from "semver"

import * as core from "../__fixtures__/core.js"
import {
  testVersions,
  versionsJsonFile,
  projectDirV1,
  projectDirV2,
} from "../__fixtures__/constants.js"

// Mocks should be declared before the module being tested is imported.
jest.unstable_mockModule("@actions/core", () => core)

// The module being tested should be imported dynamically. This ensures that the
// mocks are used in place of any actual dependencies.
const { resolveVersions, resolveVersion, versionSort } = await import(
  "../src/version.js"
)

describe("versionSort tests", () => {
  it("Returns the proper order", () => {
    const arr = ["5.5.1", "4.21.0", "4.22.0", "6.1.0", "5.1.0", "4.5.0"]
    const expected = ["4.5.0", "4.21.0", "4.22.0", "5.1.0", "5.5.1", "6.1.0"]

    expect(arr).not.toEqual(expected)
    expect(arr.sort()).not.toEqual(expected)
    expect(versionSort(arr)).toEqual(expected)
  })
})

describe("resolveVersions tests", () => {
  beforeEach(() => {
    // Instead of downloading versions.json, use `__fixtures__/versions.json`.
    // Mocking `node-fetch` with `jest` directly or `jest-fetch-mock` doesn't work well with ESM:
    // https://github.com/node-fetch/node-fetch/issues/1263
    nock("https://julialang-s3.julialang.org")
      .persist()
      .get("/bin/versions.json")
      .replyWithFile(200, versionsJsonFile)

    // Replicate the available nightlies when versions.json was downloaded.
    nock("https://julialangnightlies-s3.julialang.org")
      .persist()
      .head(/1\.(10|11|12)/)
      .reply(200)
      .head(/.*/)
      .reply(404)
  })

  afterEach(() => {
    jest.resetAllMocks()
    nock.cleanAll()
  })

  it("Handles nightly", async () => {
    await expect(resolveVersions(["nightly"], ".")).resolves.toEqual([
      "nightly",
    ])
    await expect(resolveVersions(["1.10-nightly"], ".")).resolves.toEqual([
      "1.10-nightly",
    ])
    await expect(resolveVersions(["1.11-nightly"], ".")).resolves.toEqual([
      "1.11-nightly",
    ])
    await expect(resolveVersions(["1.12-nightly"], ".")).resolves.toEqual([
      "1.12-nightly",
    ])
  })

  it("Handles alias: manifest", async () => {
    await expect(resolveVersions(["manifest"], projectDirV2)).resolves.toEqual([
      "1.11.4",
    ])
    await expect(resolveVersions(["manifest"], projectDirV1)).rejects.toThrow(
      "No Julia version exists matching specifier"
    )
    await expect(resolveVersions(["manifest"], ".")).rejects.toThrow(
      "Unable to locate Julia manifest file"
    )
  })

  it("Respects ifMissing error", async () => {
    await expect(
      resolveVersions(["1.9-nightly"], ".", { ifMissing: "error" })
    ).rejects.toThrow("No Julia version exists")
  })

  it("Respects ifMissing warning", async () => {
    await resolveVersions(["1.9-nightly"], ".", { ifMissing: "warn" })
    expect(core.warning).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(/^No Julia version exists/)
    )
  })

  it("Default ifMissing behavior", async () => {
    await expect(resolveVersions(["1.9-nightly"], ".")).rejects.toThrow(
      "No Julia version exists"
    )
  })
})

describe("resolveVersion tests", () => {
  // Will need to update these values if `__fixtures__/versions.json` is updated.
  const latestRelease = "1.11.4"
  const latestLts = "1.10.9"

  describe("specific versions", () => {
    it("Must return an available version", () => {
      expect(resolveVersion("1.0.5", [])).toBeNull()
      expect(resolveVersion("1.0.5", ["1.0.5", "1.0.6"])).toEqual("1.0.5")
      expect(resolveVersion("1.0.5", ["1.0.4", "1.0.5"])).toEqual("1.0.5")
      expect(resolveVersion("1.0.5", ["1.0.4"])).toBeNull()
      expect(resolveVersion("1.3.0-alpha", [])).toBeNull()
      expect(
        resolveVersion("1.3.0-alpha", [
          "1.2.0",
          "1.3.0-alpha",
          "1.3.0-rc1",
          "1.3.0",
        ])
      ).toEqual("1.3.0-alpha")
    })

    it("Respects v-prefix", () => {
      expect(resolveVersion("1.0.5", ["v1.0.5", "v1.0.6"])).toEqual("v1.0.5")
      expect(resolveVersion("1.0.5", ["v1.0.4", "v1.0.5"])).toEqual("v1.0.5")
      expect(resolveVersion("v1.0.5", ["1.0.5", "1.0.6"])).toEqual("1.0.5")
      expect(resolveVersion("v1.0.5", ["1.0.4", "1.0.5"])).toEqual("1.0.5")
    })

    it("version alias: nightly", () => {
      expect(resolveVersion("nightly", [])).toBeNull()
    })

    it("version alias: lts", () => {
      expect(resolveVersion("lts", testVersions)).toEqual(latestLts)
    })

    it("version alias: manifest", () => {
      expect(resolveVersion("manifest", testVersions)).toBeNull()
      expect(resolveVersion("manifest", testVersions, null, "1.11.3")).toEqual(
        "1.11.3"
      )

      // An unofficial build of say `1.12.0-DEV.850` is recorded as `1.12.0-DEV` in the manifest
      expect(
        resolveVersion("manifest", testVersions, null, "1.12.0-DEV")
      ).toEqual("1.12.0-DEV")
    })
  })

  describe("version ranges", () => {
    it("Chooses the highest available version that matches the input", () => {
      expect(resolveVersion("1", testVersions)).toEqual(latestRelease)
      expect(resolveVersion("1.0", testVersions)).toEqual("1.0.5")
      expect(resolveVersion("^1.3.0-rc1", testVersions)).toEqual(latestRelease)
      expect(resolveVersion("^1.2.0-rc1", testVersions)).toEqual(latestRelease)
      expect(resolveVersion("^1.10.0-rc1", testVersions)).toEqual(latestRelease)
    })

    // https://github.com/julia-actions/julia-version/issues/5
    it.skip.failing("prereleases", () => {
      expect(resolveVersion("~1.1-", ["1.0.0", "1.1.0-rc1"])).toEqual(
        "1.1.0-rc1"
      )
      expect(resolveVersion("^1.1-", ["1.0.0", "1.1.0-rc1"])).toEqual(
        "1.1.0-rc1"
      )
      expect(resolveVersion("~1.1-", ["1.0.0", "1.1.0-rc1", "1.1.0"])).toEqual(
        "1.1.0"
      )
      expect(resolveVersion("^1.1-", ["1.0.0", "1.1.0-rc1", "1.1.0"])).toEqual(
        "1.1.0"
      )
      expect(
        resolveVersion("~1.1-", ["1.0.0", "1.1.0-rc1", "1.1.0", "1.2.0-rc1"])
      ).toEqual("1.1.0")
      expect(
        resolveVersion("^1.1-", ["1.0.0", "1.1.0-rc1", "1.1.0", "1.2.0-rc1"])
      ).toEqual("1.2.0-rc1")
    })
  })

  describe("node-semver behavior", () => {
    describe("Windows installer change", () => {
      it.skip.failing("Correctly understands >1.4.0", () => {
        const options = { includePrerelease: true }
        expect(semver.gtr("1.4.0-rc1", "1.3", options)).toBeTruthy()
        expect(semver.gtr("1.4.0-DEV", "1.3", options)).toBeTruthy()
        expect(semver.gtr("1.3.1", "1.3", options)).toBeFalsy()
        expect(semver.gtr("1.3.2-rc1", "1.3", options)).toBeFalsy()
      })
    })
  })

  describe("julia compat versions", () => {
    it("Understands min", () => {
      let vers = ["1.6.7", "1.7.1-rc1", "1.7.1-rc2", "1.7.1", "1.7.2", "1.8.0"]

      expect(resolveVersion("min", vers, "^1.7")).toEqual("1.7.1")

      vers = ["1.6.7", "1.7.3-rc1", "1.7.3-rc2", "1.8.0"]
      expect(resolveVersion("min", vers, "^1.7")).toEqual("1.8.0")
      // expect(resolveVersion("min", vers, "^1.7-")).toEqual("1.7.3-rc1")

      expect(resolveVersion("min", vers, "~1.7 || ~1.8 || ~1.9")).toEqual(
        "1.8.0"
      )
      // expect(resolveVersion("min", vers, "~1.7- || ~1.8- || ~1.9-")).toEqual(
      //   "1.7.3-rc1"
      // )

      expect(resolveVersion("min", vers, "~1.8 || ~1.7 || ~1.9")).toEqual(
        "1.8.0"
      )
      // expect(resolveVersion("min", vers, "~1.8- || ~1.7- || ~1.9-")).toEqual(
      //   "1.7.3-rc1"
      // )

      expect(resolveVersion("min", vers, "1.7 - 1.9")).toEqual("1.8.0")
      // expect(resolveVersion("min", vers, "1.7- - 1.9-")).toEqual("1.7.3-rc1")

      expect(resolveVersion("min", vers, "< 1.9.0")).toEqual("1.6.7")
      expect(resolveVersion("min", vers, ">= 1.6.0")).toEqual("1.6.7")

      // NPM"s semver package treats "1.7" as "~1.7" instead of "^1.7" like Julia
      expect(resolveVersion("min", vers, "1.7")).toBeNull()

      expect(() => resolveVersion("min", vers, "")).toThrow(
        "Julia project file does not specify a compat for Julia"
      )
    })
  })
})
