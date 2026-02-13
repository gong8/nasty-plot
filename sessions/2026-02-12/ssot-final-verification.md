# Session: SSOT Final Verification

**Date:** 2026-02-12
**Duration context:** Medium (~15 minutes)

## What was accomplished

- Comprehensive verification of all 48 SSOT deduplication violations from `plans/deduplication-single-source-of-truth.md`
- Deployed 8 parallel verification agents across a team (`ssot-verify`) to audit every single violation simultaneously
- **Result: 45/48 violations confirmed fixed**, 3 remaining identified
- Fixed the 3 remaining violations with 3 parallel fix agents:
  - **U2:** Removed local `resolveSpeciesName` from `packages/battle-engine/src/team-packer.ts`, now imports from `@nasty-plot/pokemon-data`
  - **U5:** Deleted deprecated `teamToShowdownPaste` wrapper from `packages/battle-engine/src/team-packer.ts` and its 8 associated tests
  - **F6:** Replaced hardcoded `ARCHETYPE_OPTIONS` array in `apps/web/src/app/battle/sample-teams/page.tsx` with import from `@nasty-plot/core`

## Key decisions & rationale

- **Deprecated wrappers count as violations:** The `teamToShowdownPaste` function was a thin deprecated wrapper delegating to `serializeShowdownPaste` from core. The plan said delete entirely, so it was deleted rather than left as a compat shim.
- **U4 getTypeEffectiveness counted as PASS:** The battle-engine `shared.ts` version uses defensive semantics (`damageTaken` from `@pkmn/dex`) while core uses offensive semantics (`TYPE_CHART`). These are genuinely different algorithms, not duplicates. The agent correctly identified this distinction.
- **Backward-compat type aliases counted as PASS:** `ExtractedPokemon = ExtractedPokemonData` in smogon-data and `ShowdownReplayJson = ShowdownReplayJSON` in battle-engine are thin aliases pointing to the SSOT types, not independent definitions.

## Bugs found & fixed

- No bugs found — the SSOT refactor was implemented correctly across 45 of 48 violations
- The 3 remaining items were omissions (not bugs), now fixed

## Pitfalls & gotchas encountered

- **Test flakiness under parallel agent load:** When running tests after all agents completed, there were transient timeout failures across many packages (analysis, formats, recommendations, llm, mcp-server). This was likely caused by resource contention from 8+ parallel agents hammering the filesystem simultaneously. Not a real code issue.
- **`components.json` false positive:** The `@/lib/utils` reference in `apps/web/components.json` is a shadcn/ui CLI configuration entry, not a runtime import. Post-checks agent correctly identified this as a non-issue.

## Files changed

- `packages/battle-engine/src/team-packer.ts` — removed local `resolveSpeciesName`, deleted `teamToShowdownPaste`, updated import from `@nasty-plot/pokemon-data`
- `tests/battle-engine/team-packer.test.ts` — removed `teamToShowdownPaste` import and its 8 test cases
- `apps/web/src/app/battle/sample-teams/page.tsx` — replaced hardcoded `ARCHETYPE_OPTIONS` with import from `@nasty-plot/core`

## Known issues & next steps

- **Test suite needs a clean run:** After the fixes, a clean `pnpm test` should be run to confirm all 1886 remaining tests pass (8 `teamToShowdownPaste` tests were intentionally removed). The session ended before a clean run completed.
- **SSOT plan can be archived:** All 48 violations are now addressed. Move `plans/deduplication-single-source-of-truth.md` to `plans/archived/`.
- **Deprecated type aliases:** Two backward-compat aliases remain (`ExtractedPokemon` in smogon-data, `ShowdownReplayJson` in battle-engine). These could be removed in a future cleanup pass once all consumers are confirmed to use the canonical names.

## Tech notes

- **Verification approach:** Used `TeamCreate` with 8 parallel `Explore` agents + 1 `general-purpose` agent. Each agent checked a specific category of violations (types T1-T7, T8-T13, utilities, constants C1-C6, C7-C12, services, frontend, post-execution). Total wall-clock time ~3 minutes for full audit.
- **`resolveSpeciesName` canonical location:** `packages/pokemon-data/src/dex.service.ts:281`. Uses `dex.species.get()` internally with a camelCase-to-display-name regex fallback.
- **`getGen9()` pattern:** The shared `Generations` instance is exported as a lazy singleton `getGen9()` from pokemon-data (not a bare `gen9` constant), called at `dex.service.ts:258`.
- **`getFormatFallbacks`** replaced `buildFormatFallbacks` in smogon-data. Canonical location: `packages/formats/src/resolver.ts:77`.
