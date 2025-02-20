/**
 * Unit tests for src/project.ts
 */
import * as fs from "fs"
import * as path from "path"
import * as semver from "semver"
import * as toml from "toml"
import { tmpdir } from "node:os"

import {
  getJuliaCompatRange,
  getJuliaProjectFile,
  validJuliaCompatRange
} from "../src/project.js"

// const testVersions = [
//     '0.1.2',
//     '0.2.0', '0.2.1',
//     '0.3.0', '0.3.1', '0.3.10', '0.3.11', '0.3.12', '0.3.2', '0.3.3', '0.3.4', '0.3.5', '0.3.6', '0.3.7', '0.3.8', '0.3.9',
//     '0.4.0', '0.4.0-rc1', '0.4.0-rc2', '0.4.0-rc3', '0.4.0-rc4', '0.4.1', '0.4.2', '0.4.3', '0.4.4', '0.4.5', '0.4.6', '0.4.7',
//     '0.5.0', '0.5.0-rc0', '0.5.0-rc1', '0.5.0-rc2', '0.5.0-rc3', '0.5.0-rc4', '0.5.1', '0.5.2',
//     '0.6.0', '0.6.0-pre.alpha', '0.6.0-pre.beta', '0.6.0-rc1', '0.6.0-rc2', '0.6.0-rc3', '0.6.1', '0.6.2', '0.6.3', '0.6.4',
//     '0.7.0', '0.7.0-alpha', '0.7.0-beta', '0.7.0-beta2', '0.7.0-rc1', '0.7.0-rc2', '0.7.0-rc3',
//     '1.0.0', '1.0.0-rc1', '1.0.1', '1.0.2', '1.0.3', '1.0.4', '1.0.5',
//     '1.1.0', '1.1.0-rc1', '1.1.0-rc2', '1.1.1',
//     '1.2.0', '1.2.0-rc1', '1.2.0-rc2', '1.2.0-rc3',
//     '1.3.0', '1.3.0-alpha', '1.3.0-rc1', '1.3.0-rc2', '1.3.0-rc3', '1.3.0-rc4', '1.3.0-rc5', '1.3.1',
//     '1.4.0', '1.4.0-rc1', '1.4.0-rc2', '1.4.1', '1.4.2',
//     '1.5.0', '1.5.0-beta1', '1.5.0-rc1', '1.5.0-rc2', '1.5.1', '1.5.2', '1.5.3', '1.5.4',
//     '1.6.0', '1.6.0-beta1', '1.6.0-rc1', '1.6.0-rc2', '1.6.0-rc3', '1.6.1', '1.6.2', '1.6.3', '1.6.4', '1.6.5', '1.6.6', '1.6.7',
//     '1.7.0', '1.7.0-beta1', '1.7.0-beta2', '1.7.0-beta3', '1.7.0-beta4', '1.7.0-rc1', '1.7.0-rc2', '1.7.0-rc3', '1.7.1', '1.7.2', '1.7.3',
//     '1.8.0', '1.8.0-beta1', '1.8.0-beta2', '1.8.0-beta3', '1.8.0-rc1', '1.8.0-rc2', '1.8.0-rc3', '1.8.0-rc4', '1.8.1', '1.8.2', '1.8.3', '1.8.4', '1.8.5',
//     '1.9.0', '1.9.0-alpha1', '1.9.0-beta1', '1.9.0-beta2', '1.9.0-beta3', '1.9.0-beta4', '1.9.0-rc1', '1.9.0-rc2', '1.9.0-rc3', '1.9.1', '1.9.2', '1.9.3', '1.9.4',
//     '1.10.0', '1.10.0-alpha1', '1.10.0-beta1', '1.10.0-beta2', '1.10.0-beta3', '1.10.0-rc1', '1.10.0-rc2', '1.10.0-rc3', '1.10.1', '1.10.2', '1.10.3', '1.10.4', '1.10.5',
//     '1.11.0', '1.11.0-alpha1', '1.11.0-alpha2', '1.11.0-beta1', '1.11.0-beta2', '1.11.0-rc1', '1.11.0-rc2', '1.11.0-rc3', '1.11.0-rc4',
// ]

