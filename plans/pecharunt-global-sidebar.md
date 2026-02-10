# Pecharunt Global Chat Sidebar & LLM UX Overhaul

## Context

The current chat system lives exclusively on `/chat` as a standalone page and is embedded as a Sheet sidebar on the team editor page. There's no session browsing UI, no way to stop/retry responses, and tool calls show as a basic spinner. This plan transforms Pecharunt into a persistent, Cursor-like AI assistant available on every page via a push sidebar, with chat history management and rich LLM interaction features.

## Summary of Decisions

| Decision | Choice |
|----------|--------|
| Sidebar style | Push content (like Cursor) |
| Sidebar width | Resizable by user (drag edge, 300-600px) |
| Navigation behavior | Same session persists, context updates silently |
| `/chat` page | Becomes the sidebar in expanded full-width mode |
| Chat history (full page) | Left sidebar with session list |
| Chat history (popout) | Session switcher panel inside sidebar |
| Session titles | LLM-generated from first message |
| Tool display | Collapsible cards with input/output |
| Plan mode | Auto for complex tasks (LLM decides) |
| Retry/regenerate | Button on last assistant message |
| Stop generation | Abort button during streaming |
| Agent actions | Read + write with user confirmation |
| Open trigger | FAB button + Cmd/Ctrl+L keyboard shortcut |
| Shortcut | Cmd/Ctrl+L |

---

## Phase 1: Foundation — App Shell & Push Sidebar

**Goal:** Replace per-page header rendering with a unified `AppShell` that houses the push sidebar.

### Files to Create

1. **`apps/web/src/features/chat/context/chat-provider.tsx`** — Core chat state provider
   - State: `isOpen`, `width` (persisted to localStorage), `activeSessionId`
   - Actions: `toggleSidebar`, `openSidebar`, `closeSidebar`, `setWidth`, `switchSession`, `newSession`
   - Uses `useReducer` for complex state transitions

2. **`apps/web/src/components/app-shell.tsx`** — Layout orchestrator (client component)
   - Renders `<SiteHeader />` once at top
   - Flex container: `<main>` (with `margin-right` transition) + `<ChatSidebar />`
   - When `pathname === "/chat"`: hides `<main>`, renders sidebar in full-page mode
   - Registers `Cmd/Ctrl+L` keyboard shortcut

3. **`apps/web/src/components/chat-sidebar.tsx`** — Right sidebar container
   - `position: fixed; top: 64px; right: 0; bottom: 0` in sidebar mode
   - `position: static; flex: 1` in full-page mode
   - Border-left, matches app background/glassmorphism

4. **`apps/web/src/components/chat-sidebar-resize-handle.tsx`** — Draggable resize edge
   - 4px-wide absolute div on left edge of sidebar
   - `onPointerDown` -> `pointermove`/`pointerup` on document
   - Clamps width between 300px and min(600px, 50vw)
   - Persists to localStorage on drag end

5. **`apps/web/src/components/chat-fab.tsx`** — Floating action button
   - Fixed `bottom-6 right-6 z-50`, Pecharunt sprite icon
   - Hidden on `/chat` route
   - Calls `toggleSidebar()` from ChatProvider

### Files to Modify

6. **`apps/web/src/app/layout.tsx`** — Wrap children in `ChatProvider` + `AppShell`
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
The sidebar is `position: fixed` so it doesn't participate in the flow — the margin creates the space. During resize drag, use `requestAnimationFrame` for smooth updates.

---

## Phase 2: Session Management & Chat History

**Goal:** Add session CRUD, browsable history, and auto-generated titles.

### DB Migration

8. **`prisma/schema.prisma`** — Add `title` field to `ChatSession`:
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

9. **`apps/web/src/features/chat/components/chat-session-list.tsx`** — Session list panel
    - Scrollable list of sessions, sorted by `updatedAt` desc
    - Each item: title (or "New Chat"), relative timestamp, delete button
    - "New Chat" button at top
    - In full-page mode: persistent left panel (~260px wide)
    - In sidebar mode: collapsible panel toggled by a history icon button

10. **`apps/web/src/features/chat/hooks/use-chat-sessions.ts`** — TanStack Query hook
    - `useQuery` for listing sessions
    - `useMutation` for create, delete, update title
    - Invalidates session list on mutations

### Files to Modify

