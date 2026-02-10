# Pecharunt Global Chat Sidebar & LLM UX Overhaul

## Context

The current chat system lives exclusively on `/chat` as a standalone page and is embedded as a Sheet sidebar on the team editor page. There's no session browsing UI, no way to stop/retry responses, and tool calls show as a basic spinner. This plan transforms Pecharunt into a persistent, Cursor-like AI assistant available on every page via a push sidebar, with chat history management and rich LLM interaction features.

**LLM Engine: Claude CLI only.** The OpenAI SDK path is deprecated. All chat goes through `spawn("claude", ...)` in `packages/llm/src/cli-chat.ts`. The CLI handles its own agent loop (tool discovery, execution, multi-turn) via `--mcp-config` pointing to the MCP server on port 3001. We parse `stream-json` output and convert to SSE events.

## Implementation Strategy

**Use parallel agents and agent teams aggressively.** This is a large feature touching frontend (sidebar, components, providers), backend (CLI integration, API routes, session management), and data (Prisma schema). When implementing:

- **Phase 1:** Team of 3+ agents -- one for AppShell/layout, one for ChatProvider/state, one for removing SiteHeader from all pages
- **Phase 2:** Team of 2+ agents -- one for backend (session service, API routes, title generation), one for frontend (session list components, hooks)
- **Phase 3:** Team of 2+ agents -- one for PageContextProvider + context builders, one for cli-chat.ts changes (tool filtering, system prompt composition)
- **Phase 4:** Team of 3+ agents -- one for SSE protocol + cli-chat.ts parsing, one for chat sub-components (message, tool card, input), one for use-chat-stream hook
- **Phase 5:** Team of 2+ agents -- one for stream parser + system prompt, one for plan display + action notification components
- **Phase 6:** Single agent -- small scope, just AppShell + ChatSidebar full-page mode

## Summary of Decisions

| Decision                 | Choice                                                              |
| ------------------------ | ------------------------------------------------------------------- |
| LLM engine               | Claude CLI subprocess only (drop OpenAI SDK path)                   |
| Sidebar style            | Push content (like Cursor)                                          |
| Sidebar width            | Resizable by user (drag edge, 300-600px)                            |
| Navigation behavior      | Same session persists, context updates silently                     |
| `/chat` page             | Becomes the sidebar in expanded full-width mode                     |
| Chat history (full page) | Left sidebar with session list                                      |
| Chat history (popout)    | Session switcher panel inside sidebar                               |
| Session titles           | LLM-generated from first message                                    |
| Tool display             | Collapsible cards with input/output                                 |
| Plan mode                | Auto for complex tasks (LLM decides), parsed from CLI stream        |
| Retry/regenerate         | Button on last assistant message                                    |
| Stop generation          | Abort button during streaming                                       |
| Agent actions            | Post-execution notify (CLI executes freely, UI shows what was done) |
| Open trigger             | FAB button + Cmd/Ctrl+L keyboard shortcut                           |
| Shortcut                 | Cmd/Ctrl+L                                                          |

---

## Phase 1: Foundation -- App Shell & Push Sidebar

**Goal:** Replace per-page header rendering with a unified `AppShell` that houses the push sidebar.

### Files to Create

1. **`apps/web/src/features/chat/context/chat-provider.tsx`** -- Core chat state provider
   - State: `isOpen`, `width` (persisted to localStorage), `activeSessionId`
   - Actions: `toggleSidebar`, `openSidebar`, `closeSidebar`, `setWidth`, `switchSession`, `newSession`
   - Uses `useReducer` for complex state transitions

2. **`apps/web/src/components/app-shell.tsx`** -- Layout orchestrator (client component)
   - Renders `<SiteHeader />` once at top
   - Flex container: `<main>` (with `margin-right` transition) + `<ChatSidebar />`
   - When `pathname === "/chat"`: hides `<main>`, renders sidebar in full-page mode
   - Registers `Cmd/Ctrl+L` keyboard shortcut

