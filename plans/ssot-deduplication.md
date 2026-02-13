# SSOT Deduplication Plan

**Audit date:** 2026-02-13
**Status:** 37 violations across 80+ files
**Test baseline:** 80 files, 1894 tests passing

---

## Decisions (Pre-Approved)

1. **U1 — getTypeEffectiveness:** Delete battle-engine version, import from `@nasty-plot/core`
2. **Constants:** Aggressive — replace ALL inline literals (`100`, `252`, `31`, `510`) with named constants (including test files)
3. **SampleTeam type:** Keep `SampleTeamData` in teams package, export `SampleTeamView` with array `pokemonIds` for UI
4. **Format upsert:** Extract `ensureFormatExists()` to `formats/format.service.ts`
5. **@pkmn/img:** Add `getSpriteUrl()` / `getIconUrl()` helpers to `pokemon-data` package
6. **Frontend components:** Extract all 6-7 shared components (SearchCombobox, PokemonCard, TypeGrid, GroupedSelector, PokemonSearchSelector, MoveSelector, BattleSprite)
7. **Naming — params:** Fix both query params (`format` → `formatId`) AND route directory params (`[id]` → `[resourceId]`)
8. **fetch\* → get\*:** Rename `fetchUsageStats`, `fetchSmogonSets`, `fetchShowdownReplay` to `get*`
9. **Deprecated items:** Remove all 4 deprecated aliases/functions
10. **API client:** Consolidate into shared `createApiClient()` factory in `@nasty-plot/core`
11. **@smogon/calc in battle-engine:** Leave as-is (internal AI concern)
12. **Prisma in page:** Extract to server action (`actions.ts`)
13. **Test files:** Update to use shared constants
14. **Exports field:** Add to 4 package.json files (data-pipeline, teams, recommendations, mcp-server)
15. **File rename:** `usage-recommender.ts` → `usage-recommender.service.ts`

---

## Violations by Category

### Types (5 violations)

#### T1. SampleTeamData vs SampleTeamEntry — HIGH

- **Locations:** `packages/teams/src/sample-team.service.ts:4`, `apps/web/src/features/team-builder/hooks/use-guided-builder.ts:34`
- **Fix:** Export `SampleTeamView` from teams package with `pokemonIds: string[]`. Update web to import it.

#### T2. ExtractedPokemonData deprecated alias — MEDIUM

- **Locations:** `packages/core/src/types.ts:446`, `packages/smogon-data/src/set-inference.service.ts:16`
- **Fix:** Remove deprecated `ExtractedPokemon` alias from smogon-data. Update any consumers.

#### T3. ExtractedTeamData deprecated alias — MEDIUM

- **Locations:** `packages/core/src/types.ts:457`, `packages/smogon-data/src/set-inference.service.ts:19`
- **Fix:** Remove deprecated `ExtractedTeam` alias from smogon-data. Update any consumers.

#### T4. ShowdownReplayJson deprecated alias — MEDIUM

- **Locations:** `packages/battle-engine/src/types.ts:19`, `packages/battle-engine/src/replay/replay-import.ts:20`
- **Fix:** Remove deprecated `ShowdownReplayJson` alias. Update imports to use `ShowdownReplayJSON`.

#### T5. teamToShowdownPaste deprecated function — MEDIUM

- **Locations:** `packages/battle-engine/src/team-packer.ts:8`
- **Fix:** Remove function. Update any callers to use `serializeShowdownPaste` from `@nasty-plot/core`.

### Constants (7 violations)

#### C1. Default level 100 hardcoded — HIGH

- **Locations:** `packages/analysis/src/analysis.service.ts:80`, `packages/mcp-server/src/tools/analysis.ts` (2x), `packages/mcp-server/src/tools/team-crud.ts`, `packages/teams/src/import-export.service.ts`, `packages/battle-engine/src/team-packer.ts:66`
- **Fix:** Replace all `?? 100` and `=== 100` with `DEFAULT_LEVEL` from `@nasty-plot/core`.

#### C2. EV/IV magic numbers — HIGH

