/**
 * Unit tests for src/project.ts
 */
import * as fs from "node:fs"
import * as path from "node:path"
import * as semver from "semver"
import * as toml from "toml"
import { tmpdir } from "node:os"

import {
  getJuliaCompatRange,
  getJuliaProjectFile,
  getJuliaManifestFile,
  validJuliaCompatRange,
} from "../src/project.js"

describe("getJuliaProjectFile tests", () => {
  let orgWorkingDir: string

  beforeEach(() => {
    orgWorkingDir = process.cwd()
  })

  afterEach(() => {
    process.chdir(orgWorkingDir)
  })

  it("Can determine project file is missing", () => {
    expect(() => getJuliaProjectFile("DNE.toml")).toThrow(
      "Unable to locate Julia project file"
    )
    expect(() => getJuliaProjectFile(".")).toThrow(
      "Unable to locate Julia project file"
    )
  })

  it("Can determine project file from a directory", () => {
    fs.mkdtemp(path.join(tmpdir(), "julia-version-"), (err, projectDir) => {
      const projectFile = path.join(projectDir, "Project.toml")
      fs.closeSync(fs.openSync(projectFile, "w"))
      expect(getJuliaProjectFile(projectDir)).toEqual(projectFile)
    })

    fs.mkdtemp(path.join(tmpdir(), "julia-version-"), (err, projectDir) => {
      const projectFile = path.join(projectDir, "JuliaProject.toml")
      fs.closeSync(fs.openSync(projectFile, "w"))
      expect(getJuliaProjectFile(projectDir)).toEqual(projectFile)
    })
  })

  it("Prefers using JuliaProject.toml over Project.toml", () => {
    fs.mkdtemp(path.join(tmpdir(), "julia-version-"), (err, projectDir) => {
      const projectFile = path.join(projectDir, "Project.toml")
      fs.closeSync(fs.openSync(projectFile, "w"))

      const juliaProjectFile = path.join(projectDir, "JuliaProject.toml")
      fs.closeSync(fs.openSync(juliaProjectFile, "w"))

      expect(getJuliaProjectFile(projectDir)).toEqual(juliaProjectFile)
    })
  })

  it("Can determine project from the current working directory", () => {
    fs.mkdtemp(path.join(tmpdir(), "julia-version-"), (err, projectDir) => {
      const projectFile = path.join(projectDir, "Project.toml")
      fs.closeSync(fs.openSync(projectFile, "w"))

      process.chdir(projectDir)
      expect(getJuliaProjectFile(".")).toEqual("Project.toml")
    })
  })
})

describe("getJuliaManifestFile tests", () => {
  let orgWorkingDir: string

  beforeEach(() => {
    orgWorkingDir = process.cwd()
  })

  afterEach(() => {
    process.chdir(orgWorkingDir)
  })

  it("Can determine manifest file is missing", () => {
    expect(() => getJuliaManifestFile(".")).toThrow(
      "Unable to locate Julia manifest file"
    )
  })

  it("Can determine project file from a directory", () => {
    fs.mkdtemp(path.join(tmpdir(), "julia-version-"), (err, projectDir) => {
      const manifestFile = path.join(projectDir, "Manifest.toml")
      fs.closeSync(fs.openSync(manifestFile, "w"))
      expect(getJuliaManifestFile(projectDir)).toEqual(manifestFile)
    })

    fs.mkdtemp(path.join(tmpdir(), "julia-version-"), (err, projectDir) => {
      const manifestFile = path.join(projectDir, "JuliaManifest.toml")
      fs.closeSync(fs.openSync(manifestFile, "w"))
      expect(getJuliaManifestFile(projectDir)).toEqual(manifestFile)
    })
  })

  it("Prefers using JuliaManifest.toml over Manifest.toml", () => {
    fs.mkdtemp(path.join(tmpdir(), "julia-version-"), (err, projectDir) => {
      const manifestFile = path.join(projectDir, "Manifest.toml")
      fs.closeSync(fs.openSync(manifestFile, "w"))

      const juliaManifestFile = path.join(projectDir, "JuliaManifest.toml")
      fs.closeSync(fs.openSync(juliaManifestFile, "w"))

      expect(getJuliaManifestFile(projectDir)).toEqual(juliaManifestFile)
    })
  })

  it("Can determine project from the current working directory", () => {
    fs.mkdtemp(path.join(tmpdir(), "julia-version-"), (err, projectDir) => {
      const projectFile = path.join(projectDir, "Manifest.toml")
      fs.closeSync(fs.openSync(projectFile, "w"))

      process.chdir(projectDir)
      expect(getJuliaManifestFile(".")).toEqual("Manifest.toml")
    })
  })
})

