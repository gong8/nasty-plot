# Session: Data Pipeline Perfection

**Date:** 2026-02-10
**Duration context:** Long (continued from guided-builder-reimagine session that ran out of context)

## What was accomplished

- **Fixed build error** — added missing `@nasty-plot/formats` dependency to `packages/analysis/package.json`, which was causing `Can't resolve '@nasty-plot/formats'` when adding Pokemon in guided builder
- **Fixed infinite loading on lead step** — changed `recommendationsQuery.isPending` to `recommendationsQuery.isLoading` in `use-guided-builder.ts`. React Query v5 disabled queries have `isPending=true` but `isLoading=false`, causing permanent loading skeletons on the lead step
- **Added back navigation to step indicator** — made `StepIndicator` in `guided-builder.tsx` clickable: changed from `<div>` to `<button>` elements, completed steps get hover effects and are navigable
- **Fixed multi-format data seeding** — only gen9ou had usage data. Root cause: Smogon only publishes `-1695.json` for OU; all other formats use `-1630.json`. Added multi-rating probing (1695, 1630, 1500, 0) to `resolveYearMonth()`
- **Added format ID mapping** — VGC/BSS/BSD have different IDs on Smogon stats vs pkmn.cc. Added `smogonStatsId` and `pkmnSetsId` fields to `FormatDefinition` type and all affected format definitions
- **Comprehensive data pipeline audit and fixes** — launched 4 parallel audit agents, then fixed: JSON.parse error handling in sets service, deduplicated `toId()`, explicit throw on no data, null-safe species enrichment, better error handling in recommend API, `--stats-only`/`--sets-only` CLI flags, partial success tracking in seed CLI and API route
- **Re-seeded all 12 formats successfully** — all formats now have both usage stats and Smogon sets: gen9ou (312/208), gen9uu (301/102), gen9ru (269/124), gen9nu (235/171), gen9ubers (375/129), gen9lc (180/70), gen9monotype (359/418), gen9nationaldex (471/166), gen9nationaldexuu (344/100), gen9vgc2025 (282/111), gen9battlestadiumsingles (190/305), gen9battlestadiumdoubles (370/72)
- **All 1294 tests passing** across 53 test files after updating test expectations for new behavior

## Key decisions & rationale

- **Multi-rating probing over hardcoded rating** — Rather than mapping each format to its known rating, try all common thresholds (1695, 1630, 1500, 0) per month. This is resilient to Smogon changing rating thresholds and requires no manual maintenance per format.
- **`smogonStatsId` / `pkmnSetsId` as optional overrides** — Three ID spaces exist (app format IDs, Smogon stats IDs, pkmn.cc set IDs). Rather than changing app IDs to match Smogon, added optional override fields. Most formats use their app ID; only VGC/BSS/BSD need overrides. This preserves clean app-facing IDs.
- **Throw instead of silent GET fallback** — When all HEAD requests fail in `resolveYearMonth()`, the old code silently retried with a GET request to previous month (redundant — already tried). Changed to throw a clear error so callers know data is truly unavailable.
- **Partial success tracking** — Seed CLI and API now track stats and sets success independently per format. A format can succeed on stats but fail on sets (or vice versa), reported as `[PARTIAL]`. Only full failures cause exit code 1.

## Bugs found & fixed

1. **Build error: `Can't resolve '@nasty-plot/formats'`** — `packages/analysis/package.json` was missing the dependency. Symptom: adding any Pokemon in guided builder threw a module resolution error. Root cause: analysis service imported from `@nasty-plot/formats` but the package wasn't declared as a dependency.

2. **Infinite loading skeletons on lead step** — `use-guided-builder.ts` used `recommendationsQuery.isPending` for loading state. On the lead step (slot 0, no Pokemon yet), the recommendations query is `enabled: false`. React Query v5: disabled queries have `isPending=true` (no cached data) but `isLoading=false` (not actively fetching). Fix: switch to `isLoading`.

3. **No recommendations for 10 of 12 formats** — Only gen9ou and gen9doublesou had seeded data. All other formats got 404s during seeding because:
   - Smogon only publishes `-1695.json` for OU; others use `-1630.json` (or lower)
   - VGC published as `gen9vgc2025regj`, BSS as `gen9bssregj` on Smogon stats
   - BSD sets published as `gen9doublesou.json` on pkmn.cc

4. **Redundant `toId()` implementations** — Both `usage-stats.service.ts` and `smogon-sets.service.ts` had local `toId()` functions identical to the one in `@nasty-plot/core`. Deduplicated to single import.

5. **`resolveYearMonth` redundant fallback** — After trying all 6 months with HEAD, the fallback did a GET to the previous month at rating 1695 — already tried during the HEAD loop. Changed to throw.

## Pitfalls & gotchas encountered