3. **`apps/web/src/components/chat-sidebar.tsx`** -- Right sidebar container
   - `position: fixed; top: 64px; right: 0; bottom: 0` in sidebar mode
   - `position: static; flex: 1` in full-page mode
   - Border-left, matches app background/glassmorphism

4. **`apps/web/src/components/chat-sidebar-resize-handle.tsx`** -- Draggable resize edge
   - 4px-wide absolute div on left edge of sidebar
   - `onPointerDown` -> `pointermove`/`pointerup` on document
   - Clamps width between 300px and min(600px, 50vw)
   - Persists to localStorage on drag end

5. **`apps/web/src/components/chat-fab.tsx`** -- Floating action button
   - Fixed `bottom-6 right-6 z-50`, Pecharunt sprite icon
   - Hidden on `/chat` route
   - Calls `toggleSidebar()` from ChatProvider

### Files to Modify

6. **`apps/web/src/app/layout.tsx`** -- Wrap children in `ChatProvider` + `AppShell`

   ```
   <Providers>
     <ChatProvider>
       <AppShell>{children}</AppShell>
     </ChatProvider>
   </Providers>
   ```

7. **Remove `<SiteHeader />` from all page components** (10+ files):
   - `apps/web/src/app/page.tsx`
   - `apps/web/src/app/chat/page.tsx`
   - `apps/web/src/app/pokemon/page.tsx`
   - `apps/web/src/app/pokemon/[id]/page.tsx`
   - `apps/web/src/app/teams/page.tsx`
   - `apps/web/src/app/teams/new/page.tsx`
   - `apps/web/src/app/teams/[teamId]/page.tsx` (also remove Sheet chat sidebar + FAB)
   - `apps/web/src/app/damage-calc/page.tsx`
   - `apps/web/src/app/battle/page.tsx`
   - `apps/web/src/app/battle/new/page.tsx`
   - `apps/web/src/app/battle/live/page.tsx`

### Key Implementation Detail

The push effect uses `margin-right` with CSS transition:

```css
.app-main {
  transition: margin-right 200ms ease-in-out;
}
```

The sidebar is `position: fixed` so it doesn't participate in the flow -- the margin creates the space. During resize drag, use `requestAnimationFrame` for smooth updates.

---

## Phase 2: Session Management & Chat History

**Goal:** Add session CRUD, browsable history, and auto-generated titles.

### DB Migration

8. **`prisma/schema.prisma`** -- Add `title` field to `ChatSession`:
   ```prisma
   model ChatSession {
     id        String   @id @default(uuid())
     teamId    String?
     title     String?              // NEW
     createdAt DateTime @default(now())
     updatedAt DateTime @updatedAt
     ...
   }
   ```
   Run: `pnpm exec prisma migrate dev --name add-chat-session-title`

### Files to Create

9. **`apps/web/src/features/chat/components/chat-session-list.tsx`** -- Session list panel
   - Scrollable list of sessions, sorted by `updatedAt` desc
   - Each item: title (or "New Chat"), relative timestamp, delete button
   - "New Chat" button at top
   - In full-page mode: persistent left panel (~260px wide)
   - In sidebar mode: collapsible panel toggled by a history icon button

10. **`apps/web/src/features/chat/hooks/use-chat-sessions.ts`** -- TanStack Query hook
    - `useQuery` for listing sessions
    - `useMutation` for create, delete, update title
    - Invalidates session list on mutations

### Files to Modify

11. **`packages/llm/src/chat-session.service.ts`** -- Add functions:
    - `updateSession(id, { title })` -- update session title
    - `deleteSession(id)` -- cascade delete session + messages
    - `generateSessionTitle(sessionId, firstMessage)` -- lightweight LLM call to generate 3-8 word title

12. **`packages/core/src/types.ts`** -- Add `title?: string` to `ChatSessionData`

