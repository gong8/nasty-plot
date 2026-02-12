# Session: Set Inference & VGC 2026 Data Support

**Date:** 2026-02-12
**Duration context:** short

## What was accomplished

- **Implemented Chaos-to-Set Generator:** Created `chaos-sets.service.ts` to generate standard `SmogonSet` objects (Nature/EVs/Moves/Item/Ability) from raw Smogon Chaos usage statistics.
- **Enabled VGC 2026 Support:** Added `gen9vgc2026` to `FORMAT_DEFINITIONS` with `smogonStatsId: "gen9vgc2026regf"`.
- **Seeded VGC 2026 Data:** Successfully seeded 298 sets for `gen9vgc2026` by falling back to Chaos stats when `pkmn.cc` returned 404.
- **Cleaned Up Inference Logic:** Reverted "scrappy" fixes in `set-inference.service.ts`.
  - Restored strict scoring (unmatched revealed moves = 0 score).
  - Removed complex "merge sets from multiple formats" logic in favor of a clean "first match wins" fallback.
- **Verified Tests:** Updated `set-inference.test.ts` to reflect strict scoring rules and verified all 32 tests pass.

## Key decisions & rationale

- **Generating Data vs. Soft Matching:** Instead of accepting low-quality matches (soft scoring) or merging data from old formats (2025/2024), we chose to generate the _correct_ data from raw usage stats. This ensures inference uses the actual 2026 meta.
- **Strict Scoring:** With accurate data available, we returned to strict scoring. If a player uses a move not in the standard set, it's safer to not infer anything than to guess based on a set that doesn't match the revealed moves.
- **Format Definition:** `gen9vgc2026` is now the active VGC format. `gen9vgc2025` was marked inactive (though still available for fallback/historical lookups).

## Bugs found & fixed

- **Seeder 404 Fallback:** The seeder originally didn't pass `smogonStatsId` to the `fetchSmogonSets` function, causing the fallback logic to look for `gen9vgc2026` stats (which don't exist) instead of `gen9vgc2026regf`. Fixed by plumbing `smogonStatsId` through the seeder CLI and service.

## Files changed

- `packages/smogon-data/src/chaos-sets.service.ts` (created)
- `packages/smogon-data/src/smogon-sets.service.ts`
- `packages/smogon-data/src/usage-stats.service.ts`
- `packages/formats/src/data/format-definitions.ts`
- `packages/data-pipeline/src/cli/seed.ts`
- `packages/smogon-data/src/set-inference.service.ts`
- `tests/smogon-data/set-inference.test.ts`
