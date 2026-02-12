# Session: SSOT Deduplication — Waves 1 & 2

**Date:** 2026-02-12
**Duration context:** Long (multi-hour, context compaction occurred)

## What was accomplished

### Wave 1 — 5 parallel agents, all complete

- **constants-author**: Added 10 new constants to `packages/core/src/constants.ts`: `DEFAULT_LEVEL`, `VGC_LEVEL`, `LC_LEVEL`, `DEFAULT_FORMAT_ID`, `WEATHERS`, `TERRAINS`, `STATUSES`, `BOOST_VALUES`, `ARCHETYPE_OPTIONS`. All exported via barrel.
- **mcp-deduper**: Deleted inline `TYPE_CHART` (85 lines), `NATURES_DATA` (26 lines), `FORMATS_LIST` (10 lines) from `packages/mcp-server/src/resources/index.ts`. Replaced with imports from `@nasty-plot/core` and `@nasty-plot/formats`. Deleted local `DEFAULT_IVS`/`ZERO_EVS` from `tools/team-crud.ts`, imported from core.
- **cn-sweeper**: Deleted `apps/web/src/lib/utils.ts`. Updated 72+ files in `apps/web/` from `import { cn } from "@/lib/utils"` to `import { cn } from "@nasty-plot/ui"`.
- **types-consolidator**: Fixed all 13 duplicate type definitions (T1–T13):
  - Moved `PageType`, `ExtractedPokemonData`, `ExtractedTeamData` to `@nasty-plot/core`
  - Renamed web's `ChatMessage` to `UIChatMessage`
  - Unified `ShowdownReplayJSON`/`ShowdownReplayJson` in `battle-engine/src/types.ts`
  - Replaced `BattleFormat` with `GameType` from core
  - Defined `DexMove` once in `battle-engine/src/types.ts`
  - Renamed data-pipeline's `SampleTeamEntry` to `SampleTeamSeedEntry`
  - Created shared `BattleSummary`, `TeamValidation` in `apps/web/src/features/battle/types.ts`
  - Created shared `SortMode` in `apps/web/src/features/pokemon/types.ts`
  - Deleted `PlanStep` duplicate from `chat-plan-display.tsx`
  - Deleted `TeamBattleAnalytics` copy from web, imports from `@nasty-plot/battle-engine`
- **llm-deduper**: Created `packages/llm/src/config.ts` with shared `MCP_URL` and `MODEL` constants. Updated `mcp-client.ts`, `cli-chat.ts`, `chat.service.ts`, `openai-client.ts` to import from config. Made `tool-labels.ts` derive keys from `TOOL_CATEGORIES`.

### Wave 2 — 6 parallel agents, all complete

- **constants-sweeper-packages**: Replaced hardcoded constants across `packages/`:
  - `DEFAULT_LEVEL` in `showdown-paste.ts`, `protocol-parser.ts`, `replay-import.ts`, `calc.service.ts`
  - `DEFAULT_FORMAT_ID` in `battle-manager.ts`, `automated-battle-manager.ts`, `mcts-ai.ts`, `replay-import.ts`, `analysis.ts`, `set-inference.service.ts`
  - `DEFAULT_EVS` in `protocol-parser.ts`
  - `STATS` in `chaos-sets.service.ts`, `version.service.ts`
  - `MAX_TOTAL_EVS`/`MAX_SINGLE_EV` in `stat-calc.ts`
- **constants-sweeper-web**: Replaced all hardcoded constants across `apps/web/`:
  - `DEFAULT_LEVEL` in `use-guided-builder.ts`, `guided-builder-provider.tsx`, `damage-calculator.tsx`, `slot-editor.tsx`
  - `DEFAULT_FORMAT_ID` in `teams/new/page.tsx`, `battle/live/page.tsx`, `battle/simulate/page.tsx`, `BattleSetup.tsx`
  - `DEFAULT_EVS`/`DEFAULT_IVS` in `damage-calculator.tsx`, `slot-editor.tsx`, `simplified-set-editor.tsx`
  - `MAX_TOTAL_EVS`/`MAX_SINGLE_EV` in `damage-calculator.tsx`
  - `WEATHERS`, `TERRAINS`, `STATUSES`, `BOOST_VALUES` in `damage-calculator.tsx`
  - `ARCHETYPE_OPTIONS` in `sample-teams/page.tsx`