13. **`packages/llm/src/index.ts`** -- Export new functions

14. **`apps/web/src/app/api/chat/sessions/[id]/route.ts`** -- Add `DELETE` and `PUT` handlers

15. **`apps/web/src/app/api/chat/route.ts`** -- After first exchange, fire-and-forget title generation. Send `session_meta` SSE event with generated title.

---

## Phase 3: Page-Aware Context System

**Goal:** Pecharunt automatically knows what page you're on and adjusts context + available tools.

### Files to Create

16. **`apps/web/src/features/chat/context/page-context-provider.tsx`** -- Route-aware context
    - Uses `usePathname()` to determine page type
    - Extracts IDs from URL: `teamId`, `pokemonId`, `formatId`
    - Uses TanStack Query to fetch relevant data (deduplicates with page queries)
    - Exposes `PageContext` with `pageType`, data, `toolFilter`, `contextSummary`

17. **`packages/llm/src/tool-context.ts`** -- Tool filtering + MCP tool name mapping
    - `TOOL_CATEGORIES` map: category name -> MCP tool names (prefixed `mcp__nasty-plot__*`)
    - `TOOL_CONTEXT_MAP` map: page type -> allowed categories
    - `WRITE_TOOLS` set: MCP tools that mutate data (for post-execution notification)
    - `getDisallowedMcpTools(pageType)` -- returns MCP tool names to add to `--disallowedTools`
    - Tool filter mapping:

    | Page              | dataQuery | analysis | teamCrud | metaRecs |
    | ----------------- | --------- | -------- | -------- | -------- |
    | `/teams/[teamId]` | all       | all      | all      | all      |
    | `/pokemon/[id]`   | yes       | yes      | no       | no       |
    | `/pokemon`        | yes       | no       | no       | yes      |
    | `/damage-calc`    | yes       | yes      | no       | no       |
    | `/battle/live`    | yes       | yes      | no       | no       |
    | Home/other/chat   | all       | all      | all      | all      |

18. **`packages/llm/src/context-builder.ts`** -- Add new context builders:
    - `buildPokemonContext(pokemonId, species)` -- for `/pokemon/[id]`
    - `buildPageContext(context)` -- orchestrator that dispatches to the right builder

### Files to Modify

19. **`apps/web/src/app/layout.tsx`** -- Add `PageContextProvider` inside `ChatProvider`

20. **`packages/llm/src/cli-chat.ts`** -- Accept `pageContext` in `CliChatOptions`:
    - Compose system prompt with page-specific context (team data, pokemon data, etc.)
    - Add page-specific MCP tool names to `--disallowedTools` list (tool filtering via CLI flag)
    - The `blockedTools` array already blocks code tools; now also block irrelevant MCP tools per page

21. **`packages/llm/src/chat.service.ts`** -- Accept `context` in `StreamChatOptions`, pass to `streamCliChat()`. Remove OpenAI-specific code path (simplify to CLI-only).

22. **`apps/web/src/app/api/chat/route.ts`** -- Accept `context` in request body, pass through to `streamChat()`.

23. **`apps/web/src/features/chat/components/chat-panel.tsx`** -- Read context from `PageContextProvider` instead of receiving `teamId`/`formatId` as props.

---

## Phase 4: Enhanced Chat UX -- Markdown, Tool Display, Stop, Retry

**Goal:** Markdown rendering, rich tool call cards, abort generation, retry last message. All through the Claude CLI subprocess path.

### SSE Protocol Upgrade

The CLI outputs `stream-json` format. We enhance `cli-chat.ts` to emit richer typed SSE events by parsing more of the stream-json output:

24. **`packages/llm/src/sse-events.ts`** (new) -- Typed SSE event definitions:

    ```typescript
    type SSEEvent =
      | { type: "content"; content: string }
      | { type: "tool_start"; name: string; label: string; input: Record<string, unknown> }
      | { type: "tool_end"; name: string }
      | { type: "tool_error"; name: string; error: string }
      | { type: "action_notify"; name: string; label: string; input: Record<string, unknown> }
      | { type: "plan_start"; steps: { text: string }[] }
      | { type: "plan_step_update"; stepIndex: number; status: "active" | "complete" | "skipped" }
      | { type: "session_meta"; sessionId: string; title?: string }
      | { type: "error"; error: string }
      | { type: "done" }
    ```

25. **`packages/llm/src/tool-labels.ts`** (new) -- Human-readable labels for all 24 MCP tools:
    - Maps `mcp__nasty-plot__get_pokemon` -> "Looking up Pokemon data"
    - Maps `mcp__nasty-plot__add_pokemon_to_team` -> "Adding Pokemon to team"
    - `getToolLabel(name)` helper that strips the MCP prefix and returns human-readable label
    - `isWriteTool(name)` helper for post-execution notification

### Files to Create

26. **`apps/web/src/features/chat/components/chat-message.tsx`** -- Individual message with avatar + **markdown rendering**
    - **`react-markdown` + `remark-gfm`** for assistant messages: headings, bold/italic, code blocks, lists, tables, links
    - **Code blocks:** syntax highlighting via `react-syntax-highlighter` (or `shiki`) with copy-to-clipboard button
    - **Inline code:** monospace font + subtle background (matches dark theme)
    - **Tables:** styled with Tailwind table classes matching glassmorphism theme
    - **Links:** open in new tab, accent color
    - **User messages:** plain text, right-aligned (existing pattern)
    - **Prose styling:** `@tailwindcss/typography` plugin or manual prose classes for proper markdown spacing within the dark theme
    - This is critical -- the LLM returns markdown but the current UI renders it as plain text with `whitespace-pre-wrap`

27. **`apps/web/src/features/chat/components/chat-input.tsx`** -- Input area extracted from ChatPanel
    - Textarea with Enter-to-send, Shift+Enter for newline
    - **Stop button:** visible during streaming. Sends abort signal to server, which kills the CLI subprocess
    - **Retry button:** appears after last assistant message when not streaming

28. **`apps/web/src/features/chat/components/chat-tool-call.tsx`** -- Collapsible tool call card
    - Collapsed: tool label (human-readable) + status icon (spinner while executing, checkmark when done, error icon)
    - Expanded: `input` args JSON formatted in `<pre>` block
    - For write tools: highlighted with a different accent color + "Action taken" badge
    - Uses shadcn `Collapsible` or custom disclosure

29. **`apps/web/src/features/chat/hooks/use-chat-stream.ts`** -- Core streaming hook
    - Encapsulates SSE parsing for the typed event protocol
    - Manages `AbortController` for stop generation (client disconnects -> server kills subprocess)
    - Accumulates tool calls into a `Map<string, ToolCallState>` keyed by tool name
    - Tracks action notifications (write tool executions) for display
    - Returns: `{ messages, isStreaming, toolCalls, actionNotifications, currentPlan, sendMessage, stopGeneration, retryLast }`

### Files to Modify

30. **`packages/llm/src/cli-chat.ts`** -- Major enhancements to stream-json parser:
    - Emit typed SSE events instead of the current `{ content }` / `{ toolCall }` format
    - Parse `assistant` message `tool_use` blocks for **full input args** (currently only logs them)
    - Detect write tool calls (from `tool-context.ts` WRITE_TOOLS set) and emit `action_notify` events
    - Parse content for XML plan tags (`<plan>`, `<step_update>`) and emit plan events
    - **Store the subprocess `ChildProcess` reference** so it can be killed for stop generation
    - Accept `signal?: AbortSignal` -- when aborted, call `proc.kill('SIGTERM')` on the subprocess
    - Replace `[DONE]` sentinel with `{ type: "done" }`

