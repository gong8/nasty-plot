import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerTools } from "./tools/index.js";
import { registerResources } from "./resources/index.js";

const app = express();
app.use(express.json());

const server = new McpServer({
  name: "nasty-plot",
  version: "0.1.0",
});

registerTools(server);
registerResources(server);

// Map of session ID to transport for stateful connections
const transports = new Map<string, StreamableHTTPServerTransport>();

app.post("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (sessionId && transports.has(sessionId)) {
    // Reuse existing transport for this session
    const transport = transports.get(sessionId)!;
    await transport.handleRequest(req, res, req.body);
    return;
  }

  // New session - create a new transport
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () =>
      `session-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  });

  transport.onclose = () => {
    if (transport.sessionId) {
      transports.delete(transport.sessionId);
    }
  };

  // Connect the server to this transport
  await server.connect(transport);

  // Store the transport by session ID after handling the init request
  await transport.handleRequest(req, res, req.body);

  if (transport.sessionId) {
    transports.set(transport.sessionId, transport);
  }
});

app.get("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId || !transports.has(sessionId)) {
    res.status(400).json({ error: "Invalid or missing session ID" });
    return;
  }
  const transport = transports.get(sessionId)!;
  await transport.handleRequest(req, res);
});

app.delete("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId || !transports.has(sessionId)) {
    res.status(400).json({ error: "Invalid or missing session ID" });
    return;
  }
  const transport = transports.get(sessionId)!;
  await transport.handleRequest(req, res);
  transports.delete(sessionId);
});

// Health check
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    tools: 24,
    resources: 5,
    activeSessions: transports.size,
  });
});

const PORT = process.env.MCP_PORT || 3001;
app.listen(Number(PORT), () => {
  console.log(`MCP server running on http://localhost:${PORT}/mcp`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