- **constants-sweeper-tests**: Updated 17 test files to import `DEFAULT_IVS`, `DEFAULT_EVS`, `DEFAULT_LEVEL` from `@nasty-plot/core` instead of hardcoded literals. Used spread patterns for overrides (e.g., `{ ...DEFAULT_EVS, atk: 252 }`).
- **pokemon-data-expander**: Confirmed `getMove()`, `getAbility()`, `getItem()` already existed. Did NOT add `getGen9()`, `getType()`, `resolveSpeciesName()`, `getMoveByName()` (see Known Issues).
- **util-deduper**:
  - U3: Exported `flattenDamage` from `damage-calc`, imported in `battle-engine/ai/shared.ts`
  - U4: Kept `getTypeEffectiveness` local in battle-engine (different semantics — defensive damageTaken vs offensive TYPE_CHART). Widened core's type signature to accept `string`.
  - U5: `teamToShowdownPaste` now wraps `serializeShowdownPaste` from core with Dex hydration
  - U6: Moved ~170-line `serializeBattleState` (including `serializeSide`, `serializePokemon`, `serializeSideConditions`) from web to `packages/battle-engine/src/battle-state-serializer.ts`
  - U7: Extracted `HAZARD_SCORES`, `STATUS_INFLICTION_SCORES`, `SETUP_MOVE_SCORE`, `RECOVERY_SCORES`, `HAZARD_REMOVAL_BASE`, `HAZARD_REMOVAL_PER_HAZARD` to `battle-engine/ai/shared.ts`
- **frontend-components**:
  - F1: Created `apps/web/src/features/team-builder/components/shared/move-input.tsx` (~135 lines extracted, `compact` prop for size variants)
  - F2: Created `shared/nature-selector.tsx` with popularity sorting + exported `useNaturesByPopularity` hook
  - F3: Created `shared/tera-type-picker.tsx`
  - Replaced inline `TYPE_COLORS` + `isLightTypeColor()` badge rendering with `<TypeBadge>` from `@nasty-plot/ui` in `pokemon-search-panel.tsx`, `team-grid.tsx`, `slot-editor.tsx`, `simplified-set-editor.tsx`
  - ~400+ lines of duplicated code removed from the two editors

### Post-Wave Cleanup

- Fixed 8 ESLint errors left by agents: removed unused `StatsTable` imports (4 files), unused `DEFAULT_EVS` import (1 file), prefixed unused `resultNoWeather` variable (1 file), replaced `Function` type with proper callback signature (1 file, 2 occurrences)
- Fixed `"gen9uber"` → `"gen9ubers"` typo in `packages/mcp-server/src/tools/data-query.ts:44` (found during verification, reverted by Agent 6, re-fixed)

### Tooling

- Created `/ssot` slash command at `.claude/commands/ssot.md` — a reusable 5-phase workflow: parallel audit → synthesis → design questions → plan generation → wave-based execution
- Wrote Wave 3 handoff prompt at `sessions/2026-02-12-wave3-prompt.md`

## Key decisions & rationale

1. **`getTypeEffectiveness` kept local in battle-engine** — The battle-engine version uses `@pkmn/dex` defensive `damageTaken` encoding (how much damage defTypes deal TO atkType), while core's version uses offensive TYPE_CHART semantics. These produce different results for the same inputs. Keeping both with a docstring was the correct call.
2. **Lazy `getGen9()` instead of `gen9` constant** — Agent 9 discovered that eagerly creating `new Generations(Dex).get(9)` at module load time crashes tests that mock `@pkmn/dex` (recommendations tests). Solution: lazy function pattern.
3. **`teamToShowdownPaste` kept as a wrapper** — Can't simply delete and import from core because the battle-engine version hydrates species display names via `@pkmn/dex` before delegating to core's `serializeShowdownPaste`. Legitimate wrapper, not duplication.
4. **Test files updated to use constants** — Per pre-approved decision, tests import `DEFAULT_IVS`/`DEFAULT_EVS`/`DEFAULT_LEVEL` from core for full consistency.
5. **cn() sweep committed separately** — Per plan requirement, this is an isolated concern.

