import { DEFAULT_MCP_PORT } from "@nasty-plot/core"

export const MCP_URL = process.env.MCP_URL || `http://localhost:${DEFAULT_MCP_PORT}/mcp`
export const MODEL = process.env.LLM_MODEL || process.env.OPENAI_MODEL || "claude-opus-4-6"
