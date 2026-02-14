# SSOT Deduplication Plan (v4)

**Audit date:** 2026-02-14
**Status:** 16 violations across 40+ files
**Test baseline:** 80 files, 1875 tests, all passing
**Prior audit:** v3 on 2026-02-13 fixed 24 violations. This plan addresses NEW violations found since.

---

## Violations

### 1. Utilities (3 violations)

#### U1. `getTotalEvs` duplicated in 3 locations — HIGH

- **Locations:**
  - `packages/core/src/stat-calc.ts:55` — exported (CANONICAL)
  - `packages/ui/src/ev-editor.tsx:17` — private redefinition (DUPLICATE)
  - `packages/mcp-server/src/tools/analysis.ts:146` — private as `sumStats` (DUPLICATE)
- **Fix:** UI and MCP-server should import `getTotalEvs` from `@nasty-plot/core`

#### U2. Query param parsing pattern repeated in 5 API routes — MEDIUM

- **Locations:**
  - `apps/web/src/app/api/formats/[formatId]/pokemon/route.ts:17`
  - `apps/web/src/app/api/formats/[formatId]/usage/route.ts:13`
  - `apps/web/src/app/api/formats/[formatId]/cores/route.ts:13`
  - `apps/web/src/app/api/pokemon/route.ts:20`
  - `apps/web/src/app/api/items/route.ts:11`
- **Fix:** Add `parseIntQueryParam(value, fallback, min, max)` to `packages/core/src/utils.ts`, update all 5 routes

#### U3. `formatPercent` variant — LOW

- **Locations:**
  - `packages/core/src/utils.ts:14` — `formatUsagePercent(percent, decimals)` (CANONICAL)
  - `apps/web/src/app/pokemon/[pokemonId]/competitive-data.tsx:27` — private `formatPercent(value)` with different input range
- **Fix:** Replace with `formatUsagePercent(value * 100)` from core

### 2. Services (3 violations)

#### S1. Direct Prisma in API route — MEDIUM

- **Location:** `apps/web/src/app/api/data/status/route.ts:7`
- **Fix:** Add `getSyncLogs()` function to `packages/smogon-data/src/sync-log.service.ts`, call from route

#### S2. Direct Prisma in server action — HIGH

- **Location:** `apps/web/src/app/pokemon/[pokemonId]/actions.ts:22-33`
- **Fix:** Use `getUsageStats()` or `getTopPokemon()` from `@nasty-plot/smogon-data` instead of `prisma.usageStats.findFirst()`

#### S3. Seed script duplicates teams service logic — MEDIUM

- **Location:** `packages/data-pipeline/src/seed-sample-teams.ts:33-37`
- **Fix:** Use `createSampleTeam()` and `extractPokemonIds()` from `@nasty-plot/teams`

### 3. Frontend (5 violations)

#### F1. Team slot form state duplication — HIGH

- **Locations:**
  - `apps/web/src/features/team-builder/components/slot-editor.tsx:81-149`
  - `apps/web/src/features/team-builder/components/guided/simplified-set-editor.tsx:45-99`
- **Fix:** Extract `useTeamSlotForm(slot, formatId?)` hook

#### F2. EV change handler clamping duplication — MEDIUM (part of F1)

- **Locations:**
  - `apps/web/src/features/team-builder/components/slot-editor.tsx:129-141`
  - `apps/web/src/features/team-builder/components/guided/simplified-set-editor.tsx:74-90`
- **Fix:** Included in F1's `useTeamSlotForm` hook

#### F3. Loading skeleton pattern repeated — MEDIUM

- **Locations:**
  - `apps/web/src/app/teams/loading.tsx`
  - `apps/web/src/app/pokemon/loading.tsx`
  - `apps/web/src/app/pokemon/[pokemonId]/loading.tsx`
  - `apps/web/src/app/chat/loading.tsx`
  - `apps/web/src/app/teams/[teamId]/loading.tsx`
- **Fix:** Create `SkeletonGrid` component

#### F4. Pokemon search hook duplication — MEDIUM

- **Locations:**
  - `apps/web/src/features/team-builder/components/pokemon-search-panel.tsx`
  - `apps/web/src/features/damage-calc/components/opponent-selector.tsx`
- **Fix:** Extract `usePokemonSearch(formatId?)` hook

