# @nasty-plot/llm

OpenAI/Claude chat service with MCP tool integration, session management, context builders, and streaming support.

## Key Exports

- **Chat** -- `streamChat()`, `streamCliChat()`
- **Sessions** -- `createSession()`, `getSession()`, `listSessions()`, `addMessage()`, `updateSession()`, `deleteSession()`
- **Context Builders** -- `buildTeamContext()`, `buildMetaContext()`, `buildPokemonContext()`, `buildPageContextPrompt()`
- **Battle Context** -- `buildTurnCommentaryContext()`, `buildPostBattleContext()`, `buildTurnAnalysisContext()`
- **MCP Client** -- `getMcpTools()`, `executeMcpTool()`, `getMcpResourceContext()`, `disconnectMcp()`
- **Tool Helpers** -- `getToolLabel()`, `isWriteTool()`, `TOOL_CATEGORIES`, `getDisallowedMcpTools()`
- **OpenAI Client** -- `getOpenAI()`, `MODEL`

## Dependencies

- `@nasty-plot/core`, `@nasty-plot/db`, `@nasty-plot/teams`, `@nasty-plot/smogon-data`, `@nasty-plot/battle-engine`
- `openai`, `@modelcontextprotocol/sdk`

## Usage

```typescript
import { streamChat, createSession } from "@nasty-plot/llm"

const session = await createSession({ teamId })
const stream = await streamChat(session.id, "What are good teammates for Great Tusk?")
```
