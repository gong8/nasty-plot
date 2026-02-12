# Session: Guided Builder + Pecharunt Deep Integration

**Date:** 2026-02-11
**Duration context:** Long (continuation session — original session ran out of context)

## What was accomplished

- **Re-applied all guided builder bridge changes** on top of the auto-analyze battle coaching changes that a parallel session had merged into the same files (`chat-provider.tsx`, `use-chat-stream.ts`, `chat-panel.tsx`)
- **ChatProvider bridge fields** added: `guidedBuilderContextRef`, `setGuidedBuilderContext`, `guidedActionNotifyRef`, `autoSendMessage`, `queueAutoSend`, `clearAutoSend`, `isChatStreaming`, `setIsChatStreaming`
- **`use-chat-stream.ts`** — Added `ChatStreamOptions` interface with `onActionNotify` callback, `optionsRef` pattern for stable callback access, and `extraContext` parameter on `sendMessage` for passing live `guidedBuilder` context
- **`chat-panel.tsx`** — Integrated bridge: stable `actionNotifyCallback` → guided builder ref, streaming state sync to ChatProvider, auto-send for proactive reactions, `handleSend` passes guided builder context, wizard event rendering
- **`guided-builder.tsx`** — Complete rewrite to pure rendering component consuming `useGuidedBuilderContext()` from provider (removed all inline state management, `persistSlotToDb`, `saveAllSlots`, `AskPecharuntButton`)
- **`guided/page.tsx`** — Wrapped with `GuidedBuilderProvider`, renders `<GuidedBuilder />` with no props
- **`chat.service.ts`** — Live context for guided-builder sessions (not frozen at session creation)
- **`route.ts`** — Added `guidedBuilder` to context type
- **Deleted `ask-pecharunt-button.tsx`** — replaced by embedded sidebar integration
- **Fixed Node module bundling error** — Created `@nasty-plot/llm/browser` subpath export for browser-safe imports
- **Fixed Prisma stale client** — Ran `db:generate` and `db:push` after auto-analyze session added `metadata` column
- **Fixed infinite render loop** — Changed `guidedBuilderContext` from `useState` to `useRef` in ChatProvider

## Key decisions & rationale

- **Sidebar bridge via ChatProvider refs** (not a custom embedded chat panel): The user explicitly wanted to reuse the existing global ChatSidebar (which pushes content left via marginRight in AppShell) rather than building a new inline chat component. This led to a bridge pattern where `GuidedBuilderProvider` writes context/handlers to refs on `ChatProvider`, and `ChatPanel` reads them.
- **`guidedBuilderContext` as ref, not state**: Exposing the guided builder context as a `MutableRefObject` on ChatProvider (instead of `useState`) avoids infinite render loops. The context object changes frequently (every wizard interaction), but ChatPanel only needs it at send-time, not for rendering. Reading `.current` at send-time is always fresh.
- **`optionsRef` pattern in `use-chat-stream`**: The `onActionNotify` callback needs to stay fresh (it closes over guided builder dispatch functions) but `sendMessage` is memoized with `useCallback`. Using a ref that's updated on every render gives the SSE handler access to the latest callback without breaking memoization.
- **Browser subpath export for LLM package**: Client components can't import the main `@nasty-plot/llm` barrel because it pulls in Node-only modules (`child_process` via `cli-chat.ts`). The `./browser` subpath only exports browser-safe functions.

## Bugs found & fixed

1. **`Module not found: Can't resolve 'child_process'`** — `use-auto-analyze.ts` (client component) imported `buildAutoAnalyzePrompt` from `@nasty-plot/llm` barrel, which transitively pulled in `streamCliChat` → `child_process`. **Fix:** Created `packages/llm/src/browser.ts` with browser-safe exports, added `"./browser"` subpath to `package.json` exports, changed import to `from "@nasty-plot/llm/browser"`.

2. **Prisma `Unknown argument 'metadata'`** — The auto-analyze session added a `metadata` column to `ChatMessage` in the Prisma schema but the generated client was stale. **Fix:** `pnpm run db:generate` + `pnpm run db:push` + restart dev server (Turbopack caching).

3. **`Maximum update depth exceeded`** at `setGuidedBuilderContext` — Infinite render loop: `guided` object (new ref every render from `useGuidedBuilder`) → `chatContext` useMemo recomputes → useEffect fires `setGuidedBuilderContext(chatContext)` → state update in ChatProvider → re-render → repeat. **Fix:** Changed `guidedBuilderContext` from `useState` to `useRef` in ChatProvider. The setter just writes to the ref (no re-render). ChatPanel reads `.current` at send-time.

## Pitfalls & gotchas encountered

