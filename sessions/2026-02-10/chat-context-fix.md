# Session: Fix Chat Context-Locked Sessions Not Seeing Team Data

**Date:** 2026-02-10
**Duration context:** Medium

## What was accomplished

- Diagnosed and fixed a critical bug where the LLM chat (Pecharunt) could not see the current team when using a context-locked chat from the guided team builder
- Replaced fragile server-to-self HTTP fetches in `chat.service.ts` with direct database calls via `@nasty-plot/teams` and `@nasty-plot/smogon-data`
- Added multi-layer fallback so `teamId`/`formatId` are extracted from `contextData` when missing from the request
- Enriched `contextData` stored at session creation to include full team composition (slot summaries)
- Updated `buildContextModePrompt` to render the new slot data in the system prompt

## Key decisions & rationale

- **Direct DB calls over self-fetch**: The `buildContextParts` function in `chat.service.ts` was fetching `http://localhost:3000/api/teams/{id}` from within the `/api/chat` route handler. This server-to-self fetch silently failed in the Next.js Turbopack dev server. Replaced with direct `getTeam()` and `getUsageStats()` calls — eliminates the network hop entirely and is architecturally valid since `llm` (Feature layer) can depend on `teams` and `smogon-data` (Domain layer).
- **Triple redundancy for team context**: The LLM now gets team info through three independent paths: (1) direct Prisma query via `getTeam()`, (2) slot summaries baked into `contextData` at session creation, (3) live `contextSummary` from `PageContextProvider`. If any one fails, the others provide coverage.
- **contextData fallback extraction**: Both the API route and `streamChat` now parse `teamId`/`formatId` from the `contextData` JSON string when they're not provided directly in the request. This handles timing issues where `pageContext` hasn't fully loaded.

## Bugs found & fixed

- **Chat context-locked sessions can't see team**: When a user opened a context-locked "Team Building Advisor" chat from the guided builder, the LLM had no knowledge of the current team. It would call `list_teams` and ask the user which team they wanted to work with, despite the UI showing "Context-locked". Root causes:
  1. `buildContextParts` made self-fetch HTTP calls to `localhost:3000` which silently failed in dev
  2. `contextData` only stored `teamId`, `teamName`, `formatId` — no actual team composition
  3. No fallback extraction of `teamId` from `contextData` when the request body was missing it

## Pitfalls & gotchas encountered

- **Silent error swallowing**: The `buildContextParts` function caught all fetch errors silently (`catch { // optional }`). This made the bug invisible — no error logs, no indication that team context was missing. The self-fetch would fail and the system prompt would just lack team data.
- **Next.js server-to-self fetch**: Making HTTP requests from a route handler back to the same Next.js server is unreliable, especially in dev with Turbopack. Direct service/Prisma calls are much more reliable.
- **Timing dependency in `buildContextData`**: The `new-chat-modal.tsx` builds context data from `pageContext.teamData`, which depends on a React Query completing. If the query hasn't finished when the modal opens, team name and format would be missing from `contextData`.

## Files changed

- `packages/llm/src/chat.service.ts` — Replaced self-fetches with direct `getTeam()`/`getUsageStats()` calls; added `contextData` fallback for teamId/formatId; removed unused `BASE_URL`
- `packages/llm/src/context-builder.ts` — `buildContextModePrompt()` now renders `slotsFilled` and numbered slot list from contextData
- `packages/llm/package.json` — Added `@nasty-plot/teams` and `@nasty-plot/smogon-data` as workspace dependencies
- `apps/web/src/app/api/chat/route.ts` — Added contextData fallback extraction for teamId/formatId; uses `effectiveTeamId`/`effectiveFormatId` in `streamChat` call
- `apps/web/src/features/chat/components/new-chat-modal.tsx` — `buildContextData()` now includes `slotsFilled` and `slots` array with composition summaries

## Known issues & next steps

- **Existing context-locked sessions**: Sessions created before this fix have minimal `contextData` (no slots). They'll work now because `getTeam()` is called directly, but their stored `contextData` won't have the enriched slot info.
- **Team editor context**: The same self-fetch issue likely affected `team-editor` context mode too — now fixed by the same changes.
- **Battle context modes**: `battle-live` and `battle-replay` context modes don't have a similar direct-query path (they rely on `contextSummary` from the live battle state). Worth auditing if those also have context reliability issues.
- **No tests for context flow**: The chat context assembly pipeline (route → streamChat → buildContextParts → system prompt) has no test coverage. A unit test for `buildContextParts` and `streamChat` context assembly would catch regressions.

## Tech notes

- `getTeam(id)` from `@nasty-plot/teams` returns `TeamData | null` directly via Prisma, including hydrated species data on slots
- `getUsageStats(formatId, { limit })` from `@nasty-plot/smogon-data` returns `UsageStatsEntry[]` directly via Prisma
- The `contextData` field on `ChatSession` is a JSON string stored in SQLite. It's set once at session creation and never updated — it's a snapshot of the state when the chat was opened
- The `contextSummary` in `PageContextProvider` is rebuilt on every render from the current page state, so it reflects live changes (e.g., new Pokemon added to team)
- The LLM system prompt is assembled in `streamChat()`: base prompt + team context (from DB) + meta context (usage stats) + context mode prompt (from contextData) + live state (from contextSummary) + plan mode instructions
