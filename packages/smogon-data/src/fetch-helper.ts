export async function fetchSmogonData(url: string): Promise<Response> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status} ${res.statusText} (${url})`)
  return res
}