#### F5. Popularity grouping pattern duplication — MEDIUM

- **Locations:**
  - `apps/web/src/features/team-builder/components/item-combobox.tsx:66-82`
  - `apps/web/src/features/team-builder/components/shared/nature-selector.tsx:15-24`
- **Fix:** Extract `usePopularityGroups<T>(items, popular, getKey)` hook

### 4. Imports (2 violations)

#### I1. `ensureFormatExists` not in barrel export — MEDIUM

- **Locations:**
  - `packages/formats/src/index.ts` — missing export
  - `packages/teams/src/team.service.ts:2` — imports from `@nasty-plot/formats/db`
  - `packages/data-pipeline/src/cli/seed.ts:6` — imports from `@nasty-plot/formats/db`
- **Fix:** Add to barrel, update consumers to import from `@nasty-plot/formats`

#### I2. 4 packages missing `exports` field in package.json — LOW

- **Locations:**
  - `packages/data-pipeline/package.json`
  - `packages/mcp-server/package.json`
  - `packages/teams/package.json`
  - `packages/recommendations/package.json`
- **Fix:** Add `"exports": { ".": "./src/index.ts" }` to each

### 5. Naming (3 violations)

#### N1. Generic `id` parameters instead of typed names — HIGH

- **Locations:**
  - `packages/pokemon-data/src/dex.service.ts:34` — `getSpecies(id)` → `getSpecies(pokemonId)`
  - `packages/pokemon-data/src/dex.service.ts:88` — `getMove(id)` → `getMove(moveId)`
  - `packages/pokemon-data/src/dex.service.ts:104` — `getAbility(id)` → `getAbility(abilityId)`
  - `packages/pokemon-data/src/dex.service.ts:123` — `getItem(id)` → `getItem(itemId)`
  - `packages/formats/src/format.service.ts:43` — `getFormat(id)` → `getFormat(formatId)`
- **Fix:** Rename parameters in function signatures and all internal usages

#### N2. 9 service files missing `.service.ts` suffix — MEDIUM

- **Core (4 files):**
  - `packages/core/src/validation.ts` → `validation.service.ts`
  - `packages/core/src/stat-calc.ts` → `stat-calc.service.ts`
  - `packages/core/src/showdown-paste.ts` → `showdown-paste.service.ts`
  - `packages/core/src/type-chart.ts` → `type-chart.service.ts`
- **Non-core (5 files):**
  - `packages/llm/src/cli-chat.ts` → `cli-chat.service.ts`
  - `packages/mcp-server/src/api-client.ts` → `api-client.service.ts`
  - `packages/recommendations/src/coverage-recommender.ts` → `coverage-recommender.service.ts`
  - `packages/recommendations/src/usage-recommender.ts` → `usage-recommender.service.ts`
  - `packages/recommendations/src/composite-recommender.ts` → `composite-recommender.service.ts`
- **Fix:** Rename files, update barrel exports, update test `#` alias imports

#### N3. `BattleState.format` field should be `gameType` — MEDIUM

- **Locations:**
  - `packages/battle-engine/src/types.ts:130` — `format: GameType` field
  - `packages/battle-engine/src/battle-manager.service.ts:43` — `format` parameter
  - All consumers of `BattleState.format`
- **Fix:** Rename to `gameType` throughout

---

## Decisions (Pre-Approved)

1. T1/T2/T3 (Weather/Terrain/Status types): **REMOVED** — not violations, different external library naming conventions (`@pkmn/sim` vs `@smogon/calc`)
2. N2 (service file naming): **Rename all 9 files** to follow `{name}.service.ts` convention
3. N1 (parameter naming): **Rename all** to `pokemonId`, `moveId`, `abilityId`, `itemId`, `formatId`
4. Frontend scope: **All F1-F5** — extract all shared hooks and components
5. N3 (gameType): **Rename** `BattleState.format` to `gameType` and update all references

---

## Execution Plan — Parallel Agent Architecture

### Dependency Graph

```
Wave 1 (6 agents): U1, U2, U3+S, I, N1, N3
   │  (all independent — different files)
   v
Wave 2 (2 agents): N2a (core renames), N2b (non-core renames)
   │  (depends on Wave 1 — touches barrel exports that Wave 1 may have modified)
   v
Wave 3 (4 agents): F1, F3, F4, F5
   │  (depends on Wave 2 — frontend files may import from renamed modules)
   v
Post-execution verification
```