31. **`packages/llm/src/chat.service.ts`** -- Simplify to CLI-only:
    - Remove `USE_CLI` toggle and OpenAI path entirely
    - Always delegate to `streamCliChat()`
    - Accept `signal?: AbortSignal` and pass through
    - Accept `context` for page-aware prompt building

32. **`packages/llm/src/chat-session.service.ts`** -- Add `deleteLastAssistantMessage(sessionId)` for retry/regenerate.

33. **`apps/web/src/app/api/chat/route.ts`** -- Changes:
    - Store subprocess PID or pass abort signal for stop generation
    - Handle `regenerate: true` flag: delete last assistant message, re-stream with same history
    - Pass `context` through to `streamChat()`

34. **Rewrite `apps/web/src/features/chat/components/chat-panel.tsx`** -- Compose from sub-components (`ChatMessage`, `ChatInput`, `ChatToolCall`). Use `use-chat-stream` hook. Adapt for `mode: "sidebar" | "fullpage"`.

### Stop Generation -- How It Works with CLI

The Claude CLI runs as a subprocess (`spawn("claude", ...)`). To stop:

1. **Client:** `AbortController.abort()` -> fetch connection closes
2. **Server:** `req.signal` fires abort -> passed to `streamCliChat()`
3. **cli-chat.ts:** on abort signal, calls `proc.kill('SIGTERM')` on the subprocess
4. Process exits -> `close` event fires -> stream sends `[DONE]` -> client shows partial response
5. Partial content accumulated so far is saved to DB as the assistant message

### Retry -- How It Works

1. **Client:** removes last assistant message from UI, sends `POST /api/chat` with `regenerate: true`
2. **Server:** `deleteLastAssistantMessage(sessionId)` removes from DB
3. Rebuilds message history (now ends with last user message)
4. Spawns fresh Claude CLI subprocess with the same prompt
5. Streams new response

---

## Phase 5: Plan Mode & Post-Execution Notifications

**Goal:** LLM auto-creates visible step-by-step plans for complex tasks. Write tool executions show post-hoc notifications (the CLI executes freely, we notify the user what was done).

### Design: CLI-Specific Approach

Since the Claude CLI handles the tool loop internally, we **cannot intercept tool calls before execution**. Instead:

- **Plan mode:** Add XML format instructions to the system prompt. Parse `<plan>` / `<step_update>` tags from the CLI's content stream. Convert to SSE plan events.
- **Write tool notifications:** When we see a `tool_use` block for a write tool (add_pokemon, update_set, etc.), emit an `action_notify` event. The UI shows a "Pecharunt did X" card with details. No pre-confirmation -- the CLI already executed it.

### Files to Create

35. **`packages/llm/src/stream-parser.ts`** -- Stateful XML tag parser for streaming content
    - Detects `<plan>`, `<step_update>` tags in content deltas from CLI stream
    - Converts to typed SSE events (`plan_start`, `plan_step_update`)
    - Strips tags from content forwarded to client (client never sees raw XML)
    - Handles partial tags across chunk boundaries with internal buffering
    - Note: `<proposed_action>` is NOT used -- CLI executes tools freely

36. **`apps/web/src/features/chat/components/chat-plan-display.tsx`** -- Plan checklist UI
    - Card with subtle border, different from regular messages
    - Checkbox list: pending (unchecked), active (spinner), complete (checked), skipped (strikethrough)
    - Visually integrated into the message stream

37. **`apps/web/src/features/chat/components/chat-action-notify.tsx`** -- Post-execution notification card
    - Inline card showing "Pecharunt added Garchomp to slot 3" (or similar)
    - Shows tool name label + input summary
    - Informational only -- no accept/reject buttons (action already happened)
    - Highlighted accent border to distinguish from regular tool calls
    - Optional "View changes" link to navigate to the affected page (e.g., team editor)

### Files to Modify

