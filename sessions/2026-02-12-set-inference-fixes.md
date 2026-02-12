# Session: Set Inference Bug Fixes (Continued)

**Date:** 2026-02-12
**Duration context:** medium
**Previous session:** `sessions/2026-02-12-set-inference.md`

## What was accomplished

- **Fixed format merge bug:** `resolveFormatWithSets` previously stopped at the first fallback format that had ANY sets (e.g. gen9vgc2025 with 111 sets). Pokemon not in that format (e.g. Iron Crown, only in gen9vgc2024 and gen9doublesou) got zero candidates and no inference. Changed to merge sets from ALL fallback formats, with earlier (more specific) formats taking per-species priority.
- **Softened move mismatch scoring:** Previously, any revealed move not found in a candidate set caused immediate disqualification (score = 0). Changed to a penalty-based approach: each unmatched move applies a 0.6^n multiplier. This allows partial inference even when the DB has outdated/limited sets (e.g. Flutter Mane using 2026 meta moves not in any 2025 set).
- **Added merge test:** New test "merges sets from multiple fallback formats for different species" — verifies Flutter Mane gets sets from gen9vgc2025 while Iron Crown gets sets from gen9vgc2024 in the same enrichment call.
- **Updated existing tests:** Adapted "returns score 0 when a revealed move is not in the set" → now expects heavily penalized but non-zero score. Adapted "returns null result when no sets match" → now expects low-confidence result instead of null.
- **Reseeded gen9vgc2025 data** with `pnpm seed --format gen9vgc2025 --sets-only --force` to ensure latest sets from pkmn.cc.

## Key decisions & rationale

- **Merge instead of stop-at-first:** The original design assumed one format would cover all species. In reality, VGC meta data is fragmented — gen9vgc2025 has 76 species but may not include niche picks that exist in gen9vgc2024 (145 species) or gen9doublesou (72 species). Merging is cheap (just hash lookups) and vastly improves coverage.
- **Penalty over disqualification for move mismatch:** Hard disqualification was the "correct" approach for fresh/comprehensive data. But pkmn.cc doesn't have gen9vgc2026 sets yet, so 2026 replays must match against 2025/2024 data. A Pokemon running a new coverage move would get zero inference. The 0.6^n penalty allows the best available set to still provide nature/EVs/IVs/item inference even when 1 move doesn't match. Two unmatched moves give 0.36x, three give 0.216x — rapidly diminishing returns prevent truly wrong sets from winning.
- **Per-species priority (not merge within species):** When a species has sets in multiple fallback formats, we keep only the sets from the highest-priority format. This avoids confusing duplicates and ensures the most meta-relevant set wins.

## Bugs found & fixed

1. **Iron Crown missing from inference (format merge):** User reported "iron crown and flutter mane failed inference (the other 4 were fully gotten)." Root cause: `resolveFormatWithSets` returned early at gen9vgc2025 (first format with data). Iron Crown has no sets in gen9vgc2025 — only in gen9vgc2024 and gen9doublesou, which were never reached. Fix: iterate all fallbacks and merge per-species.

2. **Flutter Mane still failing after merge fix:** gen9vgc2025 has Flutter Mane (Glass Cannon: Shadow Ball, Moonblast, Icy Wind, Protect/Taunt). If the 2026 replay reveals a move like Dazzling Gleam that isn't in this set, the hard disqualification (score=0) blocked all inference. Fix: penalty-based scoring instead of disqualification.

## Pitfalls & gotchas encountered

- **pkmn.cc has no gen9vgc2026 data:** Checked all variations (gen9vgc2026, gen9vgc2026regi, gen9vgc2026regj) — all 404. Only gen9vgc2025 exists. The VGC 2026 meta must rely entirely on fallback to older format data.
- **gen9doublesou is stored under gen9battlestadiumdoubles in DB:** The format definition `gen9battlestadiumdoubles` uses `pkmnSetsId: "gen9doublesou"` to fetch from pkmn.cc, but stores in DB as both `gen9battlestadiumdoubles` (72 sets) and `gen9doublesou` (72 sets). The fallback chain includes both IDs so this works, but it's worth knowing.
- **Test mocks with mockResolvedValueOnce break when iteration count changes:** The old `resolveFormatWithSets` stopped early (4 calls), so tests used `.mockResolvedValueOnce()` chained 4 times. After switching to iterate-all, later calls returned `undefined` instead of `[]`, causing "rows is not iterable". Fix: switch to `mockImplementation` with format-based routing.

## Files changed

- `packages/smogon-data/src/set-inference.service.ts` — rewrote `resolveFormatWithSets` to merge across formats; changed `scoreSetMatch` from hard disqualification to penalty-based scoring
- `tests/smogon-data/set-inference.test.ts` — updated 2 existing tests for new scoring behavior, added 1 new merge test (now 33 tests total)

## Known issues & next steps

- **Tests not fully verified:** Session ended before running test suite to confirm all 33 set-inference tests pass. The merge test and updated scoring tests need verification. Run: `pnpm test -- tests/smogon-data/set-inference.test.ts`
- **No VGC 2026 format definition:** Should add `gen9vgc2026` to FORMAT_DEFINITIONS when pkmn.cc publishes data. Currently the fallback chain handles it, but a dedicated format would be cleaner and faster.
- **Confidence threshold:** With the softer scoring, low-confidence matches (e.g. 5%) will still be used for inference. May want a minimum threshold (e.g. 20%) below which we skip enrichment to avoid misleading data.
- **Flutter Mane inference quality:** Even with the penalty fix, if the replay reveals multiple moves not in the Glass Cannon set, the inferred nature/EVs may not match the actual set being used. The inference is "best available guess" not "correct."
- **Pre-existing test failures:** 7 tests in 3 files (`battles-batch.route`, `chat-session.service`, `chat.service`) remain broken — unrelated to this work.

## Tech notes

- **pkmn.cc VGC data availability (as of 2026-02-12):** Only `gen9vgc2025` (76 species, 111 sets) and `gen9vgc2024` (more species, 145 sets) exist. No reg-specific URLs work (regj, regi, etc.).
- **Format fallback merge order for `gen9vgc2026regfbo3`:** gen9vgc2026regfbo3 → gen9vgc2026regf → gen9vgc2026 → gen9vgc2025 → gen9vgc2024 → gen9vgc2023 → gen9doublesou → gen9battlestadiumdoubles. All formats are queried; sets merged with first-format-wins per species.
- **Penalty math:** `score *= 0.6^unmatchedMoves`. 1 mismatch → 60% of original score. 2 → 36%. 3 → 21.6%. 4 (all moves wrong) → 13%. This still allows nature/EV inference from the species' only available set.
- **Iron Crown in DB:** gen9vgc2024 (Booster Energy set), gen9doublesou (Fast Calm Mind Sweeper), gen9battlestadiumdoubles, gen9ou, gen9nationaldex, gen9monotype, gen9battlestadiumsingles.
- **Flutter Mane in DB:** gen9vgc2025 (Glass Cannon), gen9vgc2024 (5 sets), gen9ubers, gen9monotype, gen9battlestadiumsingles.
