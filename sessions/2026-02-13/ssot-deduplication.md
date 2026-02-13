# Session: SSOT Deduplication

**Date:** 2026-02-13
**Duration context:** Long (full audit + 3-wave parallel execution)

## What was accomplished

### Phase 1-2: Audit & Synthesis

- Ran 8 parallel Explore agents to audit the entire codebase for SSOT violations
- Identified 37 violations across 80+ files in 8 categories: types, constants, utilities, services, package boundaries, frontend components, naming, imports
- Synthesized findings into a prioritized plan with severity ratings

### Phase 3-4: Design Questions & Plan

- Resolved 15 interactive design decisions with user input
- Key decisions: consolidate `getTypeEffectiveness` to core (offensive semantics), create `createApiClient` factory in core, extract Prisma queries to server actions, rename `fetch*` to `sync*`/`get*`
- Generated comprehensive execution plan at `plans/ssot-deduplication.md`

### Phase 5: Three-Wave Parallel Execution

**Wave 1 (6 agents) — Created canonical sources:**

- Added `TEAM_SIZE`, `PERFECT_IV`, unified `STATUS_DATA` constant to `packages/core/src/constants.ts`
- Created `packages/core/src/utils.ts` with `normalizeMoveName()` and `toPercent()`
- Created `packages/core/src/api-client.ts` with `createApiClient()` factory
- Added `ensureFormatExists()` and `getActiveFormats()` to `packages/formats/src/format.service.ts`
- Created `packages/pokemon-data/src/sprite.service.ts` wrapping `@pkmn/img`
- Removed 3 deprecated type aliases (`ExtractedPokemon`, `ExtractedTeam`, `ShowdownReplayJson`) and 1 deprecated function (`teamToShowdownPaste`)
- Added `exports` fields to 3 package.json files, renamed `usage-recommender.ts` to `usage-recommender.service.ts`

**Wave 2 (5 agents) — Consumed canonical sources:**

- Replaced 60+ magic numbers (100, 252, 31, 510, 6) with named constants across all packages and 17 test files
- Deleted 5 duplicate utility functions: `getTypeEffectiveness` (battle-engine), `normalizeMoveName` (battle-engine), `normalize` (smogon-data), `toPercent` (damage-calc), `toPercentage` (battle-engine)
- Replaced format upsert logic in 3 locations with `ensureFormatExists()`
- Updated both API clients (web + MCP) to use `createApiClient()` from core
- Renamed `fetchUsageStats`→`syncUsageStats`, `fetchSmogonSets`→`syncSmogonSets`, `fetchShowdownReplay`→`getShowdownReplay`
- Renamed query param `format`→`formatId` in 5 API routes + frontend callers
- Renamed route directories: `[id]`→`[pokemonId]`, `[sessionId]`, `[sampleTeamId]`, `[formatId]`

**Wave 3 (5 agents) — Frontend extraction & cleanup:**

- Created `packages/ui/src/search-combobox.tsx` — generic Popover+Command search component
- Created `packages/ui/src/pokemon-card.tsx` — reusable Pokemon card with sprite+types+metadata
- Created `packages/ui/src/type-grid.tsx` — grid of TypeBadges with selection/status styling
- Created `packages/ui/src/grouped-selector.tsx` — Radix Select with grouped items
- Created `packages/ui/src/pokemon-search-selector.tsx` — unified Pokemon search+select panel
- Created `packages/ui/src/move-selector.tsx` — unified move dropdown with learnset filtering
- Consolidated BattleSprite into PokemonSprite (added `side`, `fainted`, `animated` props)
- Extracted Prisma queries from Pokemon page to `actions.ts` server actions
- Canonicalized `SampleTeamView` type in teams package

### Post-execution verification

- 80 test files, 1887 tests — all green
- MCP server build clean (was broken before, now fixed)
- Zero remaining duplicate utility functions, constants, or type definitions
- `@pkmn/img` imported in exactly 1 file (`pokemon-data/src/sprite.service.ts`)

## Key decisions & rationale

1. **`getTypeEffectiveness` — use core's offensive semantics**: Core uses `TYPE_CHART` (standard multipliers: Fire→Grass = 2), battle-engine used `@pkmn/dex` `damageTaken` (defensive/inverted: Fire→Grass = 0.5). Core's version is correct for all AI use cases (scoring moves against opponents, evaluating switch targets). The old defensive version was actually a bug — the AI scored type matchups incorrectly.

2. **`createApiClient` factory in core**: User wanted web and MCP API clients consolidated. Created a factory function that both wrap, rather than a singleton, since they have different base URLs and usage contexts.

