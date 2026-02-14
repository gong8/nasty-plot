# Session: Fix Stubs Audit & Cleanup

**Date:** 2026-02-14
**Duration context:** Long (full codebase audit + 2 execution waves)

## What was accomplished

- Ran `/fix-stubs` command: full codebase audit for dead code, orphaned integrations, and broken integration chains
- Spawned 8 parallel Explore agents to audit the entire codebase simultaneously
- Synthesized findings into 31 categorized stubs, presented to user for decisions
- Executed fixes in 2 waves (4 agents each) with test verification between waves
- Fixed **4 critical bugs** (broken MCP tools, broken frontend data access)
- Removed **12 dead types**, **3 unused constants**, **1 dead service function**
- Internalized **31 barrel exports** that were internal-only across 8 packages
- Added move type/category filtering to the learnset API endpoint
- Replaced direct Prisma calls in server actions with service functions
- Inlined `getDataStatus()` logic into admin route after removing the service function

## Key decisions & rationale

- **Fix frontend type to match API** (not wrap API response) for FB-1 — simpler, no multi-consumer impact
- **Fix MCP tools to match API** (not add API aliases) — single source of truth for parameter names
- **Keep admin routes** (`/api/data/cleanup`, `/api/data/seed`, `/api/data/status`) — intentionally admin-only
- **Remove all 31 internal-only barrel exports** — reduces public API surface, enforces encapsulation
- **Remove all dead types** — MCTS worker types had no implementation, ChatContextData hierarchy was incorrectly flagged
- **Prefer REMOVE over WIRE** for unused code — less code is better

## Bugs found & fixed

1. **FB-1 (CRITICAL):** Battle Hub page never showed user teams. `useFetchData<{ teams?: ... }>` expected `{ teams: [...] }` but `/api/teams` returns a plain array. Fixed in `apps/web/src/app/battle/page.tsx`
2. **MA-1/MA-2 (CRITICAL):** `get_smogon_sets` and `suggest_sets` MCP tools sent `format` query param but API expected `formatId`. Always returned empty results. Fixed in `data-query.ts` and `meta-recs.ts`
3. **MA-3 (CRITICAL):** `suggest_counters` MCP tool sent `{ targetPokemonId, formatId, type: "counters" }` but `/api/recommend` expected `{ teamId, limit?, weights? }`. Always returned 400. Redesigned tool to accept `teamId`
4. **MA-4 (MEDIUM):** `get_common_cores` called `/formats/{id}/usage` instead of existing `/formats/{id}/cores` endpoint. Returned raw usage data instead of core pairs
5. **MA-5 (MEDIUM):** `get_moves_by_criteria` sent type/category filters but learnset API ignored them. Added filtering to API route

## Pitfalls & gotchas encountered

1. **Audit agents gave false positives for "dead" code:**
   - `createApiClient()` and `checkedFetch()` in `packages/core/src/api-client.service.ts` were flagged as completely unused, but are imported by `packages/mcp-server/src/api-client.ts` and `packages/battle-engine/src/ai/set-predictor.ts`. Had to restore after deletion broke tests and build
   - `ChatContextData` hierarchy (4 types) flagged as dead, but `ChatContextMode` is used extensively across 4+ frontend chat feature files. Had to restore from git history after deletion broke build
   - Lesson: audit agents searched barrel imports but missed some cross-package imports. Always verify with `pnpm build` before committing deletions
2. **Tests assert old (broken) behavior:** After fixing MCP tools, 6 tests failed because they tested the wrong parameter names. Had to update test expectations to match corrected behavior
3. **Admin route depended on deleted function:** `/api/data/status/route.ts` imported `getDataStatus` which we deleted. Had to inline the logic in the route
4. **Auto-commit during session:** Changes were auto-committed as `fix: fix stubs` (commit `6a81285`) mid-session, so `git checkout HEAD` couldn't restore files that were deleted in that commit. Had to use `git show <earlier-sha>:path` to recover content
5. **Pre-existing build error:** `automated-battle-manager.ts:177` has a `forceSwitch on type never` TypeScript error that predates our changes (verified by building from prior commit)

## Files changed

### Wave 1 — Critical Bug Fixes

- `apps/web/src/app/battle/page.tsx` — Fix teams type mismatch (FB-1)
- `packages/mcp-server/src/tools/data-query.ts` — Fix `get_smogon_sets` param (MA-1), leave `get_moves_by_criteria` as-is (MA-5 fix was API-side)
- `packages/mcp-server/src/tools/meta-recs.ts` — Fix `suggest_sets` param (MA-2), fix `get_common_cores` endpoint (MA-4)
- `packages/mcp-server/src/tools/analysis.ts` — Redesign `suggest_counters` schema (MA-3)
- `apps/web/src/app/api/pokemon/[pokemonId]/learnset/route.ts` — Add type/category query filtering (MA-5)
- `apps/web/src/app/pokemon/[pokemonId]/actions.ts` — Use `getActiveFormats()` service (IC-1)

