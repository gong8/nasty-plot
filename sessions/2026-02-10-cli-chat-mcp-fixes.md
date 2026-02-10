# Session: CLI Chat & MCP Pipeline Fixes

**Date:** 2026-02-10
**Duration context:** Long (continued from a prior session that ran out of context)

## What was accomplished

- **Fixed the core chat pipeline**: The in-app LLM chat now successfully makes MCP tool calls via the Claude CLI, bypassing the broken `claude-max-api-proxy` which strips all tool definitions
- **Fixed MCP server multi-session bug**: Server could only handle one client at a time; now creates a fresh `McpServer` per HTTP session
- **Fixed MCP API client URL construction**: `new URL("/path", "http://localhost:3000/api")` was silently dropping the `/api` prefix, causing all MCP tools to hit Next.js page routes (HTML) instead of API routes (JSON)
- **Fixed Prisma 7 + Node 25 ESM issue**: Added `{ "type": "module" }` to `generated/prisma/package.json` so extensionless imports resolve correctly
- **Seeded the database**: All 8 competitive formats now have usage stats, Smogon sets, teammate correlations, and checks/counters
- **Improved MCP tool error messages**: Errors now include actual error details instead of misleading "Could not find Pokemon" messages
- **Made `suggest_sets` formatId required**: The API requires it but the tool schema said it was optional, causing silent 400 errors
- **Added system prompt guardrails**: CLI chat model is explicitly told to only use MCP tools, never code tools

## Key decisions & rationale

