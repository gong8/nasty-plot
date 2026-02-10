import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type OpenAI from "openai";

const MCP_URL = process.env.MCP_URL || "http://localhost:3001/mcp";

let _client: Client | null = null;
let _resourceContext: string | null = null;

// Static resource URIs to load at connect time
const RESOURCE_URIS = [
  "pokemon://type-chart",
  "pokemon://formats",
  "pokemon://natures",
  "pokemon://stat-formulas",
];

async function getClient(): Promise<Client> {
  if (_client) return _client;

  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL));
  const client = new Client({ name: "nasty-plot-chat", version: "1.0.0" });

  await client.connect(transport);
  _client = client;
  return client;
}

function resetClient(): void {
  _client = null;
  _resourceContext = null;
}

/**
 * Discover all tools from the MCP server and convert to OpenAI function-calling format.
 * Returns [] if the MCP server is unavailable.
 */
export async function getMcpTools(): Promise<OpenAI.ChatCompletionTool[]> {
  try {
    const client = await getClient();
    const { tools } = await client.listTools();

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
    }));
  } catch (error) {
    console.warn(
      `[mcp-client] Failed to discover tools: ${error instanceof Error ? error.message : "Unknown error"}. Chat will work without tools.`,
    );
    return [];
  }
}

/**
 * Execute a tool via the MCP server. Retries once on connection failure.
 */
export async function executeMcpTool(
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  async function call(): Promise<string> {
    const client = await getClient();
    const result = await client.callTool({ name, arguments: args });

    // MCP returns content as an array of { type, text } blocks
    const textParts = (result.content as { type: string; text?: string }[])
      .filter((c) => c.type === "text" && c.text)
      .map((c) => c.text!);

    return textParts.join("\n") || JSON.stringify(result.content);
  }

  try {
    return await call();
  } catch (error) {
    // Retry once after resetting connection
    console.warn(
      `[mcp-client] Tool call "${name}" failed, retrying: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
    resetClient();
    try {
      return await call();
    } catch (retryError) {
      return JSON.stringify({
        error: `MCP tool "${name}" failed: ${retryError instanceof Error ? retryError.message : "Unknown error"}`,
      });
    }
  }
}

/**
 * Load static resources from the MCP server and format as context for the system prompt.
 * Cached after first load. Returns "" if unavailable.
 */
export async function getMcpResourceContext(): Promise<string> {
  if (_resourceContext !== null) return _resourceContext;

  try {
    const client = await getClient();
    const parts: string[] = [];

    for (const uri of RESOURCE_URIS) {
      try {
        const resource = await client.readResource({ uri });
        const text = resource.contents
          .map((c) => ("text" in c ? c.text : ""))
          .join("\n");

        if (text) {
          const label = uri.replace("pokemon://", "").replace(/-/g, " ");
          parts.push(`## ${label}\n${text}`);
        }
      } catch {
        // Individual resource failures are fine
      }
    }

    _resourceContext = parts.length > 0
      ? "\n# Reference Data\n\n" + parts.join("\n\n")
      : "";

    return _resourceContext;
  } catch {
    _resourceContext = "";
    return "";
  }
}

/**
 * Disconnect the MCP client (for cleanup/testing).
 */
export async function disconnectMcp(): Promise<void> {
  if (_client) {
    try {
      await _client.close();
    } catch {
      // Ignore close errors
    }
  }
  resetClient();
}