## Bugs found & fixed

1. **`"gen9uber"` typo in MCP server** — `packages/mcp-server/src/tools/data-query.ts:44` had `gen9uber` instead of `gen9ubers` in an error message hint. Found during Wave 1 verification. Fixed, then reverted when Agent 6 edited the same file for `DEFAULT_FORMAT_ID` replacement. Re-fixed after Wave 2.
2. **ESLint `no-unused-vars` errors (8)** — Agents left behind unused imports (`StatsTable` in 4 test files, `DEFAULT_EVS` in 1 test file) and one unused variable (`resultNoWeather`). Also two `Function` type usages violating `@typescript-eslint/no-unsafe-function-type`.
3. **`team-packer.test.ts` failures** — After Agent 10 changed `teamToShowdownPaste` to delegate to core's serializer (which uses `slot.species?.name`), tests needed a `species` object added to test data's `makeSlot`. Agent 8 fixed this.

## Pitfalls & gotchas encountered

1. **Agent file conflicts** — When multiple agents edit the same file (e.g., Agent 2 and Agent 6 both touching `data-query.ts`), later agents can overwrite earlier fixes. Always re-verify after waves.
2. **Agent reporting vs reality** — The pokemon-data-expander agent reported adding `getGen9()`, `getType()`, `resolveSpeciesName()`, `getMoveByName()`, but none of these exist in the final code. Always verify agent claims with actual file reads.
3. **Unused imports after dedup** — When agents replace inline objects with constant imports, they sometimes leave the original type imports behind. ESLint catches these but agents should clean up.
4. **`@pkmn/dex` raw vs mapped types** — `pokemon-data`'s `getMove()` returns `MoveData | null` (mapped), but AI files need raw Dex move objects with `.flags`, `.priority`, `.secondary`. Wave 3 needs `getRawMove()` and `getRawSpecies()` wrappers.

## Files changed

### New files created

- `packages/llm/src/config.ts`
- `packages/battle-engine/src/battle-state-serializer.ts`
- `apps/web/src/features/battle/types.ts`
- `apps/web/src/features/pokemon/types.ts`
- `apps/web/src/features/team-builder/components/shared/move-input.tsx`
- `apps/web/src/features/team-builder/components/shared/nature-selector.tsx`
- `apps/web/src/features/team-builder/components/shared/tera-type-picker.tsx`
- `apps/web/src/lib/constants.ts`
- `.claude/commands/ssot.md`
- `sessions/2026-02-12-wave3-prompt.md`

### Files deleted

- `apps/web/src/lib/utils.ts` (cn() duplicate)

### Packages modified (production code)