### Wave 1 — 6 Agents (No Dependencies)

#### Agent 1: `fix-getTotalEvs`

**Scope:** `packages/ui/src/ev-editor.tsx`, `packages/mcp-server/src/tools/analysis.ts`
**Tasks:**

1. Read `packages/ui/src/ev-editor.tsx`
2. Remove the private `getTotalEvs` function (lines 17-19)
3. Add `getTotalEvs` to the existing `@nasty-plot/core` import on line 4
4. Read `packages/mcp-server/src/tools/analysis.ts`
5. Find and remove the private `sumStats` function
6. Add `import { getTotalEvs } from "@nasty-plot/core"` (or add to existing core import)
7. Replace all `sumStats(...)` calls with `getTotalEvs(...)`
8. Run `pnpm test -- tests/mcp-server/ tests/ui/` (if UI tests exist)

#### Agent 2: `add-parseIntQueryParam`

**Scope:** `packages/core/src/utils.ts`, 5 API route files
**Tasks:**

1. Read `packages/core/src/utils.ts`
2. Add this function at the end:
   ```typescript
   export function parseIntQueryParam(
     value: string | null,
     fallback: number,
     min: number,
     max: number,
   ): number {
     const parsed = parseInt(value ?? String(fallback), 10)
     return Math.min(max, Math.max(min, isNaN(parsed) ? fallback : parsed))
   }
   ```
3. For each of the 5 API routes:
   - Read the file
   - Add `import { parseIntQueryParam } from "@nasty-plot/core"` (or add to existing import)
   - Replace inline `Math.min(max, Math.max(min, parseInt(...)))` pattern with `parseIntQueryParam(...)`
4. Run `pnpm test -- tests/core/`

#### Agent 3: `fix-service-bypasses`

**Scope:** Service bypass fixes (S1, S2, S3) + U3 (formatPercent)
**Tasks:**

1. **S1:** Read `apps/web/src/app/api/data/status/route.ts`
   - Read `packages/smogon-data/src/sync-log.service.ts` to understand existing API
   - Add a `getSyncLogs()` function to sync-log.service.ts that wraps the Prisma query
   - Export it from `packages/smogon-data/src/index.ts`
   - Update route.ts to import and use `getSyncLogs()` instead of direct Prisma
2. **S2:** Read `apps/web/src/app/pokemon/[pokemonId]/actions.ts`
   - Read `packages/smogon-data/src/usage-stats.service.ts` to find appropriate function
   - Replace `prisma.usageStats.findFirst(...)` with the smogon-data service call
   - Remove direct `prisma` import if no longer needed
3. **S3:** Read `packages/data-pipeline/src/seed-sample-teams.ts`
   - Read `packages/teams/src/sample-team.service.ts` to understand `createSampleTeam()` and `extractPokemonIds()`
   - Refactor seed script to use the teams service functions instead of direct Prisma
4. **U3:** Read `apps/web/src/app/pokemon/[pokemonId]/competitive-data.tsx`
   - Replace local `formatPercent(value)` with `formatUsagePercent(value * 100)` from core
5. Run `pnpm test -- tests/smogon-data/ tests/data-pipeline/`

#### Agent 4: `fix-imports-and-exports`

**Scope:** Barrel exports and package.json fixes (I1, I2)
**Tasks:**

1. **I1:** Read `packages/formats/src/index.ts`
   - Add `export { ensureFormatExists } from "./format-db.service"`
   - Read `packages/teams/src/team.service.ts` — change `import { ensureFormatExists } from "@nasty-plot/formats/db"` to `import { ensureFormatExists } from "@nasty-plot/formats"`
   - Read `packages/data-pipeline/src/cli/seed.ts` — same import fix
2. **I2:** Add `"exports": { ".": "./src/index.ts" }` to:
   - `packages/data-pipeline/package.json`
   - `packages/mcp-server/package.json`
   - `packages/teams/package.json`
   - `packages/recommendations/package.json`
3. Run `pnpm test -- tests/teams/ tests/formats/`

#### Agent 5: `rename-parameters`