describe("validJuliaCompatRange tests", () => {
  it("Handles default caret specifier", () => {
    expect(validJuliaCompatRange("1")).toEqual(semver.validRange("^1"))
    expect(validJuliaCompatRange("1.2")).toEqual(semver.validRange("^1.2"))
    expect(validJuliaCompatRange("1.2.3")).toEqual(semver.validRange("^1.2.3"))

    // TODO: Pkg.jl currently does not support pre-release entries in compat so ideally this would fail
    expect(validJuliaCompatRange("1.2.3-rc1")).toEqual(
      semver.validRange("^1.2.3-rc1")
    )
  })

  it("Handle surrounding whitespace", () => {
    expect(validJuliaCompatRange(" 1")).toEqual(semver.validRange("^1"))
    expect(validJuliaCompatRange("1 ")).toEqual(semver.validRange("^1"))
    expect(validJuliaCompatRange(" 1 ")).toEqual(semver.validRange("^1"))
  })

  it("Handles version ranges with specifiers", () => {
    expect(validJuliaCompatRange("^1.2.3")).toEqual(semver.validRange("^1.2.3"))
    expect(validJuliaCompatRange("~1.2.3")).toEqual(semver.validRange("~1.2.3"))
    expect(validJuliaCompatRange("=1.2.3")).toEqual(semver.validRange("=1.2.3"))
    expect(validJuliaCompatRange(">=1.2.3")).toEqual(">=1.2.3")
    expect(validJuliaCompatRange("≥1.2.3")).toEqual(">=1.2.3")
    expect(validJuliaCompatRange("<1.2.3")).toEqual("<1.2.3")
  })

  it("Handles whitespace after specifiers", () => {
    expect(validJuliaCompatRange("^ 1.2.3")).toBeNull()
    expect(validJuliaCompatRange("~ 1.2.3")).toBeNull()
    expect(validJuliaCompatRange("= 1.2.3")).toBeNull()
    expect(validJuliaCompatRange(">= 1.2.3")).toEqual(">=1.2.3")
    expect(validJuliaCompatRange("≥ 1.2.3")).toEqual(">=1.2.3")
    expect(validJuliaCompatRange("< 1.2.3")).toEqual("<1.2.3")
  })

  it("Handles hypen ranges", () => {
    expect(validJuliaCompatRange("1.2.3 - 4.5.6")).toEqual(
      semver.validRange("1.2.3 - 4.5.6")
    )
    expect(validJuliaCompatRange("1.2.3-rc1 - 4.5.6")).toEqual(
      semver.validRange("1.2.3-rc1 - 4.5.6")
    )
    expect(validJuliaCompatRange("1.2.3-rc1-4.5.6")).toEqual(
      semver.validRange("^1.2.3-rc1-4.5.6")
    ) // A version number and not a hypen range
    expect(validJuliaCompatRange("1.2.3-rc1 -4.5.6")).toBeNull()
    expect(validJuliaCompatRange("1.2.3-rc1- 4.5.6")).toBeNull() // Whitespace separate version ranges
  })

  it("Returns null AND operator on version ranges", () => {
    expect(validJuliaCompatRange("")).toBeNull()
    expect(validJuliaCompatRange("1 2 3")).toBeNull()
    expect(validJuliaCompatRange("1- 2")).toBeNull()
    expect(validJuliaCompatRange("<1 <1")).toBeNull()
    expect(validJuliaCompatRange("< 1 < 1")).toBeNull()
    expect(validJuliaCompatRange("<  1 <  1")).toBeNull()
  })

  it("Returns null with invalid specifiers", () => {
    expect(validJuliaCompatRange("<=1.2.3")).toBeNull()
    expect(validJuliaCompatRange("≤1.2.3")).toBeNull()
    expect(validJuliaCompatRange("*")).toBeNull()
  })

  it("Handles OR operator on version ranges", () => {
    expect(validJuliaCompatRange("1, 2, 3")).toEqual(
      semver.validRange("^1 || ^2 || ^3")
    )
    expect(validJuliaCompatRange("1, 2 - 3, ≥ 4")).toEqual(
      semver.validRange("^1 || >=2 <=3 || >=4")
    )
    expect(validJuliaCompatRange(",")).toBeNull()
  })
})

describe("getJuliaCompatRange tests", () => {
  it("Can determine Julia compat entries", () => {
    const projectToml = toml.parse(
      '[compat]\njulia = "1, ^1.1, ~1.2, >=1.3, 1.4 - 1.5"'
    )
    expect(getJuliaCompatRange(projectToml)).toEqual(
      semver.validRange("^1 || ^1.1 || ~1.2 || >=1.3 || 1.4 - 1.5")
    )
  })

  it("Throws with invalid version ranges", () => {
    const projectTomlA = toml.parse('[compat]\njulia = ""')
    expect(() => getJuliaCompatRange(projectTomlA)).toThrow(
      "Invalid version range"
    )

    const projectTomlB = toml.parse('[compat]\njulia = "1 2 3"')
    expect(() => getJuliaCompatRange(projectTomlB)).toThrow(
      "Invalid version range"
    )
  })

  it("Handle missing compat entries", () => {
    expect(getJuliaCompatRange(toml.parse(""))).toEqual("*")
    expect(getJuliaCompatRange(toml.parse("[compat]"))).toEqual("*")
  })
})
