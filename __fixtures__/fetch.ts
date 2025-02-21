import { jest } from "@jest/globals"

export const fetch = jest.fn<typeof import("../src/fetch.js").fetch>()