- `packages/core/src/constants.ts` — added 10 new constants
- `packages/core/src/types.ts` — added `PageType`, `ExtractedPokemonData`, `ExtractedTeamData`
- `packages/core/src/type-chart.ts` — widened `getTypeEffectiveness` to accept `string`
- `packages/core/src/index.ts` — updated barrel exports
- `packages/core/src/stat-calc.ts` — replaced hardcoded 510/252 with constants
- `packages/core/src/showdown-paste.ts` — replaced `level: 100` with `DEFAULT_LEVEL`
- `packages/mcp-server/src/resources/index.ts` — deleted 3 inline constants, imports from core/formats
- `packages/mcp-server/src/tools/team-crud.ts` — deleted local DEFAULT_IVS/ZERO_EVS
- `packages/mcp-server/src/tools/data-query.ts` — fixed `gen9uber` → `gen9ubers`
- `packages/llm/src/mcp-client.ts` — imports MCP_URL from config
- `packages/llm/src/cli-chat.ts` — imports MCP_URL from config
- `packages/llm/src/chat.service.ts` — imports MODEL from config
- `packages/llm/src/openai-client.ts` — imports MODEL from config
- `packages/llm/src/tool-labels.ts` — derives keys from TOOL_CATEGORIES
- `packages/llm/src/tool-context.ts` — exports PageType from core
- `packages/battle-engine/src/types.ts` — added ShowdownReplayJSON, DexMove, removed BattleFormat
- `packages/battle-engine/src/battle-manager.ts` — DEFAULT_FORMAT_ID
- `packages/battle-engine/src/simulation/automated-battle-manager.ts` — DEFAULT_FORMAT_ID
- `packages/battle-engine/src/ai/mcts-ai.ts` — DEFAULT_FORMAT_ID
- `packages/battle-engine/src/ai/shared.ts` — imports flattenDamage from damage-calc, added score constants, docstring for getTypeEffectiveness
- `packages/battle-engine/src/ai/hint-engine.ts` — uses shared score constants
- `packages/battle-engine/src/ai/heuristic-ai.ts` — uses shared score constants
- `packages/battle-engine/src/team-packer.ts` — delegates to core's serializeShowdownPaste
- `packages/battle-engine/src/protocol-parser.ts` — DEFAULT_LEVEL, DEFAULT_EVS
- `packages/battle-engine/src/replay/replay-import.ts` — DEFAULT_LEVEL, DEFAULT_FORMAT_ID, deleted local ExtractedPokemonData
- `packages/battle-engine/src/index.ts` — exports serializeBattleState
- `packages/damage-calc/src/calc.service.ts` — exported flattenDamage, DEFAULT_LEVEL
- `packages/damage-calc/src/index.ts` — exports flattenDamage
- `packages/smogon-data/src/chaos-sets.service.ts` — STATS from core
- `packages/smogon-data/src/set-inference.service.ts` — deleted local ExtractedPokemon, DEFAULT_FORMAT_ID
- `packages/teams/src/version.service.ts` — STATS from core
- `packages/data-pipeline/src/data/sample-teams.ts` — renamed type to SampleTeamSeedEntry

### Web app modified (72+ files for cn() sweep, plus)

- `apps/web/src/features/chat/hooks/use-chat-stream.ts` — renamed ChatMessage to UIChatMessage
- `apps/web/src/features/chat/components/chat-message.tsx` — uses UIChatMessage
- `apps/web/src/features/chat/components/chat-panel.tsx` — uses UIChatMessage
- `apps/web/src/features/chat/components/chat-input.tsx` — uses UIChatMessage
- `apps/web/src/features/chat/components/new-chat-modal.tsx` — uses UIChatMessage
- `apps/web/src/features/chat/components/chat-context-picker.tsx` — uses UIChatMessage
- `apps/web/src/features/chat/context/page-context-provider.tsx` — imports serializeBattleState from battle-engine, PageType from core
- `apps/web/src/features/battle/hooks/use-sample-teams.ts` — imports SampleTeamData from teams
- `apps/web/src/features/battle/hooks/use-team-battles.ts` — imports TeamBattleAnalytics from battle-engine, BattleSummary from shared types
- `apps/web/src/features/battle/components/BattleSetup.tsx` — DEFAULT_FORMAT_ID, TeamValidation from shared types
- `apps/web/src/features/battle/components/TeamPicker.tsx` — TeamValidation from shared types
- `apps/web/src/features/battle/components/CommentaryPanel.tsx` — cn from @nasty-plot/ui
- `apps/web/src/features/damage-calc/components/damage-calculator.tsx` — all constants from core
- `apps/web/src/features/team-builder/components/slot-editor.tsx` — DEFAULT_LEVEL/EVS/IVS, shared components
- `apps/web/src/features/team-builder/components/guided/simplified-set-editor.tsx` — shared components
- `apps/web/src/features/team-builder/hooks/use-guided-builder.ts` — DEFAULT_LEVEL
- `apps/web/src/features/team-builder/context/guided-builder-provider.tsx` — DEFAULT_LEVEL
- `apps/web/src/features/team-builder/components/team-header.tsx` — cn from @nasty-plot/ui
- `apps/web/src/app/battle/page.tsx` — BattleSummary from shared types
- `apps/web/src/app/battle/sample-teams/page.tsx` — ARCHETYPE_OPTIONS from core
- `apps/web/src/app/battle/live/page.tsx` — DEFAULT_FORMAT_ID
- `apps/web/src/app/battle/simulate/page.tsx` — DEFAULT_FORMAT_ID
- `apps/web/src/app/teams/new/page.tsx` — DEFAULT_FORMAT_ID
- `apps/web/src/app/pokemon/page.tsx` — SortMode from shared types
- `apps/web/src/app/api/pokemon/route.ts` — SortMode from shared types
- `apps/web/src/features/battle/components/pokemon-search-panel.tsx` — TypeBadge from @nasty-plot/ui
- `apps/web/src/features/team-builder/components/team-grid.tsx` — TypeBadge from @nasty-plot/ui