- **CLI mode over proxy**: `claude-max-api-proxy` fundamentally cannot support tool calls (text-in/text-out pipe). The new `cli-chat.ts` spawns `claude` directly with `--mcp-config` so the CLI handles tool discovery and execution natively
- **`--strict-mcp-config`**: Prevents the CLI from loading the user's global MCP servers (Serena, Linear, Playwright, etc.) which were polluting the tool namespace
- **`--disallowedTools` for code tools**: Blocks Bash, Read, Write, Edit, Glob, Grep, etc. so the model can only use MCP tools for data lookups
- **Temp dir as cwd**: Spawning the CLI from `/tmp/nasty-plot-cli/` instead of the project root prevents it from loading `CLAUDE.md` as project instructions (which taught the model about the codebase and caused it to try grepping source code)
- **`--max-turns 50`**: Initially set to 10, reduced to 5 (too aggressive — model couldn't finish adding Pokemon to teams), then bumped to 50. The guardrails (no code tools, no CLAUDE.md, strict MCP) make high turn counts safe
- **Per-session McpServer**: The MCP SDK's `McpServer.connect()` binds to a single transport. For multi-client HTTP, each session needs its own server instance with tools/resources registered

## Bugs found & fixed

### 1. `claude-max-api-proxy` strips tools (root cause of original slowness)

- **Symptom**: 165-second response times, zero tool calls
- **Cause**: The proxy's `openaiToCli()` function ignores `request.tools`, and `cliToOpenai()` never emits `delta.tool_calls`
- **Fix**: Bypass the proxy entirely; spawn `claude` CLI directly with `--mcp-config`

### 2. MCP server "Already connected to a transport" crash

- **Symptom**: CLI reported `mcp_servers: [{"name":"nasty-plot","status":"failed"}]`
- **Cause**: Single `McpServer` instance with `server.connect(transport)` called per session — but `connect()` can only bind once
- **Fix**: `createServer()` factory function that creates a fresh `McpServer` per session (`packages/mcp-server/src/index.ts`)

### 3. API client URL dropping `/api` prefix

- **Symptom**: MCP tools returned "Could not find Pokemon" even though `@pkmn/dex` has the data
- **Cause**: `new URL("/pokemon/pecharunt", "http://localhost:3000/api")` resolves to `http://localhost:3000/pokemon/pecharunt` (URL spec: absolute paths override base path). Tools were hitting Next.js page routes (HTML) instead of API routes (JSON)
- **Fix**: String concatenation instead of `new URL(path, base)` in `packages/mcp-server/src/api-client.ts`

### 4. Prisma 7 generated client ESM resolution failure

- **Symptom**: `SyntaxError: The requested module '../../../generated/prisma/client' does not provide an export named 'PrismaClient'`
- **Cause**: Generated `.ts` files use extensionless imports (`./enums` not `./enums.ts`); no `package.json` with `"type": "module"` in the generated directory; Node 25 defaults to CJS resolution
- **Fix**: Added `generated/prisma/package.json` with `{ "type": "module" }`. Updated `db:generate` script to recreate it after each `prisma generate`

### 5. `suggest_sets` optional formatId causing silent 400s

- **Symptom**: Tool returned generic error; model thought Pokemon didn't exist
- **Cause**: MCP tool schema marked `formatId` as optional, but the API route returns 400 without it
- **Fix**: Made `formatId` required in the tool schema

## Pitfalls & gotchas encountered

- **`handleTool` swallows errors**: The generic error messages ("Could not find Pokemon") made it impossible to diagnose issues. The actual errors (HTML parse failure, 400 missing param) were hidden. Now includes the real error detail.
- **`new URL()` base path behavior**: This is a well-known footgun. `new URL("/foo", "http://host/bar")` gives `http://host/foo`, not `http://host/bar/foo`. Always use string concatenation for path joining.
- **`--verbose` required with `--output-format stream-json`**: The CLI silently requires this flag combination. Without `--verbose`, the CLI hangs with no output.
- **MCP config needs `"type": "http"`**: The config `{"mcpServers":{"name":{"url":"..."}}}` silently fails. Must include `"type": "http"`.
- **Model hallucination on partial tool failures**: When 3 of 5 tools return errors, the model concludes the Pokemon doesn't exist — even if `get_pokemon` succeeded with full data. Better error messages help but this is fundamentally a model behavior issue.

## Files changed

- `packages/mcp-server/src/index.ts` — Per-session McpServer creation
- `packages/mcp-server/src/api-client.ts` — Fixed URL construction
- `packages/mcp-server/src/tool-helpers.ts` — Error messages include actual error detail
- `packages/mcp-server/src/tools/data-query.ts` — Improved error messages
- `packages/mcp-server/src/tools/meta-recs.ts` — Made `suggest_sets` formatId required, improved errors
- `packages/llm/src/cli-chat.ts` — New CLI-based chat (created in prior session, refined here: added `--strict-mcp-config`, temp dir cwd, `--setting-sources ""`, system prompt guardrails, max-turns 50)
- `packages/llm/src/chat.service.ts` — CLI mode detection and routing (created in prior session)
- `packages/llm/src/index.ts` — Added `streamCliChat` export
- `packages/llm/package.json` — Added `@types/node` devDep
- `generated/prisma/package.json` — ESM module type for generated Prisma client
- `package.json` — Updated `db:generate` script to preserve ESM package.json

## Known issues & next steps

- **Pecharunt is rank 9 in OU with 14.8% usage** but only has 2 Smogon sets (Pivot, Nasty Plot). The model may need to supplement with its own knowledge for detailed spreads
- **`get_common_cores` is a fake tool**: It just returns usage stats with a note to "filter for cores" — doesn't actually compute teammate correlations. The `TeammateCorr` table has real data that could power this properly
- **`get_type_matchups` is redundant**: It calls `/api/pokemon/{id}` and extracts types, then tells the model to "use the type chart resource." Could compute actual matchups inline
- **No `add_pokemon_to_team` logs visible**: The model creates teams but the session ended before confirming Pokemon were added. Need to verify full team creation end-to-end
- **Cost tracking**: CLI mode reports `cost=n/a` in logs (the `cost_usd` field from the result message). May need to parse `total_cost_usd` instead
- **`--setting-sources ""`**: This was added to prevent loading user settings but untested whether it actually works. Monitor for side effects

## Tech notes

- **CLI chat architecture**: `cli-chat.ts` spawns `claude --print --output-format stream-json` with MCP config, parses NDJSON stream, converts to SSE format for the frontend. Key message types: `stream_event` (content deltas), `assistant` (tool_use blocks), `user` (tool results), `result` (final summary)
- **`USE_CLI` detection**: Auto-enables when `LLM_BASE_URL` includes `localhost:3456` (proxy) or `LLM_PROVIDER=cli`. Falls back to OpenAI path otherwise
- **MCP server session management**: Each POST without `mcp-session-id` header creates a new session (server + transport pair). Subsequent requests with the session ID reuse the existing transport. Sessions are cleaned up on transport close.
- **Prisma 7 generates `.ts` files**: Unlike Prisma 5/6 which generated `.js`+`.d.ts`, Prisma 7 generates TypeScript directly. This requires the generated directory to have ESM module resolution configured.
- **`@pkmn/dex` confirms Pecharunt exists**: `Dex.forGen(9).species.get("pecharunt")` returns `{ exists: true, types: ["Poison", "Ghost"], ... }`. The data layer is fine; all prior failures were in the MCP→API→DB pipeline.
- **DB seed results**: gen9ou (312 Pokemon), gen9doublesou (370), plus gen9uu, gen9ru, gen9nu, gen9monotype, gen9vgc2024, gen9vgc2025. Pecharunt has usage stats in gen9ou (rank 9) and gen9doublesou (rank 82), plus 4 Smogon sets.
