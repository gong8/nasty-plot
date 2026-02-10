# Session: Pecharunt Chat Sidebar & LLM UX Overhaul
**Date:** 2026-02-10
**Duration context:** Long (multi-phase feature implementation across 6 phases, spanning 2 context windows)

## What was accomplished

### Phase 1: App Shell & Push Sidebar
- Created `ChatProvider` context with `useReducer` — manages sidebar open/close, width (persisted to localStorage), active session ID
- Created `AppShell` component that renders `SiteHeader` once, manages `margin-right` push animation, registers `Cmd/Ctrl+L` shortcut
- Created `ChatSidebar` with fixed positioning, resize handle (300-600px clamped), close button, collapsible history panel
- Created `ChatSidebarResizeHandle` with pointer events and `requestAnimationFrame` for smooth drag
- Created `ChatFab` (floating action button) with Pecharunt sprite, hidden on `/chat` and when sidebar is open
- Removed `<SiteHeader />` from all 12 page components (home, chat, pokemon, teams, damage-calc, battle/*, etc.)
- Wrapped root layout in `ChatProvider > PageContextProvider > AppShell`

### Phase 2: Session Management & Chat History
- Added `title String?` field to `ChatSession` Prisma model, ran migration `add_chat_session_title`
- Added `title` to `ChatSessionData` in `@nasty-plot/core` types
- Created `updateSession`, `deleteSession`, `deleteLastAssistantMessage` in `chat-session.service.ts`
- Created `use-chat-sessions.ts` TanStack Query hook (list, create, delete, update title)
- Created `ChatSessionList` component with session switching, delete-on-hover, relative timestamps
- Added `PUT`/`DELETE` handlers to `/api/chat/sessions/[id]` route

### Phase 3: Page-Aware Context System
- Created `PageContextProvider` — route-aware context using `usePathname()`, extracts teamId/pokemonId/formatId, fetches data via TanStack Query
- Created `tool-context.ts` — maps page types to allowed MCP tool categories, `getDisallowedMcpTools()` returns tools to block per page
- Created `sse-events.ts` — typed SSE event union (content, tool_start/end/error, action_notify, plan_start/step_update, session_meta, error, done)
- Created `tool-labels.ts` — human-readable labels for all 24 MCP tools, `isWriteTool()` helper
- Enhanced `context-builder.ts` with `buildPokemonContext`, `buildPageContextPrompt`, `buildPlanModePrompt`

### Phase 4: Enhanced Chat UX
- Rewrote `cli-chat.ts` — typed SSE events, `AbortSignal` support (kills subprocess with SIGTERM), tool labels, action notifications, disallowed MCP tools
- Simplified `chat.service.ts` to CLI-only (removed OpenAI code path), accepts signal + context
- Created `ChatMessage` with `react-markdown` + `remark-gfm` + `react-syntax-highlighter` (vscDarkPlus theme), copy-to-clipboard on code blocks
- Created `ChatToolCall` — collapsible card with status icon (spinner/check/error), expandable JSON input display
- Created `ChatActionNotify` — amber-accented post-execution notification card
- Created `ChatInput` with Enter-to-send, stop button during streaming, regenerate button after assistant messages
- Created `use-chat-stream` hook — encapsulates SSE parsing, AbortController, tool call tracking, action notifications, plan steps
- Rewrote `ChatPanel` — composes all sub-components, session change tracking
- Updated `/api/chat/route.ts` — context passthrough, regenerate flag, abort signal, fire-and-forget title generation, stream tee for save

### Phase 5: Plan Mode & Notifications
- Created `StreamParser` — stateful XML tag parser for `<plan>`, `<step>`, `<step_update>` tags in streaming content
- Integrated `StreamParser` into `cli-chat.ts` content delta pipeline — strips plan XML, emits plan SSE events
- Created `ChatPlanDisplay` — checklist UI with status indicators (pending/active/complete/skipped)
- Added plan event handlers in `use-chat-stream` hook

### Phase 6: Full-Page Chat (kept but disabled)
- Full-page mode code preserved in `ChatSidebar` (`fullPage` prop) but disabled in `AppShell`
- `/chat` route auto-opens sidebar and shows a landing page

### Audit & Fixes (final pass)
- Removed SiteHeader from 2 remaining battle pages (`simulate`, `replay/[battleId]`)
- Installed `@tailwindcss/typography` plugin for proper prose rendering
- Removed OpenAI SDK import from `chat.service.ts`, replaced with local `MODEL` const
- Added `session_meta` event handler in `use-chat-stream` (invalidates sessions query)
- Improved title generation heuristic (sentence boundaries, word-boundary truncation, markdown stripping)

## Key decisions & rationale

- **CLI-only architecture**: Dropped the OpenAI SDK code path entirely. All chat goes through `spawn("claude", ...)`. Simpler, and the CLI handles its own agent loop.
- **Push sidebar (not overlay)**: Uses `margin-right` transition on main content + fixed position sidebar. Content reflows rather than being obscured.
- **Native scroll div over Radix ScrollArea**: Radix `ScrollArea` ref points to the root wrapper, not the scrollable viewport, breaking auto-scroll. Switched to a plain `div` with `overflow-y-auto` for reliable scroll behavior.
- **Post-hoc tool notifications**: Since the CLI subprocess executes tools internally, we can't intercept before execution. Instead we notify after the fact with `action_notify` events.
- **XML plan tags in content stream**: The LLM outputs `<plan>`, `<step_update>` XML in its content. `StreamParser` strips these and converts to typed SSE events. Client never sees raw XML.
- **Full-page mode disabled**: User decided full-page `/chat` was unnecessary; sidebar-only mode preferred. Code kept for potential future use.

## Bugs found & fixed

- **`<button>` inside `<button>` hydration error**: `ChatSessionList` had a delete button nested inside a session button. Fixed by changing the outer element to `<div role="button" tabIndex={0}>` with keyboard support.
- **Scrolling completely broken in sidebar chat**: Radix `ScrollArea` ref was attached to the wrong element (root, not viewport). Replaced with native `div` + `scrollIntoView` anchor at bottom.
- **Auto-scroll not working**: Same root cause as above. Fixed with `bottomRef.current?.scrollIntoView({ behavior: "instant" })`.
- **Content overflow in narrow sidebar**: Assistant message bubbles used `max-w-[85%]` which still overflowed. Changed to `min-w-0 flex-1` with `break-words` and `overflow-hidden`.
- **`stream-parser.ts` regex `s` flag**: The `/s` flag requires ES2018 target. Replaced with an ES5-compatible pattern.
- **SiteHeader still in 2 battle pages**: `battle/simulate` and `battle/replay/[battleId]` were missed in the initial SiteHeader removal pass. The replay page had 3 separate `<SiteHeader />` renders (error/loading/main states).

## Pitfalls & gotchas encountered

- **Prisma schema edits fail if file modified since read**: The file must be re-read before editing if anything else touched it.
- **`context-builder.ts` had duplicate match strings**: Two instances of `return lines.join("\n");\n}` required more surrounding context to disambiguate.
- **Linter auto-modified `llm/index.ts`**: Added `battle-context-builder` exports automatically. Had to adapt rather than fight it.
- **Radix ScrollArea is not a simple scroll container**: The `ref` on `<ScrollArea>` gives you the root, not the scrollable viewport. For programmatic scroll control, use a native div.
- **`replace_all` with indentation differences**: The SiteHeader in replay page had varying indentation across its 3 occurrences. `replace_all` matched 2 of 3; the third needed a separate edit.

## Files changed

### Created
- `apps/web/src/features/chat/context/chat-provider.tsx`
- `apps/web/src/features/chat/context/page-context-provider.tsx`
- `apps/web/src/components/app-shell.tsx`
- `apps/web/src/components/chat-sidebar.tsx`
- `apps/web/src/components/chat-sidebar-resize-handle.tsx`
- `apps/web/src/components/chat-fab.tsx`
- `apps/web/src/features/chat/hooks/use-chat-sessions.ts`
- `apps/web/src/features/chat/hooks/use-chat-stream.ts`
- `apps/web/src/features/chat/components/chat-session-list.tsx`
- `apps/web/src/features/chat/components/chat-message.tsx`
- `apps/web/src/features/chat/components/chat-tool-call.tsx`
- `apps/web/src/features/chat/components/chat-action-notify.tsx`
- `apps/web/src/features/chat/components/chat-plan-display.tsx`
- `apps/web/src/features/chat/components/chat-input.tsx`
- `packages/llm/src/sse-events.ts`
- `packages/llm/src/tool-labels.ts`
- `packages/llm/src/tool-context.ts`
- `packages/llm/src/stream-parser.ts`
- `prisma/migrations/20260210052610_add_chat_session_title/`

### Modified
- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/globals.css` (added typography plugin)
- `apps/web/src/app/chat/page.tsx`
- `apps/web/src/features/chat/components/chat-panel.tsx` (full rewrite)
- `apps/web/src/app/api/chat/route.ts`
- `apps/web/src/app/api/chat/sessions/[id]/route.ts`
- `packages/llm/src/cli-chat.ts` (major rewrite)
- `packages/llm/src/chat.service.ts` (simplified to CLI-only)
- `packages/llm/src/chat-session.service.ts`
- `packages/llm/src/context-builder.ts`
- `packages/llm/src/index.ts`
- `packages/core/src/types.ts`
- `prisma/schema.prisma`
- All page files (SiteHeader removal): `app/page.tsx`, `app/pokemon/page.tsx`, `app/pokemon/[id]/page.tsx`, `app/teams/page.tsx`, `app/teams/new/page.tsx` (if it existed), `app/teams/[teamId]/page.tsx`, `app/damage-calc/page.tsx`, `app/battle/page.tsx`, `app/battle/new/page.tsx`, `app/battle/live/page.tsx`, `app/battle/simulate/page.tsx`, `app/battle/replay/[battleId]/page.tsx`

## Known issues & next steps

- **LLM-based title generation**: Currently uses a heuristic (first sentence / word-boundary truncation). The plan called for a lightweight LLM call. Could spawn a quick Claude CLI call for this.
- **`session_meta` SSE event not emitted from server**: The title is generated after the stream starts, so there's no way to inject it into the already-flowing SSE stream without a TransformStream wrapper. Currently relies on query invalidation instead.
- **`openai-client.ts` still exported from `llm/index.ts`**: The `getOpenAI` and `MODEL` exports remain for potential non-chat uses. Could be cleaned up if nothing else uses them.
- **Full-page `/chat` mode**: Code exists but is disabled. Layout had issues with session list cutoff and border wrapping. If re-enabling, needs proper flex layout debugging.
- **Plan mode untested end-to-end**: The XML parsing and display components are implemented but haven't been tested with an actual LLM response containing `<plan>` tags. The system prompt instructs the LLM to use them for complex tasks.
- **No tests**: None of the new components or hooks have test coverage.

## Tech notes

- **CLI subprocess model**: `spawn("claude", [...args])` with `--output-format stream-json` produces NDJSON. Key message types: `stream_event` (content deltas in `event.delta.text`), `assistant` (contains `tool_use` blocks with full input args), `result` (cost, turns, timing).
- **Stop generation flow**: Client `AbortController.abort()` → fetch disconnects → `req.signal` fires abort on server → `proc.kill('SIGTERM')` kills Claude subprocess → `close` event fires → stream sends `done` → client keeps partial content.
- **Retry flow**: Client removes last assistant message from UI, sends `POST /api/chat` with `regenerate: true` → server calls `deleteLastAssistantMessage(sessionId)` → rebuilds history (now ends with last user message) → spawns fresh subprocess.
- **Tool filtering**: `--disallowedTools` CLI flag blocks both built-in code tools (Bash, Read, Write, etc.) and page-specific MCP tools. The tool context map determines which MCP tools are relevant per page type.
- **StreamParser buffering**: Holds partial XML tags in a buffer (up to 50 chars from last `<`) to handle tags split across chunks. `flush()` releases remaining buffer when the stream ends.
- **Tailwind v4 typography**: Uses `@plugin "@tailwindcss/typography"` syntax (not the v3 `plugins: [require(...)]` config). The linter auto-corrected `@import` to `@plugin`.
