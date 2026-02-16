import { DEFAULT_MCP_PORT } from "@nasty-plot/core"

const LOCALHOST_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/

function resolveAndValidateMcpUrl(): string {
  const url = process.env.MCP_URL || `http://localhost:${DEFAULT_MCP_PORT}/mcp`
  if (!LOCALHOST_PATTERN.test(url)) {
    throw new Error(
      `MCP_URL must be a localhost URL (http://localhost:* or http://127.0.0.1:*), ` +
        `got: "${url}"`,
    )
  }
  return url
}

export const MCP_URL = resolveAndValidateMcpUrl()
export const MODEL = process.env.LLM_MODEL || process.env.OPENAI_MODEL || "claude-opus-4-6"