// const toolDir = path.join(__dirname, 'runner', 'tools')
// const tempDir = path.join(__dirname, 'runner', 'temp')
// const fixtureDir = path.join(__dirname, 'fixtures')

// process.env['RUNNER_TOOL_CACHE'] = toolDir
// process.env['RUNNER_TEMP'] = tempDir

// import * as installer from '../src/installer'
// import exp from 'constants'

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
      "Unable to locate project file"
    )
    expect(() => getJuliaProjectFile(".")).toThrow(
      "Unable to locate project file"
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

// describe('version matching tests', () => {
//     describe('specific versions', () => {
//         it('Doesn\'t change the version when given a valid semver version', () => {
//             expect(installer.getJuliaVersion([], '1.0.5')).toEqual('1.0.5')
//             expect(installer.getJuliaVersion(['v1.0.5', 'v1.0.6'], '1.0.5')).toEqual('1.0.5')
//             expect(installer.getJuliaVersion(['v1.0.4', 'v1.0.5'], '1.0.5')).toEqual('1.0.5')
//             expect(installer.getJuliaVersion(['v1.0.4'], '1.0.5')).toEqual('1.0.5')
//             expect(installer.getJuliaVersion([], '1.3.0-alpha')).toEqual('1.3.0-alpha')
//             expect(installer.getJuliaVersion(['v1.2.0', 'v1.3.0-alpha', 'v1.3.0-rc1', 'v1.3.0'], '1.3.0-alpha')).toEqual('1.3.0-alpha')
//             expect(installer.getJuliaVersion([], '1.3.0-rc2')).toEqual('1.3.0-rc2')
//         })

//         it('Doesn\'t change the version when given `nightly`', () => {
//             expect(installer.getJuliaVersion([], 'nightly')).toEqual('nightly')
//             expect(installer.getJuliaVersion(testVersions, 'nightly')).toEqual('nightly')
//         })

//         it('LTS', () => {
//             // Update test when LTS is updated
//             expect(installer.getJuliaVersion(testVersions, 'lts')).toEqual(installer.getJuliaVersion(testVersions, '1.10'))
//             expect(installer.getJuliaVersion(testVersions, 'lts')).toEqual('1.10.5')
//         })

//         it('pre', () => {
//             expect(installer.getJuliaVersion(testVersions, 'pre')).toEqual('1.11.0')
//         })
//     })

//     describe('version ranges', () => {
//         it('Chooses the highest available version that matches the input', () => {
//             expect(installer.getJuliaVersion(testVersions, '1')).toEqual('1.11.0')
//             expect(installer.getJuliaVersion(testVersions, '1.0')).toEqual('1.0.5')
//             expect(installer.getJuliaVersion(testVersions, '^1.3.0-rc1')).toEqual('1.11.0')
//             expect(installer.getJuliaVersion(testVersions, '^1.2.0-rc1')).toEqual('1.11.0')
//             expect(installer.getJuliaVersion(testVersions, '^1.10.0-rc1')).toEqual('1.11.0')
//         })
//     })

//     describe('include-prereleases', () => {
//         it('Chooses the highest available version that matches the input including prereleases', () => {
//             expect(installer.getJuliaVersion(testVersions, '^1.2.0-0', true)).toEqual('1.11.0')
//             expect(installer.getJuliaVersion(testVersions, '1', true)).toEqual('1.11.0')
//             expect(installer.getJuliaVersion(testVersions, '^1.2.0-0', false)).toEqual('1.11.0')
//         })
//     })

//     describe('node-semver behaviour', () => {
//         describe('Windows installer change', () => {
//             it('Correctly understands >1.4.0', () => {
//                 expect(semver.gtr('1.4.0-rc1', '1.3', {includePrerelease: true})).toBeTruthy()
//                 expect(semver.gtr('1.4.0-DEV', '1.3', {includePrerelease: true})).toBeTruthy()
//                 expect(semver.gtr('1.3.1', '1.3', {includePrerelease: true})).toBeFalsy()
//                 expect(semver.gtr('1.3.2-rc1', '1.3', {includePrerelease: true})).toBeFalsy()
//             })
//         })
//     })

//     describe('julia compat versions', () => {
//         it('Understands "min"', () => {
//             let versions = ["1.6.7", "1.7.1-rc1", "1.7.1-rc2", "1.7.1", "1.7.2", "1.8.0"]
//             expect(installer.getJuliaVersion(versions, "min", false, "^1.7")).toEqual("1.7.1")
//             expect(installer.getJuliaVersion(versions, "min", true, "^1.7")).toEqual("1.7.1-rc1")

//             versions = ["1.6.7", "1.7.3-rc1", "1.7.3-rc2", "1.8.0"]
//             expect(installer.getJuliaVersion(versions, "min", false, "^1.7")).toEqual("1.8.0")
//             expect(installer.getJuliaVersion(versions, "min", true, "^1.7")).toEqual("1.7.3-rc1")

//             expect(installer.getJuliaVersion(versions, "min", false, "~1.7 || ~1.8 || ~1.9")).toEqual("1.8.0")
//             expect(installer.getJuliaVersion(versions, "min", true, "~1.7 || ~1.8 || ~1.9")).toEqual("1.7.3-rc1")
//             expect(installer.getJuliaVersion(versions, "min", false, "~1.8 || ~1.7 || ~1.9")).toEqual("1.8.0")
//             expect(installer.getJuliaVersion(versions, "min", true, "~1.8 || ~1.7 || ~1.9")).toEqual("1.7.3-rc1")

//             expect(installer.getJuliaVersion(versions, "min", false, "1.7 - 1.9")).toEqual("1.8.0")
//             expect(installer.getJuliaVersion(versions, "min", true, "1.7 - 1.9")).toEqual("1.7.3-rc1")

//             expect(installer.getJuliaVersion(versions, "min", true, "< 1.9.0")).toEqual("1.6.7")
//             expect(installer.getJuliaVersion(versions, "min", true, ">= 1.6.0")).toEqual("1.6.7")

//             // NPM's semver package treats "1.7" as "~1.7" instead of "^1.7" like Julia
//             expect(() => installer.getJuliaVersion(versions, "min", false, "1.7")).toThrow("Could not find a Julia version that matches")

//             expect(() => installer.getJuliaVersion(versions, "min", true, "")).toThrow("Julia project file does not specify a compat for Julia")
//         })
//     })
// })

// describe('installer tests', () => {
//     beforeAll(async () => {
//         await io.rmRF(toolDir)
//         await io.rmRF(tempDir)
//     }, 100000)

//     afterAll(async () => {
//         try {
//             await io.rmRF(toolDir)
//             await io.rmRF(tempDir)
//         } catch {
//             console.log('Failed to remove test directories')
//         }
//     }, 100000)

//     describe('versions.json parsing', () => {
//         // Instead of downloading versions.json, use fixtures/versions.json
//         beforeEach(() => {
//             nock('https://julialang-s3.julialang.org').persist()
//                 .get('/bin/versions.json')
//                 .replyWithFile(200, path.join(fixtureDir, 'versions.json'))
//         })

//         afterEach(() => {
//             nock.cleanAll()
//             nock.enableNetConnect()
//         })

//         it('Extracts the list of available versions', async () => {
//             expect(await (await installer.getJuliaVersions(await installer.getJuliaVersionInfo())).sort()).toEqual(testVersions.sort())
//         })
//     })
// })
