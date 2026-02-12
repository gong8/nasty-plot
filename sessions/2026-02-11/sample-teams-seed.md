# Session: Sample Teams Seed Infrastructure

**Date:** 2026-02-11
**Duration context:** short

## What was accomplished

- Created curated sample teams data file with 18 competitive Gen 9 teams across 5 formats
- Built idempotent seed function (`seedSampleTeams`) with force-reseed support
- Integrated sample team seeding into the existing `pnpm seed` CLI with `--teams-only` flag
- Fixed stale VGC format filter in the sample teams UI (`gen9vgc2024regh` → `gen9vgc2025`)
- Removed `SampleTeam` from the clean script so seeded reference data isn't wiped by `pnpm clean`

## Key decisions & rationale

- **18 teams across 5 formats:** gen9ou (8 archetypes: balance, bulky-offense, hyper-offense, offense, rain, sun, sand, stall), gen9uu (3), gen9vgc2025 (3), gen9monotype (2), gen9doublesou (2). Covers all format filters the UI supports.
- **`source: "curated-seed"` tag:** All seeded teams are tagged so the seed function can delete/re-insert only curated teams without touching user-created ones.
- **Added `@nasty-plot/core` as dependency to data-pipeline:** Foundation layer dependency (clean direction). Used `parseShowdownPaste()` to extract `pokemonIds` from paste text, avoiding a cross-layer dependency on `@nasty-plot/teams`.
- **Exclusive CLI flags:** `--stats-only`, `--sets-only`, `--teams-only` are mutually exclusive. Normal `pnpm seed` runs all three (stats + sets + sample teams).
- **Removed SampleTeam from clean.ts:** The clean script's own comment says "preserving seeded reference data" — sample teams are seeded reference data, so they shouldn't be deleted by clean.

## Bugs found & fixed

- **Sample teams page always empty:** The `SampleTeam` table had 0 rows because `pnpm seed` never populated it. Fixed by adding seed infrastructure.
- **Stale VGC format filter:** UI had `gen9vgc2024regh` which doesn't match any seeded format. Changed to `gen9vgc2025` to match the active format definition.

## Pitfalls & gotchas encountered

- The doubles OU format ID in the format definitions is `gen9battlestadiumdoubles` (the actual format record), but `gen9doublesou` is used as the `simFormatId`. Sample teams use `gen9doublesou` to match the UI filter, which is a slight inconsistency but pragmatic.
- VGC teams need `Level: 50` in the Showdown paste (default is 100).

## Files changed

- `packages/data-pipeline/src/data/sample-teams.ts` — **Created.** 18 curated teams as Showdown pastes with metadata.
- `packages/data-pipeline/src/seed-sample-teams.ts` — **Created.** `seedSampleTeams(force)` function with idempotency and DataSyncLog tracking.
- `packages/data-pipeline/package.json` — **Modified.** Added `@nasty-plot/core` dependency.
- `packages/data-pipeline/src/cli/seed.ts` — **Modified.** Added `--teams-only` flag, `seedSampleTeams()` call in normal runs, summary output.
- `packages/data-pipeline/src/index.ts` — **Modified.** Barrel export for `seedSampleTeams`.
- `apps/web/src/app/battle/sample-teams/page.tsx` — **Modified.** Fixed format filter from `gen9vgc2024regh` to `gen9vgc2025`.
- `packages/data-pipeline/src/cli/clean.ts` — **Modified.** Removed `SampleTeam` from deletion transaction and labels array.

## Known issues & next steps

- **Pre-existing test failures:** 3 tests in `tests/llm/chat.service.test.ts` fail (unrelated to this work — chat service meta context fetching).
- **Team accuracy:** The curated teams are reasonable competitive representations but haven't been verified against the latest Smogon metagame. Could be updated with real tournament teams or Smogon sample teams.
- **Missing `sourceUrl`:** All curated teams have `source: "curated-seed"` but no `sourceUrl`. Could link to Smogon forums if real teams are used.
- **Format ID inconsistency:** `gen9doublesou` in sample teams vs `gen9battlestadiumdoubles` as the actual format record ID. The UI filter works but this could cause confusion if format-based joins are needed.

## Tech notes

- `parseShowdownPaste()` from `@nasty-plot/core` returns `Partial<TeamSlotData>[]` — each entry has `pokemonId` as a camelCase Showdown ID (e.g. `"greattusk"`).
- `SampleTeam.pokemonIds` is a comma-separated string (e.g. `"gholdengo,greattusk,kingambit"`) for LIKE queries.
- `DataSyncLog` uses a composite unique key `(source, formatId)`. Sample teams use `source: "sample-teams"`, `formatId: "all"`.
- The seed idempotency check queries `SampleTeam` count where `source = "curated-seed"`. If > 0 and not forced, it skips.
