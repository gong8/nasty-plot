# Session: Smogon Set Inference for Replay Imports

**Date:** 2026-02-12
**Duration context:** medium

## What was accomplished

- Implemented a new set inference service (`packages/smogon-data/src/set-inference.service.ts`) that matches partial replay data against known Smogon sets to fill in unrevealed moves, nature, EVs, and IVs
- Added `scoreSetMatch`, `inferFromSets`, `resolveMoves`, and `enrichExtractedTeam` functions
- Extended `createTeamFromExtractedData` to accept optional `nature`, `evs`, `ivs` fields (backward-compatible)
- Added `inferSets` boolean parameter to the `/api/battles/import` route (default `true`)
- Added "Infer full sets from Smogon data" toggle switch to both URL and Log import tabs on the import page
- **Fixed format fallback:** Added `buildFormatFallbacks` + `resolveFormatWithSets` to handle VGC regulation formats (e.g. `gen9vgc2026regfbo3`) that have no sets in DB — strips suffixes, tries previous years, then falls back to `gen9doublesou`
- **Fixed duplicate move bug:** `resolveMoves` now tracks used moves to prevent duplicates when Protect (or any move) appears as a slash option in multiple set slots
- Wrote 30 tests covering scoring, inference, move resolution, format fallback, and duplicate prevention

## Key decisions & rationale

- **Local types instead of importing from battle-engine:** `smogon-data` doesn't depend on `battle-engine` and adding it would violate the dependency layers (both are Domain tier). Defined compatible `ExtractedPokemon`/`ExtractedTeam` interfaces locally. Structurally compatible with battle-engine's `ExtractedPokemonData`/`ExtractedTeamData`.
- **Weighted scoring with normalization:** Only revealed fields contribute to the score denominator, so a pokemon with just 1 revealed move still gets a meaningful score. Weights: ability (0.3), item (0.3), tera type (0.2), move coverage (0.2).
- **Hard disqualification on move mismatch:** If any revealed move isn't in the candidate set, score is 0. Prevents false matches.
- **Format fallback chain:** `gen9vgc2026regfbo3` → strip bo3 → strip reg suffix → try previous VGC years → fall back to `gen9doublesou`. Stops at first format with data.
- **Duplicate-aware move resolution:** `resolveMoves` tracks a `usedNorms` set. For slash options, picks revealed move only if not already used, otherwise picks first non-duplicate alternative.

## Bugs found & fixed

1. **Format mismatch (zero sets found):** Replay format `gen9vgc2026regfbo3` had no sets in DB. DB only has `gen9vgc2024`, `gen9vgc2025`, `gen9doublesou`, etc. Root cause: VGC regulation-specific format IDs don't match any seeded format exactly. Fixed with `buildFormatFallbacks` that strips suffixes and tries related formats.

2. **Duplicate move: Protect:** Sets like Indeedee-F have `[["Trick Room","Protect"],["Helping Hand","Protect"],...]` — Protect as a slash option in two slots. When "Protect" was revealed, `resolveMoves` picked it for both slots, causing `addSlot` validation to throw "Duplicate move: Protect". Fixed by tracking used moves in `resolveMoves` and falling back to the next non-duplicate option.

## Pitfalls & gotchas encountered

- **Circular dependency risk:** Initially imported `ExtractedPokemonData` from `@nasty-plot/battle-engine` into `smogon-data`. Caught by checking `package.json` — solved with local type definitions.
- **VGC format IDs are highly specific:** Replay format strings include regulation letter + best-of suffix (e.g. `gen9vgc2026regfbo3`). These never match seeded format IDs directly. Any feature matching against DB format IDs needs fallback logic.
- **Smogon slash options can repeat moves:** Real VGC sets frequently have the same move (especially Protect) as a slash option in multiple slots, since it represents "pick Protect OR this other move" for different slots. Any move resolution logic MUST handle this.
- **DB ability field can be empty:** Some SmogonSet rows have `ability=""` when the Pokemon only has one ability (implied). The scoring handles this gracefully — empty set ability simply doesn't match any revealed ability, reducing score but not disqualifying.

## Files changed

- `packages/smogon-data/src/set-inference.service.ts` — **created** — core inference service with format fallback and duplicate-safe move resolution
- `packages/smogon-data/src/index.ts` — added exports for new service functions and types
- `packages/teams/src/import-export.service.ts` — extended `createTeamFromExtractedData` pokemon param with optional `nature`, `evs`, `ivs`
- `apps/web/src/app/api/battles/import/route.ts` — added `inferSets` param, enrichment step before team matching
- `apps/web/src/features/battle/hooks/use-battle-import.ts` — added `inferSets` to `ImportInput`
- `apps/web/src/app/battle/import/page.tsx` — added Switch + Label toggle for set inference in both tabs
- `tests/smogon-data/set-inference.test.ts` — **created** — 30 tests

## Known issues & next steps

- **No confidence threshold:** Currently any match with score > 0 is used. Could add a minimum confidence to avoid low-quality inferences.
- **Slash option abilities/items:** The Smogon set type only stores the first option for ability/item (via `firstOf` in `smogon-sets.service.ts`). Slash options are already collapsed before reaching inference.
- **Pre-existing test failures:** 3 test files (`battles-batch.route`, `chat-session.service`, `chat.service`) have pre-existing failures unrelated to this work — 7 tests total.
- **Seed VGC 2026 data:** Running `pnpm seed` with the new VGC 2026 format would eliminate the need for fallback in the common case.
- **Matched teams don't get enriched:** When `findMatchingTeams` finds an existing team (confidence >= 60%), the matched team's existing (possibly partial) data is used. The enrichment only helps for newly created teams.

## Tech notes

- `SmogonSetData.moves` is `(string | string[])[]` — each slot is either a fixed move or a slash-option array.
- `getAllSetsForFormat` does a single DB query returning all sets grouped by pokemonId — efficient for team-level enrichment.
- The `normalize` function strips spaces and lowercases for move/ability/item comparison. Handles Showdown's inconsistent casing.
- Format fallback order for `gen9vgc2026regfbo3`: exact → `gen9vgc2026regf` → `gen9vgc2026` → `gen9vgc2025` → `gen9vgc2024` → `gen9vgc2023` → `gen9doublesou` → `gen9battlestadiumdoubles`.
- DB formats with sets (as of this session): gen9monotype (418), gen9battlestadiumsingles (305), gen9ou (208), gen9nu (171), gen9nationaldex (166), gen9vgc2024 (145), gen9ubers (129), gen9ru (124), gen9vgc2025 (111), gen9uu (102), gen9nationaldexuu (100), gen9battlestadiumdoubles (72), gen9doublesou (72), gen9lc (70).
