import type { ApiResponse } from "@nasty-plot/core"

/**
 * Fetch JSON from a URL, throwing on non-ok responses with the error message
 * extracted from the response body.
 */
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(body.error || res.statusText)
  }
  return res.json()
}

/**
 * Fetch from an API route that returns `ApiResponse<T>` and unwrap to `T`.
 */
export async function fetchApiData<T>(url: string, init?: RequestInit): Promise<T> {
  const json = await fetchJson<ApiResponse<T>>(url, init)
  return json.data
}

/**
 * POST JSON to a URL and return the parsed response.
 */
export async function postJson<T>(url: string, body: unknown): Promise<T> {
  return fetchJson<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

/**
 * PUT JSON to a URL and return the parsed response.
 */
export async function putJson<T>(url: string, body: unknown): Promise<T> {
  return fetchJson<T>(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

/**
 * POST JSON to an API route that returns `ApiResponse<T>` and unwrap to `T`.
 */
export async function postApiData<T>(url: string, body: unknown): Promise<T> {
  return fetchApiData<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}
