import { DEFAULT_MCP_PORT } from "@nasty-plot/core"
import express from "express"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import { registerTools } from "./tools/index.js"
import { registerResources } from "./resources/index.js"

const app = express()
app.use(express.json())

/** Create a fresh McpServer instance with all tools and resources registered. */
function createServer(): McpServer {
  const server = new McpServer({
    name: "nasty-plot",
    version: "0.1.0",
  })
  registerTools(server)
  registerResources(server)
  return server
}

const transports = new Map<
  string,
  { transport: StreamableHTTPServerTransport; server: McpServer }
>()

function getSessionTransport(
  req: express.Request,
  res: express.Response,
): StreamableHTTPServerTransport | null {
  const sessionId = req.headers["mcp-session-id"] as string | undefined
  const session = sessionId ? transports.get(sessionId) : undefined
  if (!session) {
    res.status(400).json({ error: "Invalid or missing session ID" })
    return null
  }
  return session.transport
}

app.post("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined

  const existingSession = sessionId ? transports.get(sessionId) : undefined
  if (existingSession) {
    await existingSession.transport.handleRequest(req, res, req.body)
    return
  }

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => `session-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  })

  const server = createServer()

  transport.onclose = () => {
    if (transport.sessionId) {
      transports.delete(transport.sessionId)
    }
  }

  await server.connect(transport)
  await transport.handleRequest(req, res, req.body)

  if (transport.sessionId) {
    transports.set(transport.sessionId, { transport, server })
  }
})

app.get("/mcp", async (req, res) => {
  const transport = getSessionTransport(req, res)
  if (!transport) return
  await transport.handleRequest(req, res)
})

app.delete("/mcp", async (req, res) => {
  const transport = getSessionTransport(req, res)
  if (!transport) return
  await transport.handleRequest(req, res)
  const sessionId = req.headers["mcp-session-id"] as string
  transports.delete(sessionId)
})

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    tools: 24,
    resources: 5,
    activeSessions: transports.size,
  })
})

const PORT = process.env.MCP_PORT || DEFAULT_MCP_PORT
app.listen(Number(PORT), () => {
  console.log(`MCP server running on http://localhost:${PORT}/mcp`)
  console.log(`Health check: http://localhost:${PORT}/health`)
})
