# MCP Chat Agent Integration

Replace the hardcoded OpenAI chat agent with a Claude-powered MCP client that dynamically discovers all tools from the MCP server.

## Current Architecture

- **LLM Provider**: OpenAI API (Chat Completions, pay-per-token)
- **Tool Definitions**: 5 tools hardcoded as JSON schemas in the chat service
- **Tool Execution**: Manual switch/case that calls Next.js API routes directly via fetch
- **MCP Server**: 24 tools, running separately, completely disconnected from the chat agent
- **Result**: Two parallel systems doing similar things, no shared code, 19 tools missing from the agent

## Target Architecture

- **LLM Provider**: Claude via `claude-max-api-proxy` (localhost:3456, OpenAI-compatible format, powered by Max subscription)
- **Tool Definitions**: Dynamically discovered from MCP server at startup — zero hardcoded schemas
- **Tool Execution**: Routed through MCP — the chat service calls the MCP server, which calls the API routes
- **Result**: Single source of truth. Add a tool to the MCP server, the agent gets it automatically.

## The Two Changes

### 1. Swap the LLM provider

Replace the OpenAI API client with one pointing at `localhost:3456`. Since `claude-max-api-proxy` is OpenAI-format-compatible, this is mostly a base URL + model name change. The streaming format, tool call format, and message structure all stay the same. Existing streaming SSE logic carries over.

### 2. Make the chat service an MCP client

This is the real architectural win. Instead of:

```
Agent -> hardcoded 5 tools -> manual switch/case -> fetch(/api/...)
```

It becomes:

```
Agent -> MCP client discovers 24 tools -> converts to OpenAI function schema ->
  on tool call -> forwards to MCP server -> MCP server calls /api/... -> result back
```

At startup, the chat service:

1. Opens an MCP client connection to `localhost:3001`
2. Calls `listTools()` to get all 24 tool definitions (names, descriptions, Zod schemas)
3. Converts them to OpenAI function-calling format (Zod -> JSON Schema is straightforward)
4. Passes them to the LLM with each request

When the LLM wants to call a tool:

1. The chat service receives the tool call from the streaming response
2. Instead of a switch/case, it forwards the call to the MCP server via `callTool(name, args)`
3. MCP server executes it (hitting API routes as it already does)
4. Result comes back, gets sent to the LLM as the tool response

## What Gets Deleted

- The hardcoded `tools` array (5 manual JSON schemas)
- The entire `executeTool()` switch/case function
- The direct fetch calls to API routes from the chat service

## What Gets Added

- An MCP client connection (using `@modelcontextprotocol/sdk/client`)
- A function to convert MCP tool schemas to OpenAI function-calling format
- A generic tool executor that proxies any tool call through MCP

## Net Effect

- **Less code** overall (generic MCP client replaces per-tool boilerplate)
- **24 tools** instead of 5, automatically
- **Zero duplication** between MCP server and chat service
- **No API costs** (Max plan via proxy)
- **Future-proof** — new MCP tools are immediately available to the agent

## Key Dependencies

- `claude-max-api-proxy` (npm package, runs on localhost:3456)
- `@modelcontextprotocol/sdk` (already in the project for the MCP server)
- Active Claude Max subscription with Claude Code CLI authenticated

## Risk / Caveats

- `claude-max-api-proxy` is a community tool, not officially supported by Anthropic
- ToS gray area — programmatic use of Max subscription outside intended interfaces
- Session stability — container restarts require manual re-authentication (OAuth flow)
- Only suitable for personal/dev use, not for serving other users at scale

## Phase 2: Frontend Polish

The chat UI (`apps/web/src/app/chat/` and `apps/web/src/features/chat/`) was built for 5 hardcoded tools. With 24 dynamically discovered tools, the frontend needs updates:

- **Tool name display**: MCP tool names like `get_moves_by_criteria` need friendly labels in the chat UI
- **Tool status indicators**: Better visual feedback during tool execution (currently just "executing"/"complete")
- **Tool result previews**: Structured display of tool results (e.g. Pokemon stat tables, damage calc summaries) instead of raw JSON
- **Tool categories**: Group the 24 tools by category (data lookup, analysis, team management, meta) in any tool picker UI
