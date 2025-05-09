import * as fs from "node:fs"
import * as path from "node:path"
import * as url from "node:url"

export const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
export const versionsJsonFile = path.join(
  __dirname,
  "..",
  "__fixtures__",
  "versions.json"
)

export const projectDirV1 = path.join(
  __dirname,
  "..",
  "__fixtures__",
  "julia-manifest-v1"
)

export const projectDirV2 = path.join(
  __dirname,
  "..",
  "__fixtures__",
  "julia-manifest-v2"
)

export const testVersions = Object.keys(
  JSON.parse(fs.readFileSync(versionsJsonFile).toString())
)
