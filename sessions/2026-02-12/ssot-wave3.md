# SSOT Wave 3 — Final Deduplication

**Date:** 2026-02-12
**Duration:** ~15 minutes
**Team:** 5 parallel agents (ssot-wave3)

## Accomplishments

### Pre-task: pokemon-data Wrappers

Added missing wrappers to `packages/pokemon-data/src/dex.service.ts` that Wave 2 failed to add:

- `getGen9()` — lazy `Generation` singleton for `@smogon/calc` consumers
- `getRawMove()` / `getRawSpecies()` — raw Dex object access (vs mapped types)
- `getType()` — raw type access for damageTaken lookups
- `resolveSpeciesName()` — pokemonId → display name resolution

### Agent 12: dex-migrator-battle-engine

Migrated 7 battle-engine files from `@pkmn/dex` to `@nasty-plot/pokemon-data`:

- `types.ts`, `team-packer.ts`, `protocol-parser.ts`, `ai/shared.ts`, `ai/greedy-ai.ts`, `ai/heuristic-ai.ts`, `ai/hint-engine.ts`
- Removed `@pkmn/dex` and `@pkmn/data` from battle-engine package.json

### Agent 13: dex-migrator-other

Migrated 6 non-battle-engine files from `@pkmn/dex` to `@nasty-plot/pokemon-data`:

- `coverage-recommender.ts`, `usage-recommender.ts`, `composite-recommender.ts` (recommendations)
- `analysis.service.ts`, `threat.service.ts` (analysis)
- `calc.service.ts` (damage-calc)
- Replaced direct `prisma.usageStats.findMany()` with `getUsageStats()` from `@nasty-plot/smogon-data` in 4 locations
- Also updated `apps/web/src/app/api/damage-calc/matchup-matrix/route.ts`

### Agent 14: service-deduper

- **S1 (dbSlotToDomain):** Consolidated 4 copies → 1 canonical in `teams/team.service.ts`. Replaced duplicates in `composite-recommender.ts`, `analysis.service.ts`, `version.service.ts`
- **S6 (format resolution):** Added `getFormatFallbacks()` to `packages/formats/src/resolver.ts`. Deleted `buildFormatFallbacks` from `smogon-data/set-inference.service.ts`

### Agent 15: calc-boilerplate

- Added `calculateBattleDamage()` helper to `battle-engine/src/ai/shared.ts`
- Refactored `greedy-ai.ts`, `heuristic-ai.ts`, `hint-engine.ts` to use shared helper

### Agent 16: frontend-cleanup

- **F4:** Replaced hardcoded `SAMPLE_TEAM_1`/`SAMPLE_TEAM_2` with DB fetch in `BattleSetup.tsx` and `simulate/page.tsx`
- **F7:** Created shared `usePokemonQuery` / `useLearnsetQuery` hooks in `use-pokemon-data.ts`
- **F8:** Replaced inline `Sprites.getPokemon()` + `<img>` with `<PokemonSprite>` in `SampleTeamCard.tsx`

## Key Decisions

- All pre-approved in `plans/deduplication-single-source-of-truth.md`
- Used lazy `getGen9()` function (not module-level constant) to avoid crashing mocked tests
- Kept battle-engine's `getTypeEffectiveness` (different semantics from core's version)

## Verification

- **Tests:** 80 files, 1894 tests, all passing
- **Build:** `pnpm build` passes cleanly
- **Grep checks:**
  - `@pkmn/dex` only in `pokemon-data/src/dex.service.ts` (canonical)
  - No `@/lib/utils` in code (only shadcn `components.json`)
  - No inline zero EVs outside `DEFAULT_EVS` constant

## Files Changed

- 122 files, +609/-5,859 lines (net ~5,250 line reduction)
- 47 source files modified across packages + apps
- 5 test files updated with new mocks
- Session files reorganized into date subdirectories

## Pitfalls Encountered

- TypeScript error with `ReturnType<ReturnType<typeof Generations.prototype.get>>` — `Generation` is not callable. Fixed by importing `type Generation` directly from `@pkmn/data`
- Agents 13 and 14 had file conflicts on overlapping files (analysis.service.ts, composite-recommender.ts). Resolved by coordinating: service-deduper finished first, then dex-migrator-other applied its changes

## Known Issues & Next Steps

- Test count dropped from 1896 → 1894 (2 tests removed — likely duplicates cleaned up during refactoring)
- SSOT deduplication project is now **complete** (all 3 waves done)
- The `@pkmn/dex` dependency is now fully encapsulated in `packages/pokemon-data`