- **React Query v5 `isPending` vs `isLoading`** — This is a common v5 migration trap. `isPending` means "no cached data" (true for disabled queries that have never fetched). `isLoading` means "actively fetching right now" (false for disabled queries). For conditional queries, always use `isLoading` for loading indicators.
- **Smogon URL rating thresholds vary by tier** — There's no documented API. OU uses 1695, most tiers use 1630, some niche tiers use 1500 or 0. The multi-rating probing approach handles this without hardcoded mappings.
- **Three different ID namespaces** — App IDs (`gen9vgc2025`), Smogon stats IDs (`gen9vgc2025regj`), pkmn.cc set IDs (`gen9doublesou`). Each service uses different naming conventions. The `smogonStatsId`/`pkmnSetsId` override pattern keeps this manageable.
- **`curl` HEAD vs browser GET** — When debugging, `curl -I` (HEAD) to Smogon URLs returns different results than browser GET for some paths. Always test with actual HEAD method when validating availability.

## Files changed

### Modified

- `packages/analysis/package.json` — added `@nasty-plot/formats` dependency
- `packages/core/src/types.ts` — added `smogonStatsId` and `pkmnSetsId` to `FormatDefinition`
- `packages/formats/src/data/format-definitions.ts` — added `smogonStatsId` for VGC/BSS/BSD, `pkmnSetsId` for BSD
- `packages/smogon-data/src/usage-stats.service.ts` — multi-rating probing (`RATING_THRESHOLDS`), `toId` import from core, `fetchUsageStats` options object signature, explicit throw on failure
- `packages/smogon-data/src/smogon-sets.service.ts` — `pkmnSetsId` option, JSON.parse error handling, `toId` import from core, skip counter
- `packages/data-pipeline/src/cli/seed.ts` — `--stats-only`/`--sets-only` flags, partial success tracking, `smogonStatsId`/`pkmnSetsId` passthrough, unknown format handling
- `apps/web/src/app/api/data/seed/route.ts` — FORMAT_DEFINITIONS integration, `smogonStatsId`/`pkmnSetsId` passthrough, partial success reporting
- `apps/web/src/app/api/formats/[id]/usage/route.ts` — null-safe species enrichment (types defaults to `[]`)
- `apps/web/src/app/api/recommend/route.ts` — `NotFoundError` class, case-insensitive "not found" matching for 404 responses
- `apps/web/src/features/team-builder/hooks/use-guided-builder.ts` — `isPending` -> `isLoading` fix
- `apps/web/src/features/team-builder/components/guided-builder.tsx` — clickable `StepIndicator` with back navigation
- `tests/smogon-data/usage-stats.service.test.ts` — updated for options object signature, multi-rating probing expectations, throw-on-failure behavior

## Known issues & next steps

- **No Vitest tests for `use-guided-builder.ts`** — Phase 5 of the guided builder plan calls for tests covering step transitions, recommendation fetching, and draft persistence
- **No end-to-end manual testing** — The full guided builder flow hasn't been tested with a running dev server after all these fixes
- **Ability descriptions in simplified set editor** — `simplified-set-editor.tsx` shows ability names but no descriptions (e.g., "Intimidate: Lowers opponent's Attack")
- **Draft-DB sync conflict detection** — When restoring from localStorage draft, slots are re-persisted to DB. If user modified in freeform then returned to guided, sync could overwrite freeform changes
- **VGC-specific format naming may change** — `gen9vgc2025regj` is regulation J specific. When regulation K arrives, the `smogonStatsId` will need updating. Consider auto-detection or pattern matching.

## Tech notes

- **Smogon stats URL pattern:** `https://www.smogon.com/stats/{YYYY}-{MM}/chaos/{formatId}-{rating}.json`. Only OU has `-1695.json`; others use `-1630.json` or lower. The `resolveYearMonth()` function probes 6 months \* 4 ratings = 24 HEAD requests maximum.
- **pkmn.cc sets URL pattern:** `https://data.pkmn.cc/sets/{formatId}.json`. Uses different IDs: VGC is `gen9vgc2025`, BSD is `gen9doublesou`, BSS is `gen9battlestadiumsingles`.
- **`fetchUsageStats` new signature:** `fetchUsageStats(formatId, options?: { smogonStatsId?: string; year?: number; month?: number })` — breaking change from positional args. All callers (seed CLI, seed API route, tests) were updated.
- **`fetchSmogonSets` new signature:** `fetchSmogonSets(formatId, options?: { pkmnSetsId?: string })` — uses override ID to fetch from pkmn.cc when format name differs.
- **Seed summary format:** `[OK]` = both stats and sets succeeded, `[PARTIAL]` = one succeeded, `[FAIL]` = both failed. Exit code 1 only on full failures.
- **Seed results (Jan 2026):** 12/12 formats OK. Largest: gen9nationaldex (471 Pokemon, 166 sets). Smallest: gen9lc (180 Pokemon, 70 sets).