3. **`fetch*` → `sync*` (not `get*`)**: `getUsageStats` already existed in usage-stats.service.ts for DB queries. Renamed the network-fetching functions to `syncUsageStats`/`syncSmogonSets` to avoid collision and clarify intent (they fetch+write to DB).

4. **Coverage chart NOT refactored to TypeGrid**: The coverage chart wraps each cell in a Tooltip with count labels — structurally different from a simple TypeBadge grid. Forcing it into TypeGrid would add complexity without benefit.

5. **Several frontend components intentionally NOT refactored**: item-combobox (multi-group layout too specialized), recommendation-card (three-column layout), team-grid (dual-layout with empty slots), SampleTeamCard (multi-Pokemon card) — all too specialized for the generic components.

## Bugs found & fixed

1. **`getTypeEffectiveness` semantic bug in battle-engine AI**: The AI was using defensive semantics (`damageTaken`) where offensive semantics were needed. For example, when scoring "should I switch into X against opponent Y?", it checked "how does Y's type defend against X's type" instead of "how effective is Y's type attacking X's type". Switching to core's offensive version fixed this. The AI now correctly evaluates type matchups.

2. **Analysis test mock hoisting error**: `vi.mock("@nasty-plot/formats", ...)` factory referenced `DEFAULT_LEVEL` which isn't available when `vi.mock` is hoisted. Fixed by using literal `100` in the mock factory.

3. **TypeScript build errors in formats service**: `isNonstandard` property typed as `string | null` but `ItemData`/`MoveData` have it as optional (`string | null | undefined`). Fixed by making parameter accept optional.

4. **TypeScript build error in sprite service**: `gen` parameter typed as `string` but `@pkmn/img` expects a specific union type. Fixed by defining `SpriteGen` union type.

## Pitfalls & gotchas encountered

1. **`getTypeEffectiveness` test rework**: After switching to offensive semantics, the predictor integration test needed a complete scenario redesign. The original test had Dragonite vs Toxapex vs Garchomp, but Toxapex has a terrible offensive matchup against Garchomp that overwhelmed the prediction penalty. Solution: changed opponent to Snorlax (Normal type) so both switches have identical base scores, making the prediction penalty the sole differentiator.

2. **Wave 2 agent conflicts**: Agents 7 (constants) and 9 (utilities) both modified overlapping files (damage-calc, battle-engine). They managed to resolve most conflicts but required careful verification.

3. **`pnpm test` vs `npx vitest run`**: `pnpm test` runs from `packages/mcp-server` directory (wrong), `npx vitest run` from project root works correctly. Must run from project root.

4. **Pre-existing web build failure**: `Can't resolve 'fs'` error from Prisma client imported in `use-battle.ts` (client component). This is a pre-existing Next.js bundling issue unrelated to SSOT work.

## Files changed

### New files created

- `packages/core/src/api-client.ts`
- `packages/core/src/utils.ts`
- `packages/pokemon-data/src/sprite.service.ts`
- `packages/analysis/src/constants.ts`
- `packages/recommendations/src/usage-recommender.service.ts` (renamed from usage-recommender.ts)
- `packages/ui/src/search-combobox.tsx`
- `packages/ui/src/pokemon-card.tsx`
- `packages/ui/src/type-grid.tsx`
- `packages/ui/src/grouped-selector.tsx`
- `packages/ui/src/pokemon-search-selector.tsx`
- `packages/ui/src/move-selector.tsx`
- `apps/web/src/app/pokemon/[pokemonId]/actions.ts`
- `apps/web/src/app/api/chat/sessions/[sessionId]/route.ts` (renamed from [id])
- `apps/web/src/app/api/formats/[formatId]/` (renamed from [id])
- `apps/web/src/app/api/pokemon/[pokemonId]/` (renamed from [id])
- `apps/web/src/app/api/sample-teams/[sampleTeamId]/` (renamed from [id])
- `apps/web/src/app/pokemon/[pokemonId]/` (renamed from [id])
- `plans/ssot-deduplication.md`

### Deleted files

- `packages/recommendations/src/usage-recommender.ts` (renamed)
- `apps/web/src/features/battle/components/PokemonSprite.tsx` (consolidated into ui)
- Old `[id]` route directories (replaced by named param directories)

### Modified packages (barrel exports, service files, constants)

