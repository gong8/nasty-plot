const API_BASE = process.env.API_URL || "http://localhost:3000/api";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

async function apiFetch(
  method: HttpMethod,
  path: string,
  options?: { params?: Record<string, string>; body?: unknown }
): Promise<unknown> {
  const url = new URL(path, API_BASE);
  if (options?.params) {
    for (const [key, value] of Object.entries(options.params)) {
      url.searchParams.set(key, value);
    }
  }

  const init: RequestInit = { method };
  if (options?.body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(options.body);
  }

  const res = await fetch(url.toString(), init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

export function apiGet(
  path: string,
  params?: Record<string, string>
): Promise<unknown> {
  return apiFetch("GET", path, { params });
}

export function apiPost(path: string, body: unknown): Promise<unknown> {
  return apiFetch("POST", path, { body });
}

export function apiPut(path: string, body: unknown): Promise<unknown> {
  return apiFetch("PUT", path, { body });
}

export function apiDelete(path: string): Promise<unknown> {
  return apiFetch("DELETE", path);
}
