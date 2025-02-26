/**
 * Unit tests for src/version.ts
 */
import { jest } from "@jest/globals"
import nock from "nock"

import * as core from "../__fixtures__/core.js"
import { testVersions, versionsJsonFile } from "../__fixtures__/constants.js"

// Mocks should be declared before the module being tested is imported.
jest.unstable_mockModule("@actions/core", () => core)

// The module being tested should be imported dynamically. This ensures that the
// mocks are used in place of any actual dependencies.
const { resolveVersionSpecifier, resolveVersionSpecifiers, versionSort } = await import("../src/version.js")

describe("versionSort tests", () => {
  it("Returns the proper order", () => {
    const arr = ["5.5.1", "4.21.0", "4.22.0", "6.1.0", "5.1.0", "4.5.0"]
    const expected = ["4.5.0", "4.21.0", "4.22.0", "5.1.0", "5.5.1", "6.1.0"]

    expect(arr).not.toEqual(expected)
    expect(arr.sort()).not.toEqual(expected)
    expect(versionSort(arr)).toEqual(expected)
  })
})

describe("resolveVersionSpecifiers tests", () => {
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
    expect(await resolveVersionSpecifiers(["nightly"], ".")).toEqual(["nightly"])
    expect(await resolveVersionSpecifiers(["1.10-nightly"], ".")).toEqual(["1.10-nightly"])
    expect(await resolveVersionSpecifiers(["1.11-nightly"], ".")).toEqual(["1.11-nightly"])
    expect(await resolveVersionSpecifiers(["1.12-nightly"], ".")).toEqual(["1.12-nightly"])
  })

  it("Respects ifMissing error", async () => {
    expect(async () => await resolveVersionSpecifiers(["1.9-nightly"], ".", { ifMissing: "error" })).rejects.toThrow("No Julia version exists")
  })

  it("Respects ifMissing warning", async () => {
    await resolveVersionSpecifiers(["1.9-nightly"], ".", { ifMissing: "warn" })
    expect(core.warning).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(/^No Julia version exists/)
    )
  })

  it("Default ifMissing behavior", async () => {
    expect(async () => await resolveVersionSpecifiers(["1.9-nightly"], ".")).rejects.toThrow("No Julia version exists")
  })
})