**Scope:** `packages/pokemon-data/src/dex.service.ts`, `packages/formats/src/format.service.ts`
**Tasks:**

1. Read `packages/pokemon-data/src/dex.service.ts`
2. Rename parameters (NOT function names, just the parameter variable):
   - `getSpecies(id: string)` → `getSpecies(pokemonId: string)` — update all `id` refs inside function body
   - `getMove(id: string)` → `getMove(moveId: string)` — update internal refs
   - `getAbility(id: string)` → `getAbility(abilityId: string)` — update internal refs
   - `getItem(id: string)` → `getItem(itemId: string)` — update internal refs
3. Read `packages/formats/src/format.service.ts`
4. Rename: `getFormat(id: string)` → `getFormat(formatId: string)` — update internal refs
5. Run `pnpm test -- tests/pokemon-data/ tests/formats/`

#### Agent 6: `rename-gameType`

**Scope:** `packages/battle-engine/` — rename `format` field/param to `gameType` where it's typed `GameType`
**Tasks:**

1. Read `packages/battle-engine/src/types.ts` — find `BattleState` interface, rename `format: GameType` to `gameType: GameType`
2. Read `packages/battle-engine/src/battle-manager.service.ts` — rename `format` parameter in `createInitialState` to `gameType`, update all internal usages
3. Search all files in `packages/battle-engine/` for `.format` usage that refers to BattleState.format (NOT ShowdownReplayJSON.format or format strings). Rename to `.gameType`
4. Search `apps/web/src/` and other packages for `BattleState` usage — update `.format` → `.gameType`
5. Run `pnpm test -- tests/battle-engine/`

### Wave 2 — 2 Agents (After Wave 1)

Run `pnpm test` first to verify Wave 1 left tests green.

#### Agent 7: `rename-core-service-files`

**Scope:** 4 files in `packages/core/src/`
**Tasks:**

1. Rename files (using `git mv`):
   - `packages/core/src/validation.ts` → `packages/core/src/validation.service.ts`
   - `packages/core/src/stat-calc.ts` → `packages/core/src/stat-calc.service.ts`
   - `packages/core/src/showdown-paste.ts` → `packages/core/src/showdown-paste.service.ts`
   - `packages/core/src/type-chart.ts` → `packages/core/src/type-chart.service.ts`
2. Read `packages/core/src/index.ts` — update barrel imports:
   - `export * from "./type-chart"` → `export * from "./type-chart.service"`
   - `export * from "./stat-calc"` → `export * from "./stat-calc.service"`
   - `export * from "./showdown-paste"` → `export * from "./showdown-paste.service"`
   - `export * from "./validation"` → `export * from "./validation.service"`
3. Search for any internal imports within `packages/core/src/` that reference old filenames (e.g., `from "./stat-calc"`) and update them
4. Search test files for `#core/stat-calc`, `#core/validation`, `#core/showdown-paste`, `#core/type-chart` aliases and update to add `.service` suffix
5. Run `pnpm test -- tests/core/`

#### Agent 8: `rename-noncore-service-files`

**Scope:** 5 files across llm, mcp-server, recommendations
**Tasks:**

1. Rename files (using `git mv`):
   - `packages/llm/src/cli-chat.ts` → `packages/llm/src/cli-chat.service.ts`
   - `packages/mcp-server/src/api-client.ts` → `packages/mcp-server/src/api-client.service.ts`
   - `packages/recommendations/src/coverage-recommender.ts` → `packages/recommendations/src/coverage-recommender.service.ts`
   - `packages/recommendations/src/usage-recommender.ts` → `packages/recommendations/src/usage-recommender.service.ts`
   - `packages/recommendations/src/composite-recommender.ts` → `packages/recommendations/src/composite-recommender.service.ts`
2. Update barrel exports in each package's `src/index.ts`
3. Search for internal imports within each package and update
4. Search test files for `#llm/cli-chat`, `#mcp-server/api-client`, `#recommendations/coverage-recommender` etc. aliases and update
5. Run `pnpm test -- tests/llm/ tests/mcp-server/ tests/recommendations/`

### Wave 3 — 4 Agents (After Wave 2)

Run `pnpm test` first to verify Wave 2 left tests green.

#### Agent 9: `extract-useTeamSlotForm`

**Scope:** `apps/web/src/features/team-builder/`
**Tasks:**

