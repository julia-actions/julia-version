// import { Response } from "@types/node-fetch"
// import node_fetch from "node-fetch"
import * as fs from "fs"

export type Response = {
  status: number
  statusText?: string
  ok: boolean
  text(): Promise<string>
  headers: {
    get(name: string): string | null
  }
}

export async function fetch(url: string, init?: { method: string }): Promise<Response> {
  // return node_fetch(url, init)
  return Promise.resolve<Response>({
    text: () => Promise.resolve<string>(fs.readFileSync("__fixtures__/versions-org.json").toString()),
    ok: true,
    status: 200,
    headers: {
      get: () => null
    }
  })
}