- **Locations:** `packages/analysis/src/analysis.service.ts:20-21` (`MAX_SPEED_EVS`, `PERFECT_IV`), `packages/damage-calc/src/calc.service.ts:90` (`31`), `packages/battle-engine/src/team-packer.ts:38` (`31`)
- **Fix:** Remove local constants, import `MAX_SINGLE_EV`, `MAX_TOTAL_EVS`, `PERFECT_IV`/`DEFAULT_IV` from core. Replace inline `31` and `252` with constants.

#### C3. Status mappings duplicated — HIGH

- **Locations:** `packages/core/src/constants.ts` (`STATUS_BADGE_CONFIG`), `packages/damage-calc/src/calc.service.ts:30-37` (`STATUS_MAP`), `packages/battle-engine/src/protocol-parser.ts:36-43` (`STATUS_NAMES`)
- **Fix:** Create unified `STATUS_DATA` in core with all needed fields (label, code, color, calc name). All three consumers import from core.

#### C4. Stat label mappings — MEDIUM

- **Locations:** `packages/core/src/constants.ts:125-131` (`STAT_LABELS`), `packages/battle-engine/src/protocol-parser.ts:26-32` (`BOOST_STAT_NAMES`)
- **Fix:** Remove `BOOST_STAT_NAMES`, import `STAT_LABELS` from core. Protocol-parser maps stat abbreviations through core.

#### C5. Environment config URLs — MEDIUM

