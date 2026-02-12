# Session: Smogon Set Inference for Replay Imports

**Date:** 2026-02-12
**Duration context:** short

## What was accomplished

- Implemented a new set inference service that matches partial replay data against known Smogon sets to fill in unrevealed moves, nature, EVs, and IVs
- Added `scoreSetMatch`, `inferFromSets`, `resolveMoves`, and `enrichExtractedTeam` functions in a new `set-inference.service.ts`
- Extended `createTeamFromExtractedData` to accept optional `nature`, `evs`, `ivs` fields (backward-compatible)
- Added `inferSets` boolean parameter to the `/api/battles/import` route (default `true`)
- Added "Infer full sets from Smogon data" toggle switch to both URL and Log import tabs on the import page
- Wrote 26 tests covering all new functions

## Key decisions & rationale

- **Local types instead of importing from battle-engine:** `smogon-data` doesn't depend on `battle-engine` and adding it would violate the dependency layers (both are Domain tier). Defined compatible `ExtractedPokemon`/`ExtractedTeam` interfaces locally in the service instead. These are structurally compatible with battle-engine's `ExtractedPokemonData`/`ExtractedTeamData`.
- **Weighted scoring with normalization:** Only revealed fields contribute to the score denominator, so a pokemon with just 1 revealed move still gets a meaningful score. Weights: ability (0.3), item (0.3), tera type (0.2), move coverage (0.2).
- **Hard disqualification on move mismatch:** If any revealed move isn't in the candidate set, score is 0. This prevents false matches where ability/item happen to match but the moveset is completely different.
- **Default `inferSets: true`:** Since the primary use case for importing replays is getting full team data, inference is on by default. Users can disable it via the toggle.
- **Parallel enrichment:** Both teams are enriched concurrently with `Promise.all` in the API route.

## Bugs found & fixed

- None — clean implementation from plan.

## Pitfalls & gotchas encountered

- **Circular dependency risk:** Initially wrote the service importing `ExtractedPokemonData` from `@nasty-plot/battle-engine`, which would have created a dependency from `smogon-data` → `battle-engine`. Caught this by checking `package.json` before committing. Solved with local type definitions.

## Files changed

- `packages/smogon-data/src/set-inference.service.ts` — **created** — core inference service
- `packages/smogon-data/src/index.ts` — added exports for new service functions and types
- `packages/teams/src/import-export.service.ts` — extended `createTeamFromExtractedData` pokemon param with optional `nature`, `evs`, `ivs`
- `apps/web/src/app/api/battles/import/route.ts` — added `inferSets` param, enrichment step before team matching
- `apps/web/src/features/battle/hooks/use-battle-import.ts` — added `inferSets` to `ImportInput`
- `apps/web/src/app/battle/import/page.tsx` — added Switch toggle for set inference in both tabs
- `tests/smogon-data/set-inference.test.ts` — **created** — 26 tests

## Known issues & next steps

- **No confidence threshold:** Currently any match with score > 0 is used. Could add a minimum confidence threshold to avoid low-quality inferences.
- **Slash option abilities/items:** The Smogon set type only stores the first option for ability/item (via `firstOf` in `smogon-sets.service.ts`). If the raw data has slash options for abilities, they're already collapsed before reaching inference.
- **Pre-existing test failures:** 3 test files (`battles-batch.route`, `chat-session.service`, `chat.service`) have pre-existing failures unrelated to this work — 7 tests total.
- **Manual testing:** The UI toggle should be manually verified with an actual replay import to confirm end-to-end behavior.

## Tech notes

- `SmogonSetData.moves` is `(string | string[])[]` — each slot is either a fixed move or a slash-option array. The `resolveMoves` function handles both cases.
- `getAllSetsForFormat` does a single DB query returning all sets grouped by pokemonId — efficient for team-level enrichment (one query per team, not per pokemon).
- The `normalize` function strips spaces and lowercases for move/ability/item comparison. This handles Showdown's inconsistent casing (e.g. "earthquake" vs "Earthquake").
- The `enrichExtractedTeam` return type is `EnrichedTeam` (which has `EnrichedPokemon[]` with optional `nature`/`evs`/`ivs`), but it's cast to the original type in the API route since `createTeamFromExtractedData` now accepts those optional fields.