11. **`packages/llm/src/chat-session.service.ts`** — Add functions:
    - `updateSession(id, { title })` — update session title
    - `deleteSession(id)` — cascade delete session + messages
    - `generateSessionTitle(sessionId, firstMessage)` — lightweight LLM call to generate 3-8 word title

12. **`packages/core/src/types.ts`** — Add `title?: string` to `ChatSessionData`

13. **`packages/llm/src/index.ts`** — Export new functions

14. **`apps/web/src/app/api/chat/sessions/[id]/route.ts`** — Add `DELETE` and `PUT` handlers

15. **`apps/web/src/app/api/chat/route.ts`** — After first exchange, fire-and-forget title generation. Send `session_meta` SSE event with generated title.

---

## Phase 3: Page-Aware Context System

**Goal:** Pecharunt automatically knows what page you're on and adjusts context + available tools.

### Files to Create

16. **`apps/web/src/features/chat/context/page-context-provider.tsx`** — Route-aware context
    - Uses `usePathname()` to determine page type
    - Extracts IDs from URL: `teamId`, `pokemonId`, `formatId`
    - Uses TanStack Query to fetch relevant data (deduplicates with page queries)
    - Exposes `PageContext` with `pageType`, data, `toolFilter`, `contextSummary`

17. **`packages/llm/src/tool-context.ts`** — Tool filtering definitions
    - `TOOL_CATEGORIES` map: category name -> tool names array
    - `TOOL_CONTEXT_MAP` map: page type -> allowed categories
    - `WRITE_TOOLS` set: tools requiring user confirmation
    - Tool filter mapping:

    | Page | dataQuery | analysis | teamCrud | metaRecs |
    |------|-----------|----------|----------|----------|
    | `/teams/[teamId]` | all | all | all | all |
    | `/pokemon/[id]` | yes | yes | no | no |
    | `/pokemon` | yes | no | no | yes |
    | `/damage-calc` | yes | yes | no | no |
    | `/battle/live` | yes | yes | no | no |
    | Home/other/chat | all | all | all | all |

18. **`packages/llm/src/context-builder.ts`** — Add new context builders:
    - `buildPokemonContext(pokemonId, species)` — for `/pokemon/[id]`
    - `buildPageContext(context)` — orchestrator that dispatches to the right builder

### Files to Modify

19. **`apps/web/src/app/layout.tsx`** — Add `PageContextProvider` inside `ChatProvider`

20. **`packages/llm/src/chat.service.ts`** — Accept `pageContext` and `toolFilter` in `StreamChatOptions`. Filter tools from `getMcpTools()` before passing to OpenAI.

21. **`apps/web/src/app/api/chat/route.ts`** — Accept `context` and `toolFilter` in request body, pass through to `streamChat()`.

22. **`apps/web/src/features/chat/components/chat-panel.tsx`** — Read context from `PageContextProvider` instead of receiving `teamId`/`formatId` as props.

---

## Phase 4: Enhanced Chat UX — Tool Display, Stop, Retry

**Goal:** Rich tool call cards, abort generation, retry last message.

### SSE Protocol Upgrade

23. **`packages/llm/src/sse-events.ts`** (new) — Typed SSE event definitions:
    ```typescript
    type SSEEvent =
      | { type: "content"; content: string }
      | { type: "tool_start"; toolCallId: string; name: string; label: string; args: Record<string, unknown> }
      | { type: "tool_end"; toolCallId: string; name: string; result: string; durationMs: number }
      | { type: "tool_error"; toolCallId: string; name: string; error: string }
      | { type: "plan_start"; planId: string; steps: { id: string; text: string }[] }
      | { type: "plan_step_update"; planId: string; stepIndex: number; status: "active" | "complete" | "skipped" }
      | { type: "plan_complete"; planId: string }
      | { type: "action_confirm"; actionId: string; toolName: string; label: string; description: string; args: Record<string, unknown> }
      | { type: "session_meta"; sessionId: string; title?: string }
      | { type: "error"; error: string }
      | { type: "done" }
    ```

24. **`packages/llm/src/tool-labels.ts`** (new) — Human-readable labels + icons for all 24 tools, plus `generateActionLabel()` helper.

### Files to Create