38. **`packages/llm/src/cli-chat.ts`** -- Integrate `StreamParser` into the stdout parser:
    - Pipe content text deltas through `StreamParser` before emitting SSE events
    - Parser strips XML plan tags and emits plan SSE events instead
    - Add plan mode + notification instructions to the system prompt (appended to temp file)

    System prompt additions (written to `system-prompt.txt`):

    ```
    ## Planning
    For complex multi-step tasks (building a team, comprehensive analysis, multi-pokemon comparison),
    create a step-by-step plan first:

    <plan>
    <step>Step 1 description</step>
    <step>Step 2 description</step>
    </plan>

    As you complete each step, output:
    <step_update index="0" status="complete"/>

    For simple questions, answer directly without a plan.
    ```

39. **`packages/llm/src/context-builder.ts`** -- Add `buildPlanModePrompt()` that returns the plan mode instructions. Called by `cli-chat.ts` when composing the full system prompt.

---

## Phase 6: Full-Page `/chat` Mode

**Goal:** `/chat` route renders the sidebar in expanded full-width mode with persistent session list.

### Files to Modify

40. **`apps/web/src/components/app-shell.tsx`** -- When `pathname === "/chat"`:
    - Hide `<main>` children
    - Render `<ChatSidebar fullPage={true}>`
    - Hide FAB

41. **`apps/web/src/components/chat-sidebar.tsx`** -- `fullPage` mode:
    - Switch from `position: fixed` to `position: static; flex: 1`
    - Layout: flex row of `<ChatSessionList>` (left, ~260px) + `<ChatPanel>` (right, flex-1)
    - No resize handle in full-page mode

42. **`apps/web/src/app/chat/page.tsx`** -- Simplify to minimal/empty component (AppShell handles everything based on pathname)

---

## Component Hierarchy (Final)

```
RootLayout
  Providers (TanStack Query, Theme)
    ChatProvider (sidebar state, session state)
      PageContextProvider (route-aware context)
        AppShell
          SiteHeader
          <main> (all page content, margin-right for sidebar)
            [Page components - no more SiteHeader]
          ChatSidebar (fixed right or full-page)
            ChatSessionList (left panel in full-page, collapsible in sidebar)
            ChatPanel
              ChatMessage[] (with react-markdown, avatars, code highlighting)
                ChatToolCall (collapsible cards within messages)
                ChatPlanDisplay (checklist within messages)
                ChatActionNotify (post-execution notification cards)
              ChatInput (textarea + stop + retry)
          ChatFab (floating button, hidden on /chat)
```

---

## State Architecture

```
ChatProvider (React Context + useReducer)
  |-- Sidebar: { isOpen, width }  -> persisted to localStorage
  |-- Session: { activeSessionId } -> persisted to localStorage
  |-- Streaming: { isStreaming, abortController } -> ephemeral

PageContextProvider (React Context, derived from URL)
  |-- pageType: "team-editor" | "pokemon-detail" | "chat" | ...
  |-- pageData: { teamId?, pokemonId?, formatId?, teamData?, ... }
  |-- toolFilter: string[]  -> which tool categories are available
  |-- contextSummary: string  -> human-readable for system prompt

useChatStream (hook, uses both providers)
  |-- messages: Message[]
  |-- toolCalls: Map<string, ToolCallState>
  |-- actionNotifications: ActionNotify[]  -> write tool executions (post-hoc)
  |-- currentPlan: PlanState | null
  |-- actions: { sendMessage, stopGeneration, retryLast }

useChatSessions (TanStack Query hook)
  |-- sessions: ChatSessionData[]
  |-- mutations: { create, delete, updateTitle }
```

---

## SSE Event Flow (Complete -- CLI Mode)

