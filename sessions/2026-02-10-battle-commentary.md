# Session: Persist & Auto-Stream Battle Commentary

**Date:** 2026-02-10
**Duration context:** Medium

## What was accomplished

- Added `commentary` field to the `Battle` Prisma model to persist commentary as JSON `Record<number, string>` (turn number → commentary text)
- Created new `PUT /api/battles/[battleId]/commentary` endpoint for incremental commentary persistence (merge-on-write)
- Updated `POST /api/battles` to accept and store commentary on battle creation
- Updated `GET /api/battles/[battleId]/replay` to return persisted commentary
- Refactored `CommentaryPanel` to support three new props: `initialCommentary` (pre-loaded from DB), `onCommentaryGenerated` (callback after streaming completes), and `autoMode` (auto-fetch commentary on every turn change)
- Added **"Live" toggle button** in `BattleView` — when Commentary is enabled, a secondary toggle appears to turn on auto-commentary that streams analysis after every turn
- Updated `BattleView` to track accumulated commentary in a ref, pass it to `onSave`, and persist incrementally after save via PUT endpoint
- Updated `useBattle` hook's `saveBattle` to accept optional `commentary` parameter
- Updated replay page to parse persisted commentary from API, display it in the Commentary tab, and persist newly generated commentary via PUT
- Ran Prisma migration `20260210204902_add_battle_commentary` and regenerated client

## Key decisions & rationale

- **JSON string in `commentary` column** rather than separate `BattleCommentary` table — avoids needing to create `BattleTurn` records for live battles (which currently don't use them). Simple merge-on-write via PUT endpoint.
- **`Record<number, string>` keyed by turn** — natural deduplication (one commentary per turn), simple to merge, easy to look up by current frame in replay
- **Auto-mode with 500ms delay** — gives time for log entries to fully populate after a turn transition before sending to the LLM
- **Incremental persistence after save** — once a battle has a `savedId`, new commentary goes directly to the PUT endpoint rather than accumulating only in memory
- **`useRef` for commentary accumulation in BattleView** — avoids unnecessary re-renders since commentary data doesn't drive UI rendering (the CommentaryPanel manages its own display state)

## Bugs found & fixed

- None encountered during this session

## Pitfalls & gotchas encountered

- The `onSave` prop type on `BattleView` changed from `() => Promise<string | null>` to `(commentary?: Record<number, string>) => Promise<string | null>` — the live battle page needed updating to pass the commentary through
- Pre-existing type error in `chat-session-list.tsx` (unrelated `newSession` reference) — not introduced by this session

## Files changed

- `prisma/schema.prisma` — added `commentary String?` to Battle model
- `prisma/migrations/20260210204902_add_battle_commentary/migration.sql` — auto-generated
- `apps/web/src/app/api/battles/route.ts` — accept + persist commentary in POST
- `apps/web/src/app/api/battles/[battleId]/replay/route.ts` — return commentary in select
- `apps/web/src/app/api/battles/[battleId]/commentary/route.ts` — **new** PUT endpoint
- `apps/web/src/features/battle/components/CommentaryPanel.tsx` — full refactor with autoMode, initialCommentary, onCommentaryGenerated
- `apps/web/src/features/battle/components/BattleView.tsx` — commentary ref, Live toggle, updated onSave signature
- `apps/web/src/features/battle/hooks/use-battle.ts` — saveBattle accepts commentary param
- `apps/web/src/app/battle/replay/[battleId]/page.tsx` — load/persist commentary, pass to CommentaryPanel
- `apps/web/src/app/battle/live/page.tsx` — wire commentary through to saveBattle

## Known issues & next steps

- **No bulk commentary endpoint** — if you wanted to save all commentary at once (e.g. batch update), you'd need a new endpoint. Current PUT merges one turn at a time.
- **Commentary during replay playback** — auto-mode is not wired in replay (only manual "Analyze Turn"). Could add auto-commentary during replay playback if desired.
- **Pre-existing type error** in `apps/web/src/features/chat/components/chat-session-list.tsx:36` — `newSession` reference is undefined, unrelated to this work.
- **Commentary panel scroll** — `ScrollArea` ref forwarding may not work with all Radix versions; if auto-scroll doesn't work, may need to use a plain div with overflow-y-auto instead.

## Tech notes

- The commentary PUT endpoint does read-modify-write on the JSON string (parse existing → merge → stringify → update). This is fine for SQLite single-writer but could race under concurrent writes. Not an issue for single-user app.
- `CommentaryPanel` auto-mode uses a `lastAutoTurnRef` to prevent re-triggering for the same turn. The `useEffect` dependency on `fetchCommentary` means it re-evaluates when state changes, but the ref guard ensures it only fires once per turn.
- The `fetchCommentary` callback checks `comments[turn]` to skip turns that already have commentary — this means replaying a saved battle with existing commentary won't re-fetch from the LLM.
- All 1299 tests pass (53 files) after changes — no regressions.
