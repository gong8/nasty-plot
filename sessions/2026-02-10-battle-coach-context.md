# Session: Battle Coach Context Fix

**Date:** 2026-02-10
**Duration context:** Medium

## What was accomplished

- Fixed the battle coach chat feature so the LLM actually receives battle state data when the user clicks "Coach" during a live battle
- Fixed a race condition where streamed chat responses were silently dropped on new session creation, requiring a second message to see any output
- Built a comprehensive battle state serializer that sends full tactical context to the LLM on every message

## Key decisions & rationale

- **Deferred `switchSession` to after streaming completes** — rather than calling `switchSession` immediately when the `X-Session-Id` header arrives (which caused ChatPanel to reset messages mid-stream), we store the ID in a ref and call `switchSession` in the `finally` block. This avoids the race condition while still updating the sidebar session list after the response is visible.
- **Guard in `resetForSession` via `currentSessionIdRef`** — even with deferred `switchSession`, the ChatPanel effect would still call `resetForSession` and flash-clear messages. Added a ref-based guard: if the hook already owns the session (ref matches), skip the reset entirely. This prevents the post-stream `switchSession` from clearing the just-rendered response.
- **Rich context in `contextSummary` rather than `contextData`** — `contextData` is stored once at session creation and is static. `contextSummary` is sent with every message from the live page context. Since battle state changes every turn, the serialized state goes through `contextSummary` so each message includes the current turn's full state.
- **Include live `contextSummary` even when `contextMode` is set** — previously `chat.service.ts` skipped `context.contextSummary` when a `contextMode` was active (line 112: `if (context && !contextMode)`). Changed to always include `contextSummary` as a `## Live State` section, since context-locked sessions still need real-time page data.

## Bugs found & fixed

### 1. Coach receives no battle state (move hallucination)

**Symptoms:** LLM would suggest moves the player's Pokemon doesn't have, couldn't assess matchups, gave generic advice.
**Root cause:** `buildContextData()` in `new-chat-modal.tsx` only passed `pageContext.formatId` for `battle-live` mode — which was always `undefined` (derived from `teamData?.formatId`, only set for team pages). The `contextSummary` had basic info but was skipped when `contextMode` was set. Result: the LLM got the "battle coach" role prompt but zero game state.
**Fix:** (a) Added battle state fields to `buildContextData()` (team names, game type from `battleState`). (b) Changed `chat.service.ts` to include `context.contextSummary` as `## Live State` even when `contextMode` is active. (c) Replaced the one-liner `contextSummary` with `serializeBattleState()` — a full tactical snapshot.

### 2. Chat response invisible until second message

**Symptoms:** User sends a message via Coach, tools execute (visible), but no text response appears. Sending a second message makes the first response appear.
**Root cause:** Race condition in `use-chat-stream.ts`. When creating a new session: (1) `switchSession(newSessionId)` fires before stream body is read, (2) ChatPanel detects session change → calls `resetForSession()` → `setMessages([])`, (3) stream content arrives but `prev` is now `[]` so updates silently fail.
**Fix:** (a) Defer `switchSession` to `finally` block via `deferredSessionIdRef`. (b) Add `currentSessionIdRef` guard in `resetForSession` — skip if hook already owns the session.

## Pitfalls & gotchas encountered

- **`pageContext.formatId` is only set for team pages** — it's derived from `teamData?.formatId`. Battle pages don't have a team query, so `formatId` is always `undefined` there. The `buildContextData` function for `battle-live` was trying to use this and getting nothing.
- **`contextMode` suppressed page context** — the original code had `if (context && !contextMode)` which meant any context-locked session lost all live page data. This is wrong for battle modes where the state changes every turn.
- **`BattleState.format` is `"singles" | "doubles"`** (game type), NOT a format ID like `"gen9ou"`. Initially tried using it as `formatId`, had to use `gameType` instead.
- **`BattleState` has no `aiDifficulty` field** — that's only in the `useBattle` hook config, not the state object.

## Files changed

- `apps/web/src/features/chat/components/new-chat-modal.tsx` — import `useBattleStateContext`, populate `buildContextData()` with battle state for `battle-live`
- `apps/web/src/features/chat/hooks/use-chat-stream.ts` — defer `switchSession` via refs, add guard in `resetForSession`
- `apps/web/src/features/chat/context/page-context-provider.tsx` — added `serializeBattleState()` and helper functions, replaced one-liner battle context with full serializer for both `battle-live` and `battle-replay`
- `packages/llm/src/chat.service.ts` — include `context.contextSummary` as `## Live State` even when `contextMode` is set

## Known issues & next steps

- **eslint warnings from pre-commit hook:** `<img>` in `chat-sidebar.tsx` (should use `next/image`), and `processQueue` accessed before declaration in `use-battle-animations.ts` (hoisting issue with `useCallback`)
- **Bench Pokemon matching** — the serializer uses `speciesId + hp` to distinguish active from bench. This could mismatch in doubles if two of the same species are on a team (extremely rare but possible). A proper slot index comparison would be more robust.
- **Opponent known moves** — depends on what `@pkmn/sim` populates on `BattlePokemon.moves` for the opponent side. If the sim doesn't populate opponent moves until revealed, the serializer will show an empty list for unrevealed Pokemon, which is correct behavior.
- **No format ID in battle context** — `BattleState` doesn't store the format ID (e.g. `"gen9ou"`). The coach gets game type ("singles"/"doubles") but not the specific tier. Would need to thread it from `useBattle` config → `BattleState` or through page context.
- **Context size** — the full serialized battle state is substantially larger than the old one-liner. Should monitor token usage to ensure it doesn't bloat the system prompt excessively, though for coaching purposes the detail is essential.

## Tech notes

- **Context flow for chat:** Client builds `contextSummary` (page-context-provider) → sent in POST body as `context.contextSummary` (use-chat-stream) → API forwards to `streamChat` (chat.service) → included in system prompt. This happens per-message, so it's always current.
- **`contextData` vs `contextSummary`:** `contextData` is stored on the DB session at creation time (static). `contextSummary` is live from the page on every message. For battle coaching, `contextSummary` is the one that matters.
- **`switchSession` propagation path:** `use-chat-stream` → `ChatProvider` (sets `activeSessionId`) → `ChatPanel` (reads via `useChatSidebar`) → `useEffect` compares to `prevSessionRef` → calls `resetForSession`. This cascade is why calling `switchSession` mid-stream was destructive.
