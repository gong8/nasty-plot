export interface ApiClient {
  get<T>(path: string, params?: Record<string, string>): Promise<T>
  post<T>(path: string, body: unknown): Promise<T>
  put<T>(path: string, body: unknown): Promise<T>
  del<T>(path: string): Promise<T>
}

export function createApiClient(baseUrl?: string): ApiClient {
  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
    params?: Record<string, string>,
  ): Promise<T> {
    let url: URL
    if (baseUrl) {
      const base = baseUrl.replace(/\/+$/, "")
      const cleanPath = path.startsWith("/") ? path : `/${path}`
      url = new URL(`${base}${cleanPath}`)
    } else {
      const origin =
        typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"
      const cleanPath = path.startsWith("/") ? path : `/${path}`
      url = new URL(cleanPath, origin)
    }

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value)
      }
    }

    const init: RequestInit = { method }
    if (body !== undefined) {
      init.headers = { "Content-Type": "application/json" }
      init.body = JSON.stringify(body)
    }

    const res = await fetch(url.toString(), init)
    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({ error: res.statusText }))
      const detail = errorBody.error || res.statusText
      throw new Error(`API error ${res.status}: ${detail}`)
    }
    return res.json()
  }

  return {
    get: <T>(path: string, params?: Record<string, string>) =>
      request<T>("GET", path, undefined, params),
    post: <T>(path: string, body: unknown) => request<T>("POST", path, body),
    put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
    del: <T>(path: string) => request<T>("DELETE", path),
  }
}