### Wave 2 — Dead Code Removal + Barrel Cleanup

- `packages/core/src/types.ts` — Remove `ApiError`, `CheckCounterData`
- `packages/core/src/chat-context.ts` — Deleted then restored (was actually used)
- `packages/core/src/constants.ts` — Remove `ARCHETYPE_OPTIONS`, `VGC_LEVEL`, `LC_LEVEL`; internalize `StatusEntry`
- `packages/core/src/api-client.service.ts` — Deleted then restored (was actually used)
- `packages/core/src/type-chart.ts` — Internalize `EffectivenessBucket`
- `packages/core/src/index.ts` — Update barrel (remove chat-context, then re-add; remove then re-add api-client.service)
- `packages/battle-engine/src/types.ts` — Remove `BattleSetupConfig`
- `packages/battle-engine/src/ai/mcts-types.ts` — Remove 5 MCTS worker types
- `packages/battle-engine/src/index.ts` — Remove 13 types from barrel
- `packages/analysis/src/index.ts` — Remove `export * from "./constants"`
- `packages/recommendations/src/index.ts` — Remove `MAX_SCORE` export
- `packages/data-pipeline/src/staleness.service.ts` — Remove `getDataStatus()` function
- `packages/data-pipeline/src/index.ts` — Remove `getDataStatus` barrel export
- `packages/data-pipeline/src/data/sample-teams.ts` — Internalize `SampleTeamSeedEntry`
- `packages/teams/src/index.ts` — Remove 4 internal types from barrel
- `packages/llm/src/index.ts` — Remove 2 internal types from barrel
- `packages/llm/src/chat.service.ts` — Internalize `StreamChatOptions`
- `packages/ui/src/index.ts` — Remove 8 prop types from barrel
- `packages/smogon-data/src/index.ts` — Remove 5 types + 3 functions from barrel
- `packages/pokemon-data/src/index.ts` — Remove `IconData` from barrel
- `apps/web/src/app/api/data/status/route.ts` — Inline `getDataStatus` logic (was importing deleted function)

### Test Files

- `tests/mcp-server/tools-analysis.test.ts` — Update `suggest_counters` tests for new schema
- `tests/mcp-server/tools-data-query.test.ts` — Fix `format` → `formatId` assertion
- `tests/mcp-server/tools-meta-recs.test.ts` — Fix `format` → `formatId` + `get_common_cores` endpoint assertions
- `tests/smogon-data/set-inference.test.ts` — Change barrel import to direct `#smogon-data/set-inference.service` alias
- `tests/data-pipeline/staleness.service.test.ts` — Remove `getDataStatus` test block (function deleted)

### Plan

- `plans/fix-stubs.md` — Full audit plan with stub list, decisions, and wave architecture

## Known issues & next steps

- **Pre-existing build error:** `packages/battle-engine/src/simulation/automated-battle-manager.ts:177` — `Property 'forceSwitch' does not exist on type 'never'`. This is a TypeScript strictness issue in the type narrowing for `pendingP1Actions`. Existed before this session. Should be filed as a Linear issue.
- **4 tests removed:** `getDataStatus` tests were deleted since the function was removed. Net test count dropped from 1879 to 1875.
- **24 API routes without MCP tools:** The audit identified many API routes (battles, damage-calc matchup matrix, team export/import/archive/fork/lineage/compare/merge, sample teams) that have no corresponding MCP tool. These could be wired up in a future session.
- **`ARCHETYPE_OPTIONS` duplication:** The constant was removed from core but a local duplicate exists in `apps/web/src/app/battle/sample-teams/page.tsx:32-43`. Could be deduplicated by re-exporting from core in the future if needed.
- **`formatShowdownLog` in battle-engine:** Audit flagged as possibly unused but was left in place (LOW priority, ambiguous)
- **`MoveAction`/`SwitchAction` types:** Only used in `BattleAction` union composition. Left exported for API clarity.

## Tech notes

- **Barrel export removal pattern:** When removing symbols from `packages/*/src/index.ts`, check test files too — tests often import internal functions from barrels. Use the `#pkg/module` alias pattern (configured in `vitest.config.ts` line 28-30) for test-only imports of internal functions.
- **False positive risk in dead code audits:** Audit agents search for explicit `import { X } from "@nasty-plot/pkg"` patterns but can miss: (a) cross-package internal imports, (b) dynamic usage via barrel re-exports like `export * from "./module"`, (c) usage in non-TS files. Always verify deletions with both `pnpm test` AND `pnpm build`.
- **`pnpm test` vs `pnpm build` coverage gap:** Vitest doesn't type-check (no `--typecheck` flag configured). A module can pass all tests but fail the Next.js build's TypeScript checking. Always run both.
- **Auto-commit hooks:** The repo has hooks that auto-commit during sessions. Be aware that `git checkout HEAD -- file` won't work for files deleted in the auto-commit. Use `git show <sha>:path` to recover content from earlier commits.