- **Locations:** `packages/llm/src/config.ts:1`, `packages/mcp-server/src/api-client.ts:1`, `packages/mcp-server/src/index.ts:91`
- **Fix:** Part of API client consolidation (Decision #10). `createApiClient()` in core handles base URL config.

#### C6. Analysis thresholds scattered — MEDIUM

- **Locations:** `packages/analysis/src/analysis.service.ts:18-23` (5 constants), `packages/analysis/src/threat.service.ts:15`, `packages/damage-calc/src/calc.service.ts:61`
- **Fix:** Move to `packages/analysis/src/constants.ts`. Export from barrel.

#### C7. Team size not in core — MEDIUM

- **Locations:** `packages/analysis/src/analysis.service.ts:23` (`FULL_TEAM_SIZE = 6`)
- **Fix:** Export `TEAM_SIZE = 6` from `@nasty-plot/core/constants`. Import in analysis.

### Utilities (3 violations)

#### U1. getTypeEffectiveness same name different semantics — CRITICAL

- **Locations:** `packages/core/src/type-chart.ts:7`, `packages/battle-engine/src/ai/shared.ts:50`
- **Fix:** Delete battle-engine version. Update all AI callers to import from `@nasty-plot/core`.

#### U2. normalize/normalizeMoveName identical — HIGH

- **Locations:** `packages/smogon-data/src/set-inference.service.ts:57-59`, `packages/battle-engine/src/ai/set-predictor.ts:97-99`
- **Fix:** Export `normalizeMoveName()` from `@nasty-plot/core`. Remove both local implementations.

#### U3. toPercent/toPercentage identical — HIGH

- **Locations:** `packages/damage-calc/src/calc.service.ts:56-59`, `packages/battle-engine/src/simulation/batch-simulator.ts:172-174`
- **Fix:** Export `toPercent()` from `@nasty-plot/core`. Remove both local implementations.

### Services (5 violations)

#### S1. Format upsert logic duplicated — HIGH

- **Locations:** `packages/teams/src/team.service.ts:180-201`, `apps/web/src/app/api/data/seed/route.ts:28-56`, `apps/web/src/app/api/battles/import/route.ts:143-155`
- **Fix:** Extract `ensureFormatExists(formatId, generation?, gameType?)` to `packages/formats/src/format.service.ts`. All callers import from `@nasty-plot/formats`.

#### S2. API client consolidation — MEDIUM

- **Locations:** `apps/web/src/lib/api-client.ts`, `packages/mcp-server/src/api-client.ts`
- **Fix:** Create `createApiClient(baseUrl?)` in `@nasty-plot/core`. Both consumers use it.

#### S3. DB slot-to-domain partial duplication — MEDIUM

- **Locations:** `packages/teams/src/team.service.ts:104-139` (`dbSlotToDomain`), `packages/teams/src/team-matcher.service.ts:123-137`
- **Fix:** Export `dbSlotToDomain()` from team.service barrel. Use in team-matcher.

#### S4. DataSyncLog writing duplicated — MEDIUM

- **Locations:** `packages/smogon-data/src/smogon-sets.service.ts:36-48`, `packages/data-pipeline/src/cli/seed.ts:64-70`
- **Fix:** Create `logSyncResult()` helper in data-pipeline, used by both.

#### S5. Format definition filtering duplicated — MEDIUM

- **Locations:** `apps/web/src/app/api/data/seed/route.ts:17-26`, `packages/data-pipeline/src/cli/seed.ts:9-16`
- **Fix:** Export `getActiveFormats()` from `@nasty-plot/formats`. Callers import it.

### Package Boundaries (4 violations)

#### P1. @pkmn/img no wrapper — MEDIUM

- **Locations:** `packages/ui/src/pokemon-sprite.tsx`, `apps/web/src/features/battle/components/PokeballIndicator.tsx`, `apps/web/src/features/battle/components/PokemonSprite.tsx`, `apps/web/src/features/battle/components/TeamPickerCard.tsx`
- **Fix:** Add `getSpriteUrl()`, `getIconUrl()` to `packages/pokemon-data`. Update 4 files.

#### P2. @smogon/calc in battle-engine — SKIP (Decision #11)

- **Status:** Leave as-is. Internal AI concern.

#### P3. Prisma in Pokemon detail page — MEDIUM

- **Location:** `apps/web/src/app/pokemon/[id]/page.tsx:15`
- **Fix:** Extract competitive data query to `apps/web/src/app/pokemon/[id]/actions.ts`.

#### P4. usage-recommender.ts naming — MEDIUM

- **Location:** `packages/recommendations/src/usage-recommender.ts`
- **Fix:** Rename to `usage-recommender.service.ts`. Update barrel and imports.

### Frontend Components (7 violations)

#### F1. Inline combobox implementations — HIGH

- **Locations:** `apps/web/src/features/damage-calc/components/damage-calculator.tsx` (3 inline), `apps/web/src/features/team-builder/components/item-combobox.tsx`
- **Fix:** Extract `SearchCombobox` to `packages/ui/`. Refactor all 4 usages.

#### F2. Pokemon card display pattern — HIGH

- **Locations:** `apps/web/src/features/team-builder/components/guided/recommendation-card.tsx`, `core-picker.tsx`, `apps/web/src/features/battle/components/SampleTeamCard.tsx`, `team-grid.tsx`
- **Fix:** Extract `PokemonCard` to `packages/ui/`.

#### F3. Pokemon sprite duplication — MEDIUM

- **Locations:** `packages/ui/src/pokemon-sprite.tsx`, `apps/web/src/features/battle/components/PokemonSprite.tsx`
- **Fix:** Extend `packages/ui` PokemonSprite with battle props (fainted, side, animation).

#### F4. Type badge grid — MEDIUM

- **Locations:** `apps/web/src/features/team-builder/components/shared/tera-type-picker.tsx`, `guided/simplified-analysis.tsx`, `analysis/components/coverage-chart.tsx`
- **Fix:** Extract `TypeGrid` to `packages/ui/`.

#### F5. Grouped selector — MEDIUM

- **Locations:** `apps/web/src/features/battle/components/FormatSelector.tsx`, `team-builder/components/shared/nature-selector.tsx`
- **Fix:** Extract `GroupedSelector` wrapper to `packages/ui/`.

#### F6. Pokemon search selector — MEDIUM

- **Locations:** `apps/web/src/features/team-builder/components/pokemon-search-panel.tsx`, `damage-calc/components/opponent-selector.tsx`
- **Fix:** Extract `PokemonSearchSelector` to `packages/ui/`.

#### F7. Move selector — MEDIUM

- **Locations:** `apps/web/src/features/team-builder/components/shared/move-input.tsx`, `damage-calc/components/damage-calculator.tsx` (MoveCombobox)
- **Fix:** Unify into single `MoveSelector` in `packages/ui/`.

### Naming (4 violations)

#### N1. Query param format vs formatId — HIGH

- **Locations:** `apps/web/src/app/api/pokemon/route.ts`, `pokemon/[id]/learnset/route.ts`, `pokemon/[id]/sets/route.ts`, `pokemon/[id]/popularity/route.ts`, `items/route.ts`
- **Fix:** Rename query param from `format` to `formatId` in all 5 routes. Update frontend callers.

#### N2. fetch\* → get\* function naming — MEDIUM

- **Locations:** `packages/smogon-data/src/usage-stats.service.ts:183` (fetchUsageStats), `smogon-data/src/smogon-sets.service.ts:55` (fetchSmogonSets), `battle-engine/src/replay/replay-import.ts:47` (fetchShowdownReplay)
- **Fix:** Rename all 3 functions to `get*`. Update ~10 call sites.

#### N3. Route param [id] → [resourceId] — MEDIUM

- **Locations:** `apps/web/src/app/api/pokemon/[id]/`, `chat/sessions/[id]/`, `sample-teams/[id]/`, `formats/[id]/`
- **Fix:** Rename directories: `[id]` → `[pokemonId]`, `[sessionId]`, `[teamId]`, `[formatId]`. Update param destructuring.

#### N4. Response wrapping inconsistency — MEDIUM (DEFERRED)

- **Note:** Tracked but not addressed in this pass. Requires broader API contract discussion.

### Imports (1 violation)

#### I1. Missing exports field in package.json — LOW

- **Locations:** `packages/data-pipeline/package.json`, `packages/teams/package.json`, `packages/recommendations/package.json`, `packages/mcp-server/package.json`
- **Fix:** Add `"exports": { ".": "./src/index.ts" }` to each.

---

## Execution Plan — Parallel Agent Architecture

### Dependency Graph

```
Wave 1: Create canonical sources (no deps)
  ├── Agent 1: Core constants & utilities
  ├── Agent 2: Core API client factory
  ├── Agent 3: Format service (ensureFormatExists + getActiveFormats)
  ├── Agent 4: Pokemon-data sprite helpers
  ├── Agent 5: Remove deprecated items
  └── Agent 6: Package.json exports + file rename
       │
Wave 2: Consume canonical sources (depends on Wave 1)
  ├── Agent 7: Constants consumers (replace all literals across packages)
  ├── Agent 8: Constants consumers (replace all literals in tests)
  ├── Agent 9: Utility consumers (getTypeEffectiveness, normalizeMoveName, toPercent)
  ├── Agent 10: Service consumers (format upsert, API client, slot mapping, sync log)
  └── Agent 11: Naming fixes (fetch→get, query params, route params)
       │
Wave 3: Frontend extraction (depends on Wave 1 sprite helpers)
  ├── Agent 12: Extract SearchCombobox + PokemonCard to packages/ui
  ├── Agent 13: Extract TypeGrid + GroupedSelector to packages/ui
  ├── Agent 14: Extract PokemonSearchSelector + MoveSelector to packages/ui
  ├── Agent 15: BattleSprite consolidation + @pkmn/img wrapper usage
  └── Agent 16: Prisma extraction + SampleTeamView type
```

### Wave 1 — 6 Agents (No Dependencies)

Create canonical sources. These agents add/modify exports but don't change consumers.

#### Agent 1: `core-constants-utils`

**Scope:** `packages/core/`
**Tasks:**

1. Read `packages/core/src/constants.ts`
2. Add missing constants if not present: `TEAM_SIZE = 6`, `PERFECT_IV = 31` (or verify DEFAULT_IVS covers this)
3. Add unified `STATUS_DATA` constant that covers all three current mappings (badge config, calc status names, protocol status names). Keep existing `STATUS_BADGE_CONFIG` as a re-export or alias for backward compat if needed.
4. Read `packages/core/src/type-chart.ts` — no changes needed (canonical source)
5. Add `normalizeMoveName(name: string): string` to a new `packages/core/src/utils.ts` (or existing utility file): `return name.toLowerCase().replace(/\s/g, "")`
6. Add `toPercent(value: number, total: number): number` to same utility file
7. Export new symbols from `packages/core/src/index.ts`
8. Run `pnpm test -- tests/core/`

#### Agent 2: `core-api-client`

**Scope:** `packages/core/`
**Tasks:**

1. Read `apps/web/src/lib/api-client.ts` and `packages/mcp-server/src/api-client.ts`
2. Create `packages/core/src/api-client.ts` with a `createApiClient(baseUrl?: string)` factory that returns `{ get, post, put, del }` helpers with shared error handling and JSON parsing
3. Export from `packages/core/src/index.ts`
4. Run `pnpm test -- tests/core/`

#### Agent 3: `formats-service`

**Scope:** `packages/formats/`
**Tasks:**

1. Read `packages/formats/src/format.service.ts`
2. Read the format upsert logic from `packages/teams/src/team.service.ts:180-201`
3. Add `ensureFormatExists(formatId: string, generation?: number, gameType?: string)` to `format.service.ts` with prisma upsert
4. Add `getActiveFormats()` helper that filters `FORMAT_DEFINITIONS` by `isActive`
5. Export both from `packages/formats/src/index.ts`
6. Run `pnpm test -- tests/formats/`

#### Agent 4: `pokemon-data-sprites`

**Scope:** `packages/pokemon-data/`
**Tasks:**

1. Read `packages/ui/src/pokemon-sprite.tsx` to understand current @pkmn/img usage
2. Read `apps/web/src/features/battle/components/PokemonSprite.tsx` for battle sprite usage
3. Add `packages/pokemon-data/src/sprite.service.ts` with `getSpriteUrl(pokemonId, options?)` and `getIconUrl(pokemonId)` wrapping @pkmn/img
4. Move `@pkmn/img` dependency from `packages/ui/package.json` to `packages/pokemon-data/package.json` (if not already there)
5. Export from `packages/pokemon-data/src/index.ts`
6. Run `pnpm test -- tests/pokemon-data/` (if tests exist)

#### Agent 5: `remove-deprecated`

**Scope:** `packages/smogon-data/`, `packages/battle-engine/`
**Tasks:**

1. Read `packages/smogon-data/src/set-inference.service.ts` — remove `ExtractedPokemon` and `ExtractedTeam` deprecated aliases (lines ~15-19)
2. Grep for any consumers of `ExtractedPokemon` or `ExtractedTeam` from smogon-data — update to import from `@nasty-plot/core`
3. Read `packages/battle-engine/src/replay/replay-import.ts` — remove `ShowdownReplayJson` deprecated alias (line ~20)
4. Grep for any consumers of `ShowdownReplayJson` — update to use `ShowdownReplayJSON`
5. Read `packages/battle-engine/src/team-packer.ts` — remove deprecated `teamToShowdownPaste` function
6. Grep for any callers of `teamToShowdownPaste` — update to use `serializeShowdownPaste` from `@nasty-plot/core`
7. Update barrel exports in both packages
8. Run `pnpm test -- tests/battle-engine/ tests/smogon-data/`

#### Agent 6: `package-json-cleanup`

**Scope:** `packages/data-pipeline/`, `packages/teams/`, `packages/recommendations/`, `packages/mcp-server/`
**Tasks:**

1. Add `"exports": { ".": "./src/index.ts" }` to `packages/data-pipeline/package.json`
2. Add `"exports": { ".": "./src/index.ts" }` to `packages/teams/package.json`
3. Add `"exports": { ".": "./src/index.ts" }` to `packages/recommendations/package.json`
4. Add appropriate exports to `packages/mcp-server/package.json`
5. Rename `packages/recommendations/src/usage-recommender.ts` → `packages/recommendations/src/usage-recommender.service.ts`
6. Update imports in `packages/recommendations/src/index.ts` (barrel)
7. Grep for any direct imports of the old filename — update them
8. Run `pnpm test -- tests/recommendations/`

### Wave 2 — 5 Agents (After Wave 1)

Consume the canonical sources created in Wave 1.

#### Agent 7: `constants-packages`

**Scope:** All packages (NOT tests)
**Tasks:**

1. Replace `?? 100` and `=== 100` with `DEFAULT_LEVEL` from `@nasty-plot/core` in:
   - `packages/analysis/src/analysis.service.ts`
   - `packages/mcp-server/src/tools/analysis.ts`
   - `packages/mcp-server/src/tools/team-crud.ts`
   - `packages/teams/src/import-export.service.ts`
   - `packages/battle-engine/src/team-packer.ts`
2. Remove `MAX_SPEED_EVS = 252` and `PERFECT_IV = 31` from `packages/analysis/src/analysis.service.ts`, import from core
3. Replace inline `31` with `PERFECT_IV` or `DEFAULT_IVS` usage in `packages/damage-calc/src/calc.service.ts` and `packages/battle-engine/src/team-packer.ts`
4. Remove `FULL_TEAM_SIZE = 6` from analysis, import `TEAM_SIZE` from core
5. Replace `STATUS_MAP` in `damage-calc/src/calc.service.ts` with import from core's `STATUS_DATA`
6. Replace `STATUS_NAMES` in `battle-engine/src/protocol-parser.ts` with import from core's `STATUS_DATA`
7. Replace `BOOST_STAT_NAMES` in `battle-engine/src/protocol-parser.ts` with `STAT_LABELS` from core
8. Move analysis-specific thresholds (`TOP_USAGE_FOR_BENCHMARKS`, `MAX_BENCHMARKS`, etc.) to `packages/analysis/src/constants.ts`, export from barrel
9. Run `pnpm test -- tests/analysis/ tests/damage-calc/ tests/battle-engine/ tests/mcp-server/ tests/teams/`

#### Agent 8: `constants-tests`

**Scope:** `tests/` directory only
**Tasks:**

1. Search all test files for inline `100`, `252`, `31`, `510`, `6` literals used as Pokemon/EV/IV/level values
2. Replace with appropriate constants from `@nasty-plot/core` (`DEFAULT_LEVEL`, `MAX_SINGLE_EV`, `PERFECT_IV`, `MAX_TOTAL_EVS`, `TEAM_SIZE`)
3. Add imports as needed
4. Run `pnpm test`

#### Agent 9: `utility-consumers`

**Scope:** `packages/battle-engine/`, `packages/smogon-data/`, `packages/damage-calc/`
**Tasks:**

1. Delete `getTypeEffectiveness` from `packages/battle-engine/src/ai/shared.ts`
2. Update all AI files that called it to import from `@nasty-plot/core`
3. Delete `normalizeMoveName` from `packages/battle-engine/src/ai/set-predictor.ts`
4. Delete `normalize` from `packages/smogon-data/src/set-inference.service.ts`
5. Update both files to import `normalizeMoveName` from `@nasty-plot/core`
6. Delete `toPercent` from `packages/damage-calc/src/calc.service.ts`
7. Delete `toPercentage` from `packages/battle-engine/src/simulation/batch-simulator.ts`
8. Update both files to import `toPercent` from `@nasty-plot/core`
9. Run `pnpm test -- tests/battle-engine/ tests/smogon-data/ tests/damage-calc/`

#### Agent 10: `service-consumers`

**Scope:** `packages/teams/`, `packages/formats/`, `apps/web/`, `packages/data-pipeline/`, `packages/smogon-data/`, `packages/mcp-server/`
**Tasks:**

1. Replace format upsert logic in `packages/teams/src/team.service.ts` with `ensureFormatExists()` from `@nasty-plot/formats`
2. Replace format upsert logic in `apps/web/src/app/api/data/seed/route.ts` with `ensureFormatExists()`
3. Replace format upsert logic in `apps/web/src/app/api/battles/import/route.ts` with `ensureFormatExists()`
4. Replace format filtering in `apps/web/src/app/api/data/seed/route.ts` with `getActiveFormats()` from `@nasty-plot/formats`
5. Replace format filtering in `packages/data-pipeline/src/cli/seed.ts` with `getActiveFormats()`
6. Update `apps/web/src/lib/api-client.ts` to use `createApiClient()` from `@nasty-plot/core`
7. Update `packages/mcp-server/src/api-client.ts` to use `createApiClient()` from `@nasty-plot/core`
8. Export `dbSlotToDomain` from teams barrel if not already; use in `team-matcher.service.ts`
9. Consolidate DataSyncLog writing: create shared helper, use in smogon-data and data-pipeline
10. Run `pnpm test -- tests/teams/ tests/formats/ tests/data-pipeline/ tests/smogon-data/ tests/mcp-server/`

#### Agent 11: `naming-fixes`

**Scope:** `apps/web/src/app/api/`, `packages/smogon-data/`, `packages/battle-engine/`
**Tasks:**

1. Rename `fetchUsageStats` → `getUsageStats` in `packages/smogon-data/src/usage-stats.service.ts` and all call sites
2. Rename `fetchSmogonSets` → `getSmogonSets` in `packages/smogon-data/src/smogon-sets.service.ts` and all call sites
3. Rename `fetchShowdownReplay` → `getShowdownReplay` in `packages/battle-engine/src/replay/replay-import.ts` and all call sites
4. Update barrel exports in smogon-data and battle-engine
5. In API routes, rename query param `format` → `formatId`:
   - `apps/web/src/app/api/pokemon/route.ts`
   - `apps/web/src/app/api/pokemon/[id]/learnset/route.ts`
   - `apps/web/src/app/api/pokemon/[id]/sets/route.ts`
   - `apps/web/src/app/api/pokemon/[id]/popularity/route.ts`
   - `apps/web/src/app/api/items/route.ts`
6. Update frontend callers passing `?format=` to use `?formatId=`
7. Rename route directories:
   - `apps/web/src/app/api/pokemon/[id]/` → `apps/web/src/app/api/pokemon/[pokemonId]/`
   - `apps/web/src/app/api/chat/sessions/[id]/` → `apps/web/src/app/api/chat/sessions/[sessionId]/`
   - `apps/web/src/app/api/sample-teams/[id]/` → `apps/web/src/app/api/sample-teams/[teamId]/`
   - `apps/web/src/app/api/formats/[id]/` → `apps/web/src/app/api/formats/[formatId]/`
   - Also rename page routes: `apps/web/src/app/pokemon/[id]/` → `apps/web/src/app/pokemon/[pokemonId]/`, `apps/web/src/app/battle/replay/[battleId]/` (verify current name)
8. Update `params` destructuring in all renamed route files
9. Update any `Link` or `router.push` calls referencing old param names
10. Run `pnpm test -- tests/api/ tests/smogon-data/ tests/battle-engine/`

### Wave 3 — 5 Agents (After Wave 1 & 2)

Frontend component extraction and final cleanup.

#### Agent 12: `ui-combobox-card`

**Scope:** `packages/ui/`, `apps/web/src/features/damage-calc/`, `apps/web/src/features/team-builder/`
**Tasks:**

1. Create `packages/ui/src/search-combobox.tsx` — reusable Popover + Command search component with props: `value`, `placeholder`, `onSelect`, `renderItem`, `fetchResults`, `popoverWidth`
2. Refactor `PokemonCombobox`, `MoveCombobox`, `ItemCombobox` in damage-calculator.tsx to use `SearchCombobox`
3. Refactor `item-combobox.tsx` in team-builder to use `SearchCombobox`
4. Create `packages/ui/src/pokemon-card.tsx` — reusable card with PokemonSprite + name + TypeBadges + metadata
5. Refactor `recommendation-card.tsx`, `core-picker.tsx`, `SampleTeamCard.tsx`, `team-grid.tsx` to use `PokemonCard`
6. Export from `packages/ui/src/index.ts`
7. Run `pnpm test -- tests/ui/`

#### Agent 13: `ui-typegrid-selector`

**Scope:** `packages/ui/`, `apps/web/src/features/team-builder/`, `apps/web/src/features/analysis/`, `apps/web/src/features/battle/`
**Tasks:**

1. Create `packages/ui/src/type-grid.tsx` — grid of TypeBadges with selection/status styling
2. Refactor `tera-type-picker.tsx`, `simplified-analysis.tsx`, `coverage-chart.tsx` to use `TypeGrid`
3. Create `packages/ui/src/grouped-selector.tsx` — Select with grouped items
4. Refactor `FormatSelector.tsx` and `nature-selector.tsx` to use `GroupedSelector`
5. Export from `packages/ui/src/index.ts`
6. Run `pnpm test -- tests/ui/`

#### Agent 14: `ui-search-move`

**Scope:** `packages/ui/`, `apps/web/src/features/team-builder/`, `apps/web/src/features/damage-calc/`
**Tasks:**

1. Create `packages/ui/src/pokemon-search-selector.tsx` — search + select Pokemon component
2. Refactor `pokemon-search-panel.tsx` and `opponent-selector.tsx` to use it
3. Create `packages/ui/src/move-selector.tsx` — unified move dropdown with learnset filtering
4. Refactor `move-input.tsx` and `MoveCombobox` in damage-calculator to use `MoveSelector`
5. Export from `packages/ui/src/index.ts`
6. Run `pnpm test -- tests/ui/`

#### Agent 15: `sprite-consolidation`

**Scope:** `packages/ui/`, `packages/pokemon-data/`, `apps/web/src/features/battle/`
**Tasks:**

1. Update `packages/ui/src/pokemon-sprite.tsx` to:
   - Import `getSpriteUrl`, `getIconUrl` from `@nasty-plot/pokemon-data` instead of `@pkmn/img`
   - Add battle-specific props: `side?: "front" | "back"`, `fainted?: boolean`, `animationClass?: string`
2. Remove the separate `apps/web/src/features/battle/components/PokemonSprite.tsx` (BattleSprite)
3. Update battle components (`SwitchMenu`, `MoveSelector`, `BattleField`, `TeamPreview`) to use `PokemonSprite` from `@nasty-plot/ui` with battle props
4. Update `PokeballIndicator.tsx` and `TeamPickerCard.tsx` to import sprite URL from pokemon-data
5. Remove `@pkmn/img` from `packages/ui/package.json` if it's now only in pokemon-data
6. Run `pnpm test -- tests/ui/ tests/battle-engine/`

#### Agent 16: `prisma-extraction-types`

**Scope:** `apps/web/src/app/pokemon/[pokemonId]/`, `packages/teams/`
**Tasks:**

1. Read `apps/web/src/app/pokemon/[pokemonId]/page.tsx` (post-rename from Wave 2)
2. Extract competitive data prisma queries to `apps/web/src/app/pokemon/[pokemonId]/actions.ts`
3. Update page to call the server action
4. Read `packages/teams/src/sample-team.service.ts` — add `SampleTeamView` type with `pokemonIds: string[]`
5. Add `toSampleTeamView()` conversion function
6. Export from teams barrel
7. Update `apps/web/src/features/team-builder/hooks/use-guided-builder.ts` to import `SampleTeamView` from `@nasty-plot/teams`
8. Remove inline `SampleTeamEntry` type from web
9. Run `pnpm test -- tests/teams/`

### Post-Execution Verification

After all waves complete:

```bash
# Full test suite
pnpm test

# Full build
pnpm build

# Verify no remaining deprecated aliases
grep -r "ExtractedPokemon\b" packages/smogon-data/
grep -r "ExtractedTeam\b" packages/smogon-data/
grep -r "ShowdownReplayJson\b" packages/battle-engine/
grep -r "teamToShowdownPaste" packages/battle-engine/

# Verify no remaining inline level defaults
grep -rn "?? 100\b" packages/ --include="*.ts" | grep -v node_modules | grep -v ".test."
grep -rn "=== 100\b" packages/ --include="*.ts" | grep -v node_modules | grep -v ".test."

# Verify no remaining duplicate type effectiveness
grep -rn "getTypeEffectiveness" packages/battle-engine/src/ai/shared.ts

# Verify no remaining fetch* names
grep -rn "fetchUsageStats\|fetchSmogonSets\|fetchShowdownReplay" packages/ --include="*.ts"

# Verify query params fixed
grep -rn "searchParams.get(\"format\")" apps/web/ --include="*.ts"

# Verify @pkmn/img only in pokemon-data
grep -rn "from \"@pkmn/img\"" packages/ apps/ --include="*.ts" --include="*.tsx" | grep -v pokemon-data | grep -v node_modules
```
