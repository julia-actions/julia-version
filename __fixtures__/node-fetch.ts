import type * as nf from "@types/node-fetch"
import { jest } from "@jest/globals"

export const fetch = jest.fn<typeof nf.fetch>()
