import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import type OpenAI from "openai"
import { MCP_URL } from "./config"

const LOG_PREFIX = "[mcp-client]"

function logTiming(label: string, startMs: number, extra?: string): void {
  const elapsed = (performance.now() - startMs).toFixed(0)
  const suffix = extra ? ` ${extra}` : ""
  console.log(`${LOG_PREFIX} ${label} (${elapsed}ms)${suffix}`)
}

let _client: Client | null = null
let _resourceContext: string | null = null

// Static resource URIs to load at connect time
const RESOURCE_URIS = [
  "pokemon://type-chart",
  "pokemon://formats",
  "pokemon://natures",
  "pokemon://stat-formulas",
]

async function getClient(): Promise<Client> {
  if (_client) return _client

  const t0 = performance.now()
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL))
  const client = new Client({ name: "nasty-plot-chat", version: "1.0.0" })

  await client.connect(transport)
  _client = client
  logTiming("Connected to MCP server", t0)
  return client
}

function resetClient(): void {
  _client = null
  _resourceContext = null
}

/**
 * Discover all tools from the MCP server and convert to OpenAI function-calling format.
 * Returns [] if the MCP server is unavailable.
 */
export async function getMcpTools(): Promise<OpenAI.ChatCompletionTool[]> {
  try {
    const t0 = performance.now()
    const client = await getClient()
    const { tools } = await client.listTools()
    logTiming("Listed tools", t0, `— ${tools.length} tools`)

    return tools.map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description ?? "",
        parameters: (tool.inputSchema as Record<string, unknown>) ?? {
          type: "object",
          properties: {},
        },
      },
    }))
  } catch (error) {
    console.warn(
      `${LOG_PREFIX} Failed to discover tools: ${error instanceof Error ? error.message : "Unknown error"}. Chat will work without tools.`,
    )
    return []
  }
}

/**
 * Execute a tool via the MCP server. Retries once on connection failure.
 */
export async function executeMcpTool(name: string, args: Record<string, unknown>): Promise<string> {
  const argsSummary = JSON.stringify(args).slice(0, 200)
  console.log(`${LOG_PREFIX} ▶ Tool call: ${name}(${argsSummary})`)

  async function call(): Promise<string> {
    const t0 = performance.now()
    const client = await getClient()
    const result = await client.callTool({ name, arguments: args })

    // MCP returns content as an array of { type, text } blocks
    const textParts = (result.content as { type: string; text?: string }[])
      .filter((c) => c.type === "text" && c.text)
      .map((c) => c.text!)

    const response = textParts.join("\n") || JSON.stringify(result.content)
    logTiming(`◀ Tool result: ${name}`, t0, `— ${response.length} chars`)
    return response
  }

  try {
    return await call()
  } catch (error) {
    console.warn(
      `${LOG_PREFIX} Tool call "${name}" failed, retrying: ${error instanceof Error ? error.message : "Unknown error"}`,
    )
    resetClient()
    try {
      return await call()
    } catch (retryError) {
      console.error(
        `${LOG_PREFIX} Tool call "${name}" failed after retry: ${retryError instanceof Error ? retryError.message : "Unknown error"}`,
      )
      return JSON.stringify({
        error: `MCP tool "${name}" failed: ${retryError instanceof Error ? retryError.message : "Unknown error"}`,
      })
    }
  }
}

/**
 * Load static resources from the MCP server and format as context for the system prompt.
 * Cached after first load. Returns "" if unavailable.
 */
export async function getMcpResourceContext(): Promise<string> {
  if (_resourceContext !== null) {
    console.log(`${LOG_PREFIX} Resource context: cached`)
    return _resourceContext
  }

  try {
    const t0 = performance.now()
    const client = await getClient()
    const parts: string[] = []

    for (const uri of RESOURCE_URIS) {
      try {
        const tRes = performance.now()
        const resource = await client.readResource({ uri })
        const text = resource.contents.map((c) => ("text" in c ? c.text : "")).join("\n")

        if (text) {
          const label = uri.replace("pokemon://", "").replace(/-/g, " ")
          parts.push(`## ${label}\n${text}`)
          logTiming(`Resource: ${uri}`, tRes, `— ${text.length} chars`)
        }
      } catch (err) {
        console.warn(
          `${LOG_PREFIX} Resource ${uri} failed: ${err instanceof Error ? err.message : "Unknown"}`,
        )
      }
    }

    _resourceContext = parts.length > 0 ? "\n# Reference Data\n\n" + parts.join("\n\n") : ""

    logTiming("All resources loaded", t0, `— ${_resourceContext.length} chars total`)
    return _resourceContext
  } catch {
    _resourceContext = ""
    return ""
  }
}

/**
 * Disconnect the MCP client (for cleanup/testing).
 */
export async function disconnectMcp(): Promise<void> {
  if (_client) {
    try {
      await _client.close()
    } catch {
      // Ignore close errors
    }
  }
  resetClient()
}