1. Read `apps/web/src/features/team-builder/components/slot-editor.tsx` fully
2. Read `apps/web/src/features/team-builder/components/guided/simplified-set-editor.tsx` fully
3. Identify all shared form state: pokemonId, nickname, ability, item, nature, teraType, moves, evs, ivs, and their handlers (handleEvChange, handleIvChange, handleMoveChange, etc.)
4. Create `apps/web/src/features/team-builder/hooks/use-team-slot-form.ts` containing:
   - `useTeamSlotForm(slot: TeamSlotData, formatId?: string)` hook
   - Returns: form state values + change handlers + computed values (evTotal, evRemaining)
   - Includes EV clamping logic (MAX_SINGLE_EV, MAX_TOTAL_EVS validation)
   - Includes useEffect for syncing prop → state on slot change
5. Update `slot-editor.tsx` to use the new hook, removing duplicated state/handlers
6. Update `simplified-set-editor.tsx` to use the new hook
7. Run `pnpm test` (full suite — frontend changes can have wide impact)

#### Agent 10: `create-SkeletonGrid`

**Scope:** `apps/web/src/components/`, loading pages
**Tasks:**

1. Read all 5 loading.tsx files to understand the patterns
2. Create `apps/web/src/components/skeleton-grid.tsx` with:
   ```typescript
   interface SkeletonGridProps {
     count: number
     columns?: string // Tailwind grid classes
     children?: (index: number) => React.ReactNode
   }
   export function SkeletonGrid({ count, columns, children }: SkeletonGridProps)
   ```

   - Default children renders a basic skeleton card with rounded rectangle + lines
3. Update each loading.tsx to use `<SkeletonGrid>`, passing custom column config and optional children for card content variations
4. Run `pnpm test`

#### Agent 11: `extract-usePokemonSearch`

**Scope:** `apps/web/src/features/team-builder/`, `apps/web/src/features/damage-calc/`
**Tasks:**

1. Read `apps/web/src/features/team-builder/components/pokemon-search-panel.tsx`
2. Read `apps/web/src/features/damage-calc/components/opponent-selector.tsx`
3. Create `apps/web/src/hooks/use-pokemon-search.ts` containing:
   ```typescript
   export function usePokemonSearch(formatId?: string) {
     // Returns a search callback that fetches from /api/pokemon
   }
   ```
4. Update both components to use the shared hook
5. Run `pnpm test`

#### Agent 12: `extract-usePopularityGroups`

**Scope:** `apps/web/src/features/team-builder/components/`
**Tasks:**

1. Read `apps/web/src/features/team-builder/components/item-combobox.tsx`
2. Read `apps/web/src/features/team-builder/components/shared/nature-selector.tsx`
3. Create `apps/web/src/hooks/use-popularity-groups.ts` containing:
   ```typescript
   export function usePopularityGroups<T>(
     items: T[],
     popularItems: Array<{ name: string; usagePercent: number }> | undefined,
     getKey: (item: T) => string,
   ): { common: T[]; other: T[] }
   ```
4. Update item-combobox.tsx and nature-selector.tsx to use the shared hook
5. Run `pnpm test`

### Post-Execution

After all 3 waves complete, run these verification checks:

```bash
# Full test suite
pnpm test

# Full build
pnpm build

# Verify no remaining private getTotalEvs
grep -r "function getTotalEvs" packages/ui/ packages/mcp-server/

# Verify no remaining sumStats duplicate
grep -r "function sumStats" packages/mcp-server/

# Verify no remaining inline parseIntQueryParam pattern
grep -r "Math.min.*Math.max.*parseInt" apps/web/src/app/api/

# Verify no direct Prisma in server actions or flagged routes
grep -r "from.*@nasty-plot/db" apps/web/src/app/pokemon/ apps/web/src/app/api/data/status/

# Verify ensureFormatExists imports use barrel
grep -r "formats/db" packages/

# Verify no old filenames in imports
grep -r "from.*stat-calc\"" packages/core/
grep -r "from.*validation\"" packages/core/
grep -r "#core/stat-calc\"" tests/
grep -r "#core/validation\"" tests/

# Verify format → gameType rename complete
grep -r "\.format\b" packages/battle-engine/src/ | grep -i gametype
```