```
Client sends POST /api/chat { message, sessionId, context }
                                    |
Server builds system prompt (persona + plan mode + page context)
Writes to /tmp/nasty-plot-cli/system-prompt.txt
Spawns: claude --print --output-format stream-json --mcp-config ... <prompt>
                                    |
CLI executes internally (discovers MCP tools, calls them, loops up to 5 turns)
                                    |
cli-chat.ts parses stream-json stdout and emits SSE:
  -> { type: "session_meta", sessionId: "abc" }
  -> { type: "plan_start", steps: [{text: "Choose rain setter"}, ...] }
  -> { type: "plan_step_update", stepIndex: 0, status: "active" }
  -> { type: "content", content: "Let me look up..." }
  -> { type: "tool_start", name: "get_pokemon", label: "Looking up Garchomp", input: {pokemonId: "garchomp"} }
  -> { type: "tool_end", name: "get_pokemon" }
  -> { type: "content", content: "Garchomp is great because..." }
  -> { type: "plan_step_update", stepIndex: 0, status: "complete" }
  -> { type: "action_notify", name: "add_pokemon_to_team", label: "Added Garchomp to slot 3", input: {...} }
  -> { type: "tool_end", name: "add_pokemon_to_team" }
  -> { type: "content", content: "I've added Garchomp to your team!" }
  -> { type: "done" }
                                    |
Client renders: markdown content, plan checklist, tool cards, action notification cards.
Write tool actions already executed -- notification is post-hoc.
```

### Key Difference from OpenAI Path

The CLI handles the entire agent loop. We **cannot** intercept tool calls. We can only:

- **Observe** what tools are being called (from `assistant` message `tool_use` blocks)
- **Notify** the user after write tools execute (post-hoc `action_notify`)
- **Filter** which tools are available via `--disallowedTools` flag (before the CLI starts)

---

## Key Technical Notes

- **CLI-only architecture:** All chat goes through `spawn("claude", ...)`. The OpenAI SDK path in `chat.service.ts` should be removed/simplified.
- **Chat state survives navigation** because `ChatProvider` and `ChatSidebar` live in root layout, never unmount
- **TanStack Query deduplication** means `PageContextProvider` fetching team data doesn't double-fetch with the page
- **Stop generation = kill subprocess:** `proc.kill('SIGTERM')` on the spawned Claude process. Clean and reliable.
- **Tool filtering via CLI flag:** `--disallowedTools` already blocks code tools. Extended to also block irrelevant MCP tools per page context.
- **XML tag parsing** is streaming-safe: `StreamParser` buffers partial tags from content deltas, only flushes confirmed text
- **Plan mode is advisory**: LLM decides when to plan. Plans aren't persisted to DB (ephemeral UI)
- **Write tools are post-hoc notification:** CLI executes freely, we show what happened. No pre-confirmation possible with CLI subprocess model.
- **Session title generation** is fire-and-forget after first exchange. Uses a lightweight separate CLI call or the proxy.
- **Markdown rendering is critical:** The LLM outputs rich markdown (headings, code blocks, lists, tables). Must render properly with `react-markdown` + `remark-gfm`. Current `whitespace-pre-wrap` is broken.
- **stream-json format:** CLI outputs NDJSON. Key types: `stream_event` (content deltas), `assistant` (tool_use blocks), `result` (final metrics). See `cli-chat.ts` for current parsing.
- **Remove `openai` dependency for chat:** After CLI-only migration, the `openai` package is only needed if other features use it. Chat no longer needs it.

## Verification

After each phase, verify:

1. **Phase 1:** Sidebar opens/closes with Cmd+L and FAB. Push animation is smooth. All pages render correctly without their own SiteHeader.
2. **Phase 2:** Can create, switch, delete sessions. Titles auto-generate. Session list renders in both sidebar and full-page modes.
3. **Phase 3:** Chat context changes when navigating. Tool sets differ by page. System prompt includes page-relevant data.
4. **Phase 4:** Markdown renders properly. Tool calls show as collapsible cards. Stop aborts mid-stream (kills subprocess). Retry regenerates last response.
5. **Phase 5:** Complex questions trigger plan display with checklist. Write tool executions show notification cards in the chat stream.
6. **Phase 6:** `/chat` renders full-page mode with left session list. Format selector works.
