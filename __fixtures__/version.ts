import { jest } from "@jest/globals"
import * as v from "../src/version.js"
// import * as version from "../src/version.js"

// TODO: I would ideally like to mock node-fetch directly
export const getJuliaVersionInfo =
  jest.fn<typeof import("../src/version.js").getJuliaVersionInfo>()

export const resolveJuliaVersion = v.resolveJuliaVersion

export const genNightlies =
  jest.fn<typeof import("../src/version.js").genNightlies>()