25. **`apps/web/src/features/chat/components/chat-message.tsx`** — Individual message with avatar, markdown rendering, timestamp
    - Uses `react-markdown` for rendering assistant messages
    - User messages right-aligned, assistant left-aligned (existing pattern)

26. **`apps/web/src/features/chat/components/chat-input.tsx`** — Input area extracted from ChatPanel
    - Textarea with Enter-to-send
    - Stop button (visible during streaming, calls AbortController.abort())
    - Retry button (appears on last assistant message when not streaming)

27. **`apps/web/src/features/chat/components/chat-tool-call.tsx`** — Collapsible tool call card
    - Collapsed: tool label + status icon (spinner/checkmark/error) + duration
    - Expanded: `args` JSON + `result` JSON in `<pre>` with syntax highlighting
    - Uses shadcn `Collapsible` or custom disclosure

28. **`apps/web/src/features/chat/hooks/use-chat-stream.ts`** — Core streaming hook
    - Encapsulates SSE parsing for new typed event protocol
    - Manages `AbortController` for stop generation
    - Handles all event types: content, tool_start/end, plan, action_confirm, session_meta
    - Returns: `{ messages, isStreaming, toolCalls, currentPlan, pendingAction, sendMessage, stopGeneration, retryLast }`

### Files to Modify

29. **`packages/llm/src/chat.service.ts`** — Major changes:
    - Replace `sendEvent()` with typed `emitEvent(controller, encoder, event: SSEEvent)`
    - Emit `tool_start` with args + label before executing each tool
    - Emit `tool_end` with result + duration after each tool
    - Accept `signal?: AbortSignal` in options, pass to `getOpenAI().chat.completions.create()`
    - Check `signal.aborted` between tool rounds
    - Replace `[DONE]` sentinel with `{ type: "done" }`

30. **`packages/llm/src/chat-session.service.ts`** — Add `deleteLastAssistantMessage(sessionId)` for retry/regenerate.

31. **`apps/web/src/app/api/chat/route.ts`** — Pass `req.signal` through to `streamChat()`. Handle `regenerate: true` flag in request body.

32. **Rewrite `apps/web/src/features/chat/components/chat-panel.tsx`** — Compose from sub-components. Use `use-chat-stream` hook. Adapt for `mode: "sidebar" | "fullpage"`.

---

## Phase 5: Plan Mode & Action Confirmation

**Goal:** LLM auto-creates visible step-by-step plans for complex tasks. Write actions require user confirmation.

### Files to Create

33. **`packages/llm/src/stream-parser.ts`** — Stateful XML tag parser for streaming content
    - Detects `<plan>`, `<step_update>`, `<proposed_action>` tags in LLM output
    - Converts to typed SSE events
    - Strips tags from content forwarded to client
    - Handles partial tags across chunk boundaries with buffering

34. **`apps/web/src/features/chat/components/chat-plan-display.tsx`** — Plan checklist UI
    - Card with plan title
    - Checkbox list: pending (unchecked), active (spinner), complete (checked), skipped (strikethrough)
    - Visually distinct from chat messages (bordered card, different background)

35. **`apps/web/src/features/chat/components/chat-action-confirm.tsx`** — Action confirmation card
    - Inline card within message stream
    - Shows: action label, description, expandable args JSON
    - Accept / Reject buttons
    - On accept: POST to `/api/chat/action` to execute
    - On reject: sends rejection message back into conversation

36. **`apps/web/src/app/api/chat/action/route.ts`** — Execute confirmed actions
    - Receives `{ sessionId, actionId, toolName, args, accepted }`
    - If accepted: call `executeMcpTool(toolName, args)`, add result to session
    - If rejected: add `[User rejected: {label}]` message, optionally trigger follow-up LLM response

### Files to Modify

37. **`packages/llm/src/chat.service.ts`** — Integrate `StreamParser`:
    - Pipe content deltas through parser
    - When write tool call detected: emit `action_confirm` instead of executing
    - Add plan mode instructions to system prompt
    - Add action confirmation instructions to system prompt

    System prompt additions:
    ```
    ## Plan Mode
    For multi-step tasks (3+ steps), output a plan as:
    <plan title="Short title">
    <step>Step description</step>
    ...
    </plan>
    Then mark progress with <step_update index="N" status="active|complete|skipped"/>

    ## Action Confirmation
    Never call write tools directly. Propose with:
    <proposed_action tool="tool_name" label="Human readable">
    {JSON args}
    </proposed_action>
    Then STOP and wait for user confirmation.
    ```

