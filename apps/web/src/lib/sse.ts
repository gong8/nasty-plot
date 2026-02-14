const SSE_DATA_PREFIX = "data: "

/**
 * Async generator that reads a ReadableStream of SSE data and yields
 * parsed JSON objects from lines prefixed with "data: ".
 *
 * Skips non-data lines, "[DONE]" sentinels, and unparseable JSON.
 */
export async function* readSSEEvents<T = Record<string, unknown>>(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<T> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""

    for (const line of lines) {
      if (!line.startsWith(SSE_DATA_PREFIX)) continue
      const payload = line.slice(SSE_DATA_PREFIX.length)
      if (payload === "[DONE]") return
      try {
        yield JSON.parse(payload) as T
      } catch {
        // Skip non-JSON
      }
    }
  }
}
