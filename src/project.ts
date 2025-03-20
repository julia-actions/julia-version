import * as fs from "node:fs"
import * as path from "node:path"
import * as semver from "semver"

export type JuliaProjectTOML = {
  compat: {
    julia: string | undefined
  }
}

/**
 * Determine the path to a Julia project file from the project.
 *
 * @param juliaProject: The Julia project/environment.
 * @returns The path to the Julia project file.
 * @throws Error if the Julia project file doesn't exist.
 */
export function getJuliaProjectFile(juliaProject: string): string {
  let juliaProjectFile: string = ""

  if (fs.existsSync(juliaProject) && fs.lstatSync(juliaProject).isFile()) {
    juliaProjectFile = juliaProject
  } else {
    for (const filename of ["JuliaProject.toml", "Project.toml"]) {
      const p = path.join(juliaProject, filename)
      if (fs.existsSync(p) && fs.lstatSync(p).isFile()) {
        juliaProjectFile = p
        break
      }
    }
  }

  if (!juliaProjectFile) {
    throw new Error(
      `Unable to locate Julia project file with project: ${juliaProject}`
    )
  }

  return juliaProjectFile
}

/**
 * Determine the path to a Julia manifest file from the project.
 *
 * @param juliaProject: The Julia project/environment.
 * @returns The path to the Julia manifest file.
 * @throws Error if the Julia manifest file doesn't exist.
 */
export function getJuliaManifestFile(juliaProject: string): string {
  let juliaManifestFile: string = ""

  let juliaProjectDir: string
  if (fs.existsSync(juliaProject) && fs.lstatSync(juliaProject).isFile()) {
    juliaProjectDir = path.basename(juliaProject)
  } else {
    juliaProjectDir = juliaProject
  }

  for (const filename of ["JuliaManifest.toml", "Manifest.toml"]) {
    const p = path.join(juliaProjectDir, filename)
    if (fs.existsSync(p) && fs.lstatSync(p).isFile()) {
      juliaManifestFile = p
      break
    }
  }

  if (!juliaManifestFile) {
    throw new Error(
      `Unable to locate Julia manifest file with project: ${juliaProject}`
    )
  }

  return juliaManifestFile
}

/**
 * Determine the NPM semver range string from a parsed Julia project TOML.
 *
 * @returns A NPM semver range string.
 * @throws Error if the Julia compat range cannot be converted into a NPM semver range.
 */
export function getJuliaCompatRange(juliaProject: JuliaProjectTOML): string {
  let compatRange: string | null

  if (juliaProject.compat?.julia !== undefined) {
    compatRange = validJuliaCompatRange(juliaProject.compat.julia)
  } else {
    compatRange = "*"
  }

  if (!compatRange) {
    throw new Error(
      `Invalid version range found in Julia compat: ${compatRange}`
    )
  }

  return compatRange
}

/**
 * Convert a Julia compat range into a NPM semver range.
 *
 * @returns An NPM semver range string or null if the input is invalid.
 */
export function validJuliaCompatRange(compatRange: string): string | null {
  const ranges: Array<string> = []
  for (let range of compatRange.split(",")) {
    range = range.trim()

    // An empty range isn't supported by Julia
    if (!range) {
      return null
    }

    // NPM's semver doesn't understand unicode characters such as `≥` so we'll
    // convert to alternatives.
    range = range.replace("≥", ">=").replace("≤", "<=")

    // Cleanup whitespace. Julia only allows whitespace between the specifier
    // and version with certain specifiers.
    range = range.replace(/\s+/g, " ").replace(/(?<=(>|>=|≥|<)) (?=\d)/g, "")

    if (
      !semver.validRange(range) ||
      range.split(/(?<! -) (?!- )/).length > 1 ||
      range.startsWith("<=") ||
      range === "*"
    ) {
      return null
    } else if (range.search(/^\d/) === 0 && !range.includes(" ")) {
      // Compat version is just a basic version number (e.g. 1.2.3). Since
      // Julia's Pkg.jl's uses caret as the default specifier
      // (e.g. `1.2.3 == ^1.2.3`) and NPM's semver uses tilde as the default
      // specifier (e.g. `1.2.3 == 1.2.x == ~1.2.3`) we will introduce the
      // caret specifier to ensure the orignal intent is respected.
      // https://pkgdocs.julialang.org/v1/compatibility/#Version-specifier-format
      // https://github.com/npm/node-semver#x-ranges-12x-1x-12-
      range = "^" + range
    }

    ranges.push(range)
  }

  return semver.validRange(ranges.join(" || "))
}
