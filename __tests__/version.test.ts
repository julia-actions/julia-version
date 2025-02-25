/**
 * Unit tests for src/version.ts
 */
import { testVersions } from "../__fixtures__/constants.js"
import { resolveVersionSpecifier } from "../src/version.js"

describe("resolveVersionSpecifier tests", () => {
  // Will need to update these values if `__fixtures__/versions.json` is updated.
  const latestRelease = "1.11.3"
  const latestLts = "1.10.8"

  describe("specific versions", () => {
    it("Must return an available version", () => {
      expect(() => resolveVersionSpecifier("1.0.5", [])).toThrow(
        "No Julia version exists"
      )
      expect(resolveVersionSpecifier("1.0.5", ["1.0.5", "1.0.6"])).toEqual(
        "1.0.5"
      )
      expect(resolveVersionSpecifier("1.0.5", ["1.0.4", "1.0.5"])).toEqual(
        "1.0.5"
      )
      expect(() => resolveVersionSpecifier("1.0.5", ["1.0.4"])).toThrow(
        "No Julia version exists"
      )

      expect(() => resolveVersionSpecifier("1.3.0-alpha", [])).toThrow(
        "No Julia version exists"
      )
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
      expect(() => resolveVersionSpecifier("nightly", [])).toThrow(
        'No Julia version exists matching specifier: "nightly"'
      )
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
