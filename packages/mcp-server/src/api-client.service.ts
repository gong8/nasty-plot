import { createApiClient, DEFAULT_API_URL } from "@nasty-plot/core"

const API_BASE = process.env.API_URL || `${DEFAULT_API_URL}/api`

const client = createApiClient(API_BASE)

export function apiGet(path: string, params?: Record<string, string>): Promise<unknown> {
  return client.get(path, params)
}

export function apiPost(path: string, body: unknown): Promise<unknown> {
  return client.post(path, body)
}

export function apiPut(path: string, body: unknown): Promise<unknown> {
  return client.put(path, body)
}

export function apiDelete(path: string): Promise<unknown> {
  return client.del(path)
}