### Test files modified (17)

- `tests/analysis/coverage.service.test.ts`
- `tests/analysis/synergy.service.test.ts`
- `tests/analysis/threat.service.test.ts`
- `tests/battle-engine/set-predictor.test.ts`
- `tests/battle-engine/team-packer.test.ts`
- `tests/core/showdown-paste.test.ts`
- `tests/core/stat-calc.test.ts`
- `tests/core/validation.test.ts`
- `tests/damage-calc/calc.service.test.ts`
- `tests/llm/context-builder.test.ts`
- `tests/mcp-server/tools-team-crud.test.ts`
- `tests/recommendations/coverage-recommender.test.ts`
- `tests/teams/import-export.service.test.ts`
- `tests/teams/team-matcher.test.ts`
- `tests/teams/team.service.test.ts`
- `tests/teams/validation.service.test.ts`
- `tests/teams/version.service.test.ts`

## Known issues & next steps

### Wave 3 remains (5 agents)

Full prompt written at `sessions/2026-02-12-wave3-prompt.md`. Key tasks:

1. **Pre-task**: Add missing pokemon-data wrappers (`getGen9()`, `getType()`, `resolveSpeciesName()`, `getRawMove()`, `getRawSpecies()`)
2. **dex-migrator-battle-engine**: Migrate 6 battle-engine files from `@pkmn/dex` to `@nasty-plot/pokemon-data`
3. **dex-migrator-other**: Migrate 6 files in recommendations, analysis, damage-calc
4. **service-deduper**: Deduplicate `dbSlotToDomain` (4 copies → 1), direct prisma usage (S3), format resolution (S6)
5. **calc-boilerplate**: Extract `calculateBattleDamage()` helper to reduce `@smogon/calc` boilerplate in 3 AI files
6. **frontend-cleanup**: Load sample teams from DB (F4), shared query hooks (F7), PokemonSprite usage (F8)

### Missing pokemon-data wrappers

Agent 9 (pokemon-data-expander) reported adding `getGen9()`, `getType()`, `resolveSpeciesName()` but they don't exist in the code. Must be added before Wave 3 dex migration.

### 13 `@pkmn/dex` direct imports remain

Outside of `packages/pokemon-data/` (canonical), 13 files still import directly from `@pkmn/dex`. Wave 3 addresses all of them.

### 4 `new Generations(Dex)` instances

In `calc.service.ts`, `greedy-ai.ts`, `heuristic-ai.ts`, `hint-engine.ts`. Wave 3 replaces with shared `getGen9()`.

## Tech notes

- **`@pkmn/dex` damageTaken encoding**: `0`=neutral, `1`=super effective, `2`=resist, `3`=immune. Counterintuitive. Core's `getTypeEffectiveness()` uses offensive semantics. Battle-engine's uses defensive semantics. They are NOT interchangeable.
- **Raw vs mapped Dex types**: `pokemon-data`'s `getMove()` returns `MoveData | null` (clean mapped type). AI files need raw Dex objects with `.flags`, `.priority`, `.secondary`, `.target`. Wave 3 needs `getRawMove()`/`getRawSpecies()` for these.
- **Lazy initialization for gen9**: `new Generations(Dex).get(9)` at module scope crashes mocked tests. Use lazy `getGen9()` function.
- **Agent file conflicts**: When 2 agents edit the same file in the same wave, later writes can overwrite earlier fixes. Always verify shared files after waves.
- **Agent reporting accuracy**: Don't trust agent completion messages at face value. Always verify with file reads or grep.
- **Test count**: 1896 tests across 80 test files, all passing after Waves 1+2.
