import { createApiClient, checkedFetch } from "@nasty-plot/core"
import type { ApiResponse } from "@nasty-plot/core"

const client = createApiClient()

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await checkedFetch(url, init)
  return res.json()
}

export async function fetchText(url: string, init?: RequestInit): Promise<string> {
  const res = await checkedFetch(url, init)
  return res.text()
}

export async function fetchApiData<T>(url: string, init?: RequestInit): Promise<T> {
  const json = await fetchJson<ApiResponse<T>>(url, init)
  return json.data
}

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  return client.post<T>(url, body)
}

export async function putJson<T>(url: string, body: unknown): Promise<T> {
  return client.put<T>(url, body)
}

export async function postApiData<T>(url: string, body: unknown): Promise<T> {
  const json = await client.post<ApiResponse<T>>(url, body)
  return json.data
}
