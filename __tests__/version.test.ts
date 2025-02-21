/**
 * Unit tests for src/project.ts
 */
import * as fs from "node:fs"
import * as path from "node:path"
import * as semver from "semver"

import { resolveJuliaVersion } from "../src/version.js"

const testVersions = Object.keys(
  JSON.parse(fs.readFileSync(versionsJsonFile).toString())
)

describe("resolveJuliaVersion tests", () => {
  describe("specific versions", () => {
    it("Doesn't change the version when given a valid semver version", () => {
      expect(resolveJuliaVersion("1.0.5", [])).toEqual("1.0.5")
      expect(resolveJuliaVersion("1.0.5", ["v1.0.5", "v1.0.6"])).toEqual(
        "1.0.5"
      )
      expect(resolveJuliaVersion("1.0.5", ["v1.0.4", "v1.0.5"])).toEqual(
        "1.0.5"
      )
      expect(resolveJuliaVersion("1.0.5", ["v1.0.4"])).toEqual("1.0.5")
      expect(resolveJuliaVersion("1.3.0-alpha", [])).toEqual("1.3.0-alpha")
      expect(
        resolveJuliaVersion("1.3.0-alpha", [
          "v1.2.0",
          "v1.3.0-alpha",
          "v1.3.0-rc1",
          "v1.3.0"
        ])
      ).toEqual("1.3.0-alpha")
      expect(resolveJuliaVersion("1.3.0-rc2", [])).toEqual("1.3.0-rc2")
    })

    it("version alias: nightly", () => {
      expect(() => resolveJuliaVersion("nightly", [])).toThrow(
        "Could not find a Julia version that matches nightly"
      )
    })

    it("version alias: lts", () => {
      // Update test when LTS is updated
      expect(resolveJuliaVersion("lts", testVersions)).toEqual(
        resolveJuliaVersion("1.10", testVersions)
      )
      expect(resolveJuliaVersion("lts", testVersions)).toEqual("1.10.5")
    })

    it("version alias: pre", () => {
      expect(resolveJuliaVersion("pre", testVersions)).toEqual("1.11.0")
    })
  })

  describe("version ranges", () => {
    it("Chooses the highest available version that matches the input", () => {
      expect(resolveJuliaVersion("1", testVersions)).toEqual("1.11.0")
      expect(resolveJuliaVersion("1.0", testVersions)).toEqual("1.0.5")
      expect(resolveJuliaVersion("^1.3.0-rc1", testVersions)).toEqual("1.11.0")
      expect(resolveJuliaVersion("^1.2.0-rc1", testVersions)).toEqual("1.11.0")
      expect(resolveJuliaVersion("^1.10.0-rc1", testVersions)).toEqual("1.11.0")
    })
  })

  describe("include-prereleases", () => {
    it("Chooses the highest available version that matches the input including prereleases", () => {
      expect(resolveJuliaVersion("^1.2.0-0", testVersions, true)).toEqual(
        "1.11.0"
      )
      expect(resolveJuliaVersion("1", testVersions, true)).toEqual("1.11.0")
      expect(resolveJuliaVersion("^1.2.0-0", testVersions, false)).toEqual(
        "1.11.0"
      )
    })
  })

  describe("node-semver behaviour", () => {
    describe("Windows installer change", () => {
      it("Correctly understands >1.4.0", () => {
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

      expect(resolveJuliaVersion("min", vers, false, "^1.7")).toEqual("1.7.1")
      expect(resolveJuliaVersion("min", vers, true, "^1.7")).toEqual(
        "1.7.1-rc1"
      )

      vers = ["1.6.7", "1.7.3-rc1", "1.7.3-rc2", "1.8.0"]
      expect(resolveJuliaVersion("min", vers, false, "^1.7")).toEqual("1.8.0")
      expect(resolveJuliaVersion("min", vers, true, "^1.7")).toEqual(
        "1.7.3-rc1"
      )

      expect(
        resolveJuliaVersion("min", vers, false, "~1.7 || ~1.8 || ~1.9")
      ).toEqual("1.8.0")
      expect(
        resolveJuliaVersion("min", vers, true, "~1.7 || ~1.8 || ~1.9")
      ).toEqual("1.7.3-rc1")
      expect(
        resolveJuliaVersion("min", vers, false, "~1.8 || ~1.7 || ~1.9")
      ).toEqual("1.8.0")
      expect(
        resolveJuliaVersion("min", vers, true, "~1.8 || ~1.7 || ~1.9")
      ).toEqual("1.7.3-rc1")

      expect(resolveJuliaVersion("min", vers, false, "1.7 - 1.9")).toEqual(
        "1.8.0"
      )
      expect(resolveJuliaVersion("min", vers, true, "1.7 - 1.9")).toEqual(
        "1.7.3-rc1"
      )

      expect(resolveJuliaVersion("min", vers, true, "< 1.9.0")).toEqual("1.6.7")
      expect(resolveJuliaVersion("min", vers, true, ">= 1.6.0")).toEqual(
        "1.6.7"
      )

      // NPM"s semver package treats "1.7" as "~1.7" instead of "^1.7" like Julia
      expect(() => resolveJuliaVersion("min", vers, false, "1.7")).toThrow(
        "Could not find a Julia version that matches"
      )

      expect(() => resolveJuliaVersion("min", vers, true, "")).toThrow(
        "Julia project file does not specify a compat for Julia"
      )
    })
  })
})
