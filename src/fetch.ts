// import { Response } from "@types/node-fetch"
import node_fetch from "node-fetch"

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
	return node_fetch(url, init)
}