---

## Phase 6: Full-Page `/chat` Mode

**Goal:** `/chat` route renders the sidebar in expanded full-width mode with persistent session list.

### Files to Modify

38. **`apps/web/src/components/app-shell.tsx`** — When `pathname === "/chat"`:
    - Hide `<main>` children
    - Render `<ChatSidebar fullPage={true}>`
    - Hide FAB

39. **`apps/web/src/components/chat-sidebar.tsx`** — `fullPage` mode:
    - Switch from `position: fixed` to `position: static; flex: 1`
    - Layout: flex row of `<ChatSessionList>` (left, ~260px) + `<ChatPanel>` (right, flex-1)
    - No resize handle in full-page mode

40. **`apps/web/src/app/chat/page.tsx`** — Simplify to minimal/empty component (AppShell handles everything based on pathname)

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
              ChatMessage[] (with markdown, avatars)
                ChatToolCall (collapsible cards within messages)
                ChatPlanDisplay (checklist within messages)
                ChatActionConfirm (confirm/reject within messages)
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
  |-- currentPlan: PlanState | null
  |-- pendingAction: ActionProposal | null
  |-- actions: { sendMessage, stopGeneration, retryLast, confirmAction, rejectAction }

useChatSessions (TanStack Query hook)
  |-- sessions: ChatSessionData[]
  |-- mutations: { create, delete, updateTitle }
```

---

## SSE Event Flow (Complete)

```
Client sends POST /api/chat { message, sessionId, context, toolFilter }
                                    |
Server builds system prompt (persona + plan mode + action confirm + page context)
                                    |
SSE stream begins:
  -> { type: "session_meta", sessionId: "abc" }
  -> { type: "plan_start", planId: "p1", steps: [...] }          // if complex task
  -> { type: "plan_step_update", planId: "p1", stepIndex: 0, status: "active" }
  -> { type: "content", content: "Let me look up..." }
  -> { type: "tool_start", toolCallId: "tc1", name: "get_pokemon", label: "Looking up Garchomp", args: {...} }
  -> { type: "tool_end", toolCallId: "tc1", name: "get_pokemon", result: "...", durationMs: 120 }
  -> { type: "content", content: "Garchomp is great because..." }
  -> { type: "plan_step_update", planId: "p1", stepIndex: 0, status: "complete" }
  -> { type: "action_confirm", actionId: "ac1", toolName: "add_pokemon_to_team", label: "Add Garchomp to slot 1", ... }
  -> { type: "content", content: "Shall I add Garchomp?" }
  -> { type: "done" }
                                    |
Client renders plan checklist, tool cards, content, and action confirm card.
User clicks Accept -> POST /api/chat/action -> tool executes -> result shown.
```

---

## Key Technical Notes

- **Chat state survives navigation** because `ChatProvider` and `ChatSidebar` live in root layout, never unmount
- **TanStack Query deduplication** means `PageContextProvider` fetching team data doesn't double-fetch with the page
- **Abort signal** uses `req.signal` from Next.js App Router + `AbortController` on client
- **XML tag parsing** is streaming-safe: `StreamParser` buffers partial tags, only flushes confirmed text
- **Plan mode is advisory**: LLM decides when to plan. Plans aren't persisted to DB (ephemeral UI)
- **Action confirmation is two-phase**: stream completes, then user confirms -> new API call executes. No stream pausing needed.
- **Session title generation** is fire-and-forget after first exchange. Client gets title via SSE event or next session list fetch.

## Verification

After each phase, verify:
1. **Phase 1:** Sidebar opens/closes with Cmd+L and FAB. Push animation is smooth. All pages render correctly without their own SiteHeader.
2. **Phase 2:** Can create, switch, delete sessions. Titles auto-generate. Session list renders in both sidebar and full-page modes.
3. **Phase 3:** Chat context changes when navigating. Tool sets differ by page. System prompt includes page-relevant data.
4. **Phase 4:** Tool calls show as collapsible cards. Stop aborts mid-stream. Retry regenerates last response. SSE events are typed.
5. **Phase 5:** Complex questions trigger plan display. Write actions show confirmation cards. Accept/reject works.
6. **Phase 6:** `/chat` renders full-page mode with left session list. Format selector works.