describe("resolveVersionSpecifier tests", () => {
  // Will need to update these values if `__fixtures__/versions.json` is updated.
  const latestRelease = "1.11.3"
  const latestLts = "1.10.8"

  describe("specific versions", () => {
    it("Must return an available version", () => {
      expect(resolveVersionSpecifier("1.0.5", [])).toBeNull()
      expect(resolveVersionSpecifier("1.0.5", ["1.0.5", "1.0.6"])).toEqual(
        "1.0.5"
      )
      expect(resolveVersionSpecifier("1.0.5", ["1.0.4", "1.0.5"])).toEqual(
        "1.0.5"
      )
      expect(resolveVersionSpecifier("1.0.5", ["1.0.4"])).toBeNull()
      expect(resolveVersionSpecifier("1.3.0-alpha", [])).toBeNull()
      expect(
        resolveVersionSpecifier("1.3.0-alpha", [
          "1.2.0",
          "1.3.0-alpha",
          "1.3.0-rc1",
          "1.3.0"
        ])
      ).toEqual("1.3.0-alpha")
    })

    it("Respects v-prefix", () => {
      expect(resolveVersionSpecifier("1.0.5", ["v1.0.5", "v1.0.6"])).toEqual(
        "v1.0.5"
      )
      expect(resolveVersionSpecifier("1.0.5", ["v1.0.4", "v1.0.5"])).toEqual(
        "v1.0.5"
      )
      expect(resolveVersionSpecifier("v1.0.5", ["1.0.5", "1.0.6"])).toEqual(
        "1.0.5"
      )
      expect(resolveVersionSpecifier("v1.0.5", ["1.0.4", "1.0.5"])).toEqual(
        "1.0.5"
      )
    })

    it("version alias: nightly", () => {
      expect(resolveVersionSpecifier("nightly", [])).toBeNull()
    })

    it("version alias: lts", () => {
      expect(resolveVersionSpecifier("lts", testVersions)).toEqual(latestLts)
    })
  })

  describe("version ranges", () => {
    it("Chooses the highest available version that matches the input", () => {
      expect(resolveVersionSpecifier("1", testVersions)).toEqual(latestRelease)
      expect(resolveVersionSpecifier("1.0", testVersions)).toEqual("1.0.5")
      expect(resolveVersionSpecifier("^1.3.0-rc1", testVersions)).toEqual(
        latestRelease
      )
      expect(resolveVersionSpecifier("^1.2.0-rc1", testVersions)).toEqual(
        latestRelease
      )
      expect(resolveVersionSpecifier("^1.10.0-rc1", testVersions)).toEqual(
        latestRelease
      )
    })
  })

  // describe("include-prereleases", () => {
  //   it("Chooses the highest available version that matches the input including prereleases", () => {
  //     expect(resolveVersionSpecifier("^1.2.0-0", testVersions, true)).toEqual(
  //       latestPre
  //     )
  //     expect(resolveVersionSpecifier("1", testVersions, true)).toEqual(latestPre)
  //     expect(resolveVersionSpecifier("^1.2.0-0", testVersions, false)).toEqual(
  //       latestPre
  //     )
  //   })
  // })

  // describe("node-semver behaviour", () => {
  //   describe("Windows installer change", () => {
  //     it("Correctly understands >1.4.0", () => {
  //       const options = { includePrerelease: true }
  //       expect(semver.gtr("1.4.0-rc1", "1.3", options)).toBeTruthy()
  //       expect(semver.gtr("1.4.0-DEV", "1.3", options)).toBeTruthy()
  //       expect(semver.gtr("1.3.1", "1.3", options)).toBeFalsy()
  //       expect(semver.gtr("1.3.2-rc1", "1.3", options)).toBeFalsy()
  //     })
  //   })
  // })

  describe("julia compat versions", () => {
    it("Understands min", () => {
      let vers = ["1.6.7", "1.7.1-rc1", "1.7.1-rc2", "1.7.1", "1.7.2", "1.8.0"]

      expect(resolveVersionSpecifier("min", vers, "^1.7")).toEqual("1.7.1")

      vers = ["1.6.7", "1.7.3-rc1", "1.7.3-rc2", "1.8.0"]
      expect(resolveVersionSpecifier("min", vers, "^1.7")).toEqual("1.8.0")

      expect(
        resolveVersionSpecifier("min", vers, "~1.7 || ~1.8 || ~1.9")
      ).toEqual("1.8.0")
      expect(
        resolveVersionSpecifier("min", vers, "~1.8 || ~1.7 || ~1.9")
      ).toEqual("1.8.0")
      expect(resolveVersionSpecifier("min", vers, "1.7 - 1.9")).toEqual("1.8.0")

      expect(resolveVersionSpecifier("min", vers, "< 1.9.0")).toEqual("1.6.7")
      expect(resolveVersionSpecifier("min", vers, ">= 1.6.0")).toEqual("1.6.7")

      // NPM"s semver package treats "1.7" as "~1.7" instead of "^1.7" like Julia
      expect(resolveVersionSpecifier("min", vers, "1.7")).toBeNull()

      expect(() => resolveVersionSpecifier("min", vers, "")).toThrow(
        "Julia project file does not specify a compat for Julia"
      )
    })
  })

  // describe("julia compat versions", () => {
  //   it("Understands min", () => {
  //     let vers = ["1.6.7", "1.7.1-rc1", "1.7.1-rc2", "1.7.1", "1.7.2", "1.8.0"]

  //     expect(resolveVersionSpecifier("min", vers, false, "^1.7")).toEqual("1.7.1")
  //     expect(resolveVersionSpecifier("min", vers, true, "^1.7")).toEqual(
  //       "1.7.1-rc1"
  //     )

  //     vers = ["1.6.7", "1.7.3-rc1", "1.7.3-rc2", "1.8.0"]
  //     expect(resolveVersionSpecifier("min", vers, false, "^1.7")).toEqual("1.8.0")
  //     expect(resolveVersionSpecifier("min", vers, true, "^1.7")).toEqual(
  //       "1.7.3-rc1"
  //     )

  //     expect(
  //       resolveVersionSpecifier("min", vers, false, "~1.7 || ~1.8 || ~1.9")
  //     ).toEqual("1.8.0")
  //     expect(
  //       resolveVersionSpecifier("min", vers, true, "~1.7 || ~1.8 || ~1.9")
  //     ).toEqual("1.7.3-rc1")
  //     expect(
  //       resolveVersionSpecifier("min", vers, false, "~1.8 || ~1.7 || ~1.9")
  //     ).toEqual("1.8.0")
  //     expect(
  //       resolveVersionSpecifier("min", vers, true, "~1.8 || ~1.7 || ~1.9")
  //     ).toEqual("1.7.3-rc1")

  //     expect(resolveVersionSpecifier("min", vers, false, "1.7 - 1.9")).toEqual(
  //       "1.8.0"
  //     )
  //     expect(resolveVersionSpecifier("min", vers, true, "1.7 - 1.9")).toEqual(
  //       "1.7.3-rc1"
  //     )

  //     expect(resolveVersionSpecifier("min", vers, true, "< 1.9.0")).toEqual("1.6.7")
  //     expect(resolveVersionSpecifier("min", vers, true, ">= 1.6.0")).toEqual(
  //       "1.6.7"
  //     )

  //     // NPM"s semver package treats "1.7" as "~1.7" instead of "^1.7" like Julia
  //     expect(resolveVersionSpecifier("min", vers, false, "1.7")).toBeNull()

  //     expect(() => resolveVersionSpecifier("min", vers, true, "")).toThrow(
  //       "Julia project file does not specify a compat for Julia"
  //     )
  //   })
  // })
})
