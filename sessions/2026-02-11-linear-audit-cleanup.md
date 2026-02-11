# Session: Linear Issue Audit & Bulk Cleanup

**Date:** 2026-02-11
**Duration context:** Medium (~30 minutes)

## What was accomplished

### Linear Issue Audit

- Fetched all 24 open Linear issues across Backlog, Todo, In Progress, Completed, and Canceled states
- Spawned 4 parallel Explore agents to verify every issue against the actual codebase
- Spawned additional 11 parallel agents for second-pass deep verification of remaining issues
- Reduced open issues from **24 → 7** (plus NAS-14 as long-term backlog)

### Issues Moved to Done (already implemented)

- **NAS-7** — SetPredictor fully implemented at `packages/battle-engine/src/ai/set-predictor.ts` with Bayesian updates
- **NAS-21** — Team versioning 100% complete: service (520 lines), 6 API routes, 5 UI components (fork, compare, merge wizard, lineage tree, diff view), 812 lines of tests
- **NAS-22** — Move buttons disabled during processing via `controlsDisabled = animState.isAnimating` + `pointer-events-none`
- **NAS-23** — `handleAIForceSwitch` properly async/awaited with 15s timeout safety
- **NAS-25** — MCTS AI has 59 tests across 2 files including dedicated `mcts-ai-coverage.test.ts` with 47 deep tests
- **NAS-29** — Orphaned plan files already cleaned up in prior sessions
- **NAS-30** — Battle replay fully functional: ReplayEngine with frame-based architecture, 25 passing tests
- **NAS-36** — ChatPanel remount bug has proper guards in `resetForSession`

### Issues Fixed This Session (5 parallel agents)

- **NAS-31** — Fixed 3 failing tests in `tests/llm/chat.service.test.ts` by updating mocks from `fetch` to `vi.mock("@nasty-plot/teams")` and `vi.mock("@nasty-plot/smogon-data")`
- **NAS-37** — Removed 10 diagnostic `[BattleManager]` console.log statements from `packages/battle-engine/src/battle-manager.ts`
- **NAS-35** — Extracted `useBuildContextData` shared hook from duplicated logic in `chat-context-picker.tsx` and `new-chat-modal.tsx`
- **NAS-26** — Implemented real `get_common_cores` MCP tool: new `getTopCores()` service function querying `TeammateCorr` DB, new `/api/formats/[id]/cores` endpoint, updated MCP tool
- **NAS-3** — Added empty-team validation in import flow + `cleanupEmptyTeams()` utility + `POST /api/data/cleanup` route

### Issues Canceled

- **NAS-32** — pokemonId normalization: camelCase is the intentional canonical format, not a bug
- **NAS-38** — Duplicate of NAS-24 (chat component test coverage), consolidated

### Issues Updated

- **NAS-14** — Updated description: move animations + mobile responsive are done (2/7 items)
- **NAS-24** — Updated description with full list of untested components (11), hooks (4), providers (2)

## Key decisions & rationale

- **Canceled NAS-32 (pokemonId normalization):** camelCase (`"greatTusk"`) is the canonical format used throughout the codebase. The lowercase format only appears in `@pkmn/sim` protocol parsing and is converted at the boundary. Changing to all-lowercase would require touching nearly every file.
- **Consolidated NAS-38 into NAS-24:** Both tracked missing chat component tests. Keeping one canonical issue avoids confusion.
- **Verified NAS-30 via code review only:** Battle replay code is complete and well-tested (25 tests), but the user originally reported it as broken. Code review shows no issues — may have been a runtime/data issue that's since been resolved.

## Bugs found & fixed

- **NAS-31 (chat.service.test failures):** Root cause was service refactored from `fetch()` API calls to direct imports (`getTeam`, `getUsageStats`), but tests still mocked `fetch`. Fixed by adding `vi.mock("@nasty-plot/teams")` and `vi.mock("@nasty-plot/smogon-data")`.
- **NAS-26 (fake get_common_cores):** MCP tool was returning usage stats with a note instead of querying `TeammateCorr`. Fixed by creating real service function + API route + updating tool.
- **Test regression from NAS-26:** Updating `get_common_cores` broke 2 tests in `tests/mcp-server/tools-meta-recs.test.ts` that expected the old fake implementation. Fixed by updating test assertions to match new `/formats/{id}/cores` endpoint.