- `packages/core/src/constants.ts`, `src/index.ts`
- `packages/formats/src/format.service.ts`, `src/index.ts`, `package.json`
- `packages/pokemon-data/src/index.ts`, `package.json`
- `packages/damage-calc/src/calc.service.ts`
- `packages/battle-engine/src/ai/shared.ts`, `ai/heuristic-ai.ts`, `ai/hint-engine.ts`, `ai/evaluator.ts`, `ai/set-predictor.ts`, `protocol-parser.ts`, `team-packer.ts`, `simulation/batch-simulator.ts`, `replay/replay-import.ts`, `client.ts`, `index.ts`
- `packages/smogon-data/src/set-inference.service.ts`, `usage-stats.service.ts`, `smogon-sets.service.ts`, `index.ts`
- `packages/analysis/src/analysis.service.ts`, `threat.service.ts`, `index.ts`
- `packages/teams/src/team.service.ts`, `import-export.service.ts`, `sample-team.service.ts`, `index.ts`, `package.json`
- `packages/data-pipeline/src/cli/seed.ts`, `package.json`
- `packages/recommendations/src/composite-recommender.ts`, `src/index.ts`, `package.json`
- `packages/mcp-server/src/api-client.ts`, `src/tools/analysis.ts`, `src/tools/team-crud.ts`
- `packages/ui/src/pokemon-sprite.tsx`, `src/index.ts`, `package.json`

### Modified web app

- `apps/web/src/lib/api-client.ts`
- `apps/web/package.json`
- 5 API route files (query param rename)
- 10+ feature component files (refactored to use new UI components)
- `apps/web/src/app/api/data/seed/route.ts`, `battles/import/route.ts`

### Modified tests (17+ files)

- `tests/analysis/analysis.service.test.ts`
- `tests/battle-engine/shared.test.ts`, `ai-predictor-integration.test.ts`, `ai.test.ts`, `batch-simulator.test.ts`, `doubles-ai.test.ts`, `evaluator-hints.test.ts`, `mcts-ai.test.ts`, `mcts-ai-coverage.test.ts`, `replay-import.test.ts`, `set-predictor.test.ts`, `team-packer.test.ts`
- `tests/core/showdown-paste.test.ts`, `stat-calc.test.ts`, `validation.test.ts`
- `tests/damage-calc/calc.service.test.ts`
- `tests/llm/battle-context-builder.test.ts`, `context-builder.test.ts`
- `tests/mcp-server/tools-analysis.test.ts`, `tools-team-crud.test.ts`
- `tests/recommendations/composite-recommender.test.ts`
- `tests/smogon-data/chaos-sets.service.test.ts`, `set-inference.test.ts`, `smogon-sets.service.test.ts`, `usage-stats.service.test.ts`
- `tests/teams/import-export.service.test.ts`, `team.service.test.ts`, `validation.service.test.ts`, `version.service.test.ts`
- `tests/api/sample-teams.route.test.ts`

## Known issues & next steps

1. **Pre-existing web build failure**: `Can't resolve 'fs'` in `use-battle.ts` — Prisma client imported in client component. Needs a "use server" boundary or restructuring of the battle hook. Not introduced by this session.

2. **Response wrapping inconsistency (N4)**: Some API routes wrap responses in `{ data: ... }`, others return raw. Deferred — needs broader API contract discussion.

3. **Frontend component adoption**: Several components (item-combobox, recommendation-card, team-grid, SampleTeamCard) were intentionally left unrefactored because they're too specialized. Consider if they should use the new shared components with render props or slots in a future pass.

4. **Test count dropped**: Started at 1894, now at 1887 (net -7). This is from removing 8 tests for the deleted `teamToShowdownPaste` function and 7 inverted-semantics `getTypeEffectiveness` tests, while the new test scenario for prediction scoring was added.

5. **`pnpm-lock.yaml` changes**: Multiple agents modified package.json files and added dependencies. The lockfile should be committed with the changes.

## Tech notes

- **`@pkmn/dex` damageTaken encoding** is counterintuitive: `0`=neutral, `1`=super effective (attacker is weak to this type), `2`=resist, `3`=immune. The old battle-engine `getTypeEffectiveness` used this defensive perspective. Core's `TYPE_CHART` uses standard offensive multipliers (2=SE, 0.5=resist, 0=immune) which is what the AI actually needs.

- **`vi.mock` factory hoisting**: Mock factories in Vitest are hoisted above imports. You cannot reference imported values (`DEFAULT_LEVEL`, etc.) inside a `vi.mock` factory. Use literal values or `vi.hoisted()`.

- **`SpriteGen` type for `@pkmn/img`**: The `Sprites.getPokemon` function expects a specific union type for the `gen` parameter, not a generic `string`. Use the `SpriteGen` type defined in `sprite.service.ts`.

- **Parallel agent execution works well**: 16 agents across 3 waves with minimal conflicts. Key success factor: clear scope boundaries per agent (one package or one concern) and dependency ordering between waves.

- **Agent conflict resolution**: When multiple agents modify overlapping files, later agents may need to handle partially-modified files. Wave 2 had this issue with agents 7 and 9 both touching damage-calc and battle-engine. Solution: each agent reads current file state before editing.