- **Parallel session collisions**: The auto-analyze battle coaching session was modifying the same files (`chat-provider.tsx`, `use-chat-stream.ts`, `chat-panel.tsx`) simultaneously. Edits failed with "File has been modified since read". Had to wait for the parallel session to finish, then re-read all files and apply edits on top.
- **Linter/stash disaster from previous session**: A git stash + linter auto-fix in the previous session reverted several critical files to their pre-modification state, losing hours of work. The new files (provider, hooks, components) survived because they were untracked.
- **React context + refs interaction**: Exposing a ref's `.current` through React context captures the value at render-time, not at read-time. Must expose the ref object itself (`MutableRefObject<T>`) so consumers read `.current` when they actually need the value.

## Files changed

### Created

- `packages/llm/src/browser.ts` — Browser-safe LLM package exports

### Modified

- `apps/web/src/features/chat/context/chat-provider.tsx` — Bridge fields (ref-based), callbacks
- `apps/web/src/features/chat/hooks/use-chat-stream.ts` — `ChatStreamOptions`, `onActionNotify`, `extraContext` in `sendMessage`
- `apps/web/src/features/chat/components/chat-panel.tsx` — Bridge integration, wizard event rendering, auto-send
- `apps/web/src/features/team-builder/components/guided-builder.tsx` — Rewritten to consume provider context
- `apps/web/src/app/teams/[teamId]/guided/page.tsx` — Wrapped with `GuidedBuilderProvider`
- `apps/web/src/app/api/chat/route.ts` — `guidedBuilder` in context type
- `packages/llm/src/chat.service.ts` — Live context for guided-builder sessions
- `packages/llm/package.json` — Added `./browser` subpath export
- `apps/web/src/features/battle/hooks/use-auto-analyze.ts` — Changed import to `@nasty-plot/llm/browser`

### Deleted

- `apps/web/src/features/team-builder/components/guided/ask-pecharunt-button.tsx`

### Unchanged (created in previous session, intact)

- `apps/web/src/features/team-builder/context/guided-builder-provider.tsx`
- `apps/web/src/features/team-builder/hooks/use-proactive-reactions.ts`
- `apps/web/src/features/chat/components/chat-wizard-event.tsx`

## Known issues & next steps

- **Manual verification needed**: The guided builder page should now load without errors. Full verification checklist:
  1. Chat sidebar auto-opens when visiting guided builder
  2. Pre-built welcome with step-specific suggested questions appears
  3. Picking a Pokemon triggers proactive Pecharunt commentary (~2-3s debounce)
  4. Pecharunt MCP actions (add_pokemon_to_team, update_pokemon_set) update the wizard
  5. Chat context updates as user navigates steps
  6. Mobile bottom sheet behavior
  7. Session resumes on page refresh
- **Pre-existing test failures (5)**: 2 in `chat-session.service.test.ts` (metadata field), 3 in `chat.service.test.ts` (mock setup) — confirmed pre-existing, not caused by this work
- **Pre-existing build errors**: `cleanupEmptyTeams` export missing from `@nasty-plot/teams`, `getTopCores` export missing from `@nasty-plot/smogon-data` — unrelated but would block production builds
- **Mobile bottom sheet** (`guided-chat-bottom-sheet.tsx`) — file referenced in plan but not confirmed created; may need implementation
- **Guided builder layout** (`guided-builder-layout.tsx`) — responsive two-column layout file may still be needed for desktop/tablet split

## Tech notes

- **Bridge architecture**: `GuidedBuilderProvider` (page tree) ↔ `ChatProvider` (app shell) communicate via refs on ChatProvider. The provider writes: `setGuidedBuilderContext(ctx)` writes to ref, `guidedActionNotifyRef.current = handler` registers action handler, `queueAutoSend(text)` queues proactive messages. ChatPanel reads: `guidedBuilderContextRef.current` at send-time, `guidedActionNotifyRef.current?.(notification)` on action_notify SSE events, `autoSendMessage` triggers auto-send effect.
- **Proactive reactions flow**: Wizard pick → `useProactiveReactions` detects slot change → debounce 1.5s → rate-limit 10s → `queueAutoSend("[WIZARD_EVENT] I just added X...")` → ChatPanel auto-send effect fires when not streaming → message sent to LLM with live context → Pecharunt responds with educational commentary.
- **`[WIZARD_EVENT]` prefix**: Messages starting with this are rendered with `ChatWizardEvent` component (dimmed, italic, distinct from user bubbles). The LLM sees them as user messages and responds naturally.
- **Turbopack + Prisma caching**: After ANY schema change or `prisma generate`, the dev server MUST be restarted. Turbopack caches the stale Prisma client and won't pick up changes otherwise.