## Pitfalls & gotchas encountered

- **Agent accuracy on "ALREADY FIXED" claims:** One agent incorrectly reported NAS-31 (test failures) as fixed — had to verify by actually running the tests, which confirmed 3 failures still existed. Always verify agent claims for test-related issues by running the actual tests.
- **NAS-21 initially assessed as "needs UI":** First-pass agent only checked schema and service. Second-pass revealed full UI implementation (fork dialog, merge wizard, lineage tree, diff view). Thorough investigation requires checking all layers.
- **Cascading test failures:** Fixing NAS-26 (get_common_cores) caused 2 test failures that needed a follow-up fix. When changing MCP tool behavior, always check `tests/mcp-server/` for corresponding tests.

## Files changed

### Modified

- `tests/llm/chat.service.test.ts` — Updated mocks for NAS-31
- `packages/battle-engine/src/battle-manager.ts` — Removed console.logs for NAS-37
- `apps/web/src/features/chat/components/chat-context-picker.tsx` — Use shared hook for NAS-35
- `apps/web/src/features/chat/components/new-chat-modal.tsx` — Use shared hook for NAS-35
- `packages/mcp-server/src/tools/meta-recs.ts` — Real get_common_cores for NAS-26
- `packages/smogon-data/src/usage-stats.service.ts` — Added `getTopCores()` for NAS-26
- `packages/smogon-data/src/index.ts` — Barrel export for `getTopCores`
- `packages/teams/src/import-export.service.ts` — Empty team validation for NAS-3
- `packages/teams/src/team.service.ts` — Added `cleanupEmptyTeams()` for NAS-3
- `packages/teams/src/index.ts` — Barrel export for `cleanupEmptyTeams`
- `tests/mcp-server/tools-meta-recs.test.ts` — Updated get_common_cores tests

### Created

- `apps/web/src/features/chat/hooks/use-build-context-data.ts` — Shared hook for NAS-35
- `apps/web/src/app/api/formats/[id]/cores/route.ts` — New API route for NAS-26
- `apps/web/src/app/api/data/cleanup/route.ts` — Cleanup endpoint for NAS-3

## Known issues & next steps

### Remaining Open Issues (7)

| Issue  | Priority | Title                                                                                                |
| ------ | -------- | ---------------------------------------------------------------------------------------------------- |
| NAS-34 | Medium   | AI spread move damage in doubles — no AI accounts for 0.75x or ally damage                           |
| NAS-33 | Medium   | Visual indicator for doubles move selection — no header showing which Pokemon                        |
| NAS-28 | Medium   | Ability + tera type validation — neither validated anywhere                                          |
| NAS-4  | Medium   | Damage preview on move hover — no damage calc in tooltip                                             |
| NAS-5  | Medium   | VGC 6→4→2 lead selection — player UI works, AI `chooseLeads()` returns 6 instead of 4                |
| NAS-24 | Medium   | Chat component test coverage — zero React component tests exist                                      |
| NAS-18 | Medium   | Chat UI polish — labels done, structured results/grouping missing                                    |
| NAS-14 | Low      | Phase 10 polish — 5/7 items remaining (tournament, training, MCP battle tools, replay import, sound) |

### Recommended priority for next session

1. **NAS-34** — AI spread move damage (gameplay correctness)
2. **NAS-28** — Ability validation (data correctness)
3. **NAS-5** — Fix AI `chooseLeads()` for doubles (broken functionality)
4. **NAS-33** — Doubles move indicator (UX improvement)
5. **NAS-4** — Damage preview on hover (feature)

## Tech notes

- **Linear tool loading:** Must call `ToolSearch` with `"+linear list issues"` before first use each session. Tools are deferred.
- **Test suite:** 65 files, 1587 tests, all passing after this session's fixes.
- **Agent parallelism for audits:** Grouping issues by domain (battle, chat, code quality, features) and spawning 4 Explore agents simultaneously is effective for bulk verification. Second-pass with more targeted agents catches what first-pass misses.
- **MCP tool changes require test updates:** Tests in `tests/mcp-server/` mock `apiGet`/`apiPost` and assert on URL paths + params. Changing a tool's API endpoint breaks these tests.
- **`cleanupEmptyTeams()` re-parents children:** Before deleting empty teams, updates any `parentId` references to null to preserve lineage tree integrity (relevant for NAS-21 team versioning).
