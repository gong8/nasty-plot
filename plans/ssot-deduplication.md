# SSOT Deduplication Plan (v2)

**Audit date:** 2026-02-13
**Status:** 22 violations across 50+ files
**Test baseline:** 80 files, 1887 tests passing

---

## Decisions (Pre-Approved)

1. **UI components** → Extract to `@nasty-plot/ui` (shared package)
2. **@smogon/calc in battle-engine** → Migrate to `@nasty-plot/damage-calc` wrapper
3. **speciesId → pokemonId** → Standardize everywhere for consistency
4. **Scope** → Full sweep (all 22 violations)
5. **Test constants** → Leave tests as-is; hardcoded values acceptable in test fixtures
6. **File naming** → Rename 7 files to `.service.ts` convention
7. **Backward compat** → No re-exports; update all consumers immediately
8. **Dead code** → Delete immediately (no deprecated shims)

---

## Violations

### 1. Utilities (4 violations)

#### U1. Identical file: usage-recommender.ts / usage-recommender.service.ts — CRITICAL

- **Locations:** `packages/recommendations/src/usage-recommender.ts`, `packages/recommendations/src/usage-recommender.service.ts`
- **Fix:** Delete `usage-recommender.service.ts`. The `.ts` variant is the one imported by `index.ts`.

#### U2. Move deduplication in 3 places — HIGH

- **Locations:** `packages/core/src/showdown-paste.ts:59` (private `deduplicateMoves`), `packages/teams/src/team.service.ts:83` (private `validateNoDuplicateMoves`), `packages/smogon-data/src/set-inference.service.ts:~108` (inline via `usedNorms` Set)
- **Fix:** Export `deduplicateMoves` from core. Have teams import and use it for validation.

#### U3. Stat formatting in 3 places — HIGH

- **Locations:** `packages/battle-engine/src/team-packer.ts:39` (private `formatEvs`/`formatIvs`), `packages/core/src/showdown-paste.ts:176` (private `formatStatSpread`), `packages/llm/src/context-builder.ts:4` (private `formatBaseStats`)
- **Fix:** These serve different formats (packed, showdown paste, display). Acceptable separation. **DOWNGRADED — no action needed.**

#### U4. teamToShowdownPaste deprecated wrapper — HIGH

- **Location:** `packages/battle-engine/src/team-packer.ts:16`
- **Fix:** Remove function. Update any callers to use `serializeShowdownPaste` from `@nasty-plot/core`.

### 2. Services (5 violations)

#### S1. toId/toID/toSpeciesId private copies — HIGH

- **Locations:** `packages/core/src/showdown-paste.ts:189` (canonical `toId`), `packages/pokemon-data/src/dex.service.ts` (private `toID`), `packages/battle-engine/src/protocol-parser.ts` (private `toSpeciesId`), `packages/battle-engine/src/replay/replay-import.ts` (private `toSpeciesId`)
- **Fix:** Delete private copies, import `toId` from `@nasty-plot/core`.

#### S2. resolveSpeciesName duplicate in team-packer — HIGH

- **Locations:** `packages/pokemon-data/src/dex.service.ts:275` (canonical), `packages/battle-engine/src/team-packer.ts:29` (private copy)
- **Fix:** Delete private copy, import from `@nasty-plot/pokemon-data`.

#### S3. prisma.team.findUnique bypasses getTeam() service — HIGH

- **Locations:** `packages/analysis/src/analysis.service.ts:30`, `packages/recommendations/src/composite-recommender.ts:35`
- **Fix:** Replace direct Prisma query with `getTeam()` from `@nasty-plot/teams`.

#### S4. getBaseStatTotal duplicated in frontend — MEDIUM

- **Locations:** `apps/web/src/app/api/pokemon/route.ts:8`, `apps/web/src/app/pokemon/page.tsx:27`
- **Fix:** Add `getBaseStatTotal()` to `packages/core/src/stat-calc.ts`, import in both files.

#### S5. dbTeamToDomain not exported from teams barrel — MEDIUM

- **Location:** `packages/teams/src/team.service.ts:157` (exists but not in barrel)
- **Fix:** Add to `packages/teams/src/index.ts` exports.

### 3. Constants (3 violations)

#### C1. Missing DEFAULT_ABILITY and DEFAULT_ITEM — MEDIUM

- **Occurrences:** 36 combined (`item: ""` in 23 places, `ability: ""` in 13 places)
- **Fix:** Add `DEFAULT_ABILITY = ""` and `DEFAULT_ITEM = ""` to `packages/core/src/constants.ts`. Replace in non-test production code.

#### C2. Missing DEFAULT_NATURE — MEDIUM

- **Occurrences:** 7 places hardcoding `"Adamant"`
- **Fix:** Add `DEFAULT_NATURE = "Adamant"` to `packages/core/src/constants.ts`. Replace in non-test production code.

#### C3. API base URL duplicated — MEDIUM

- **Locations:** `packages/core/src/api-client.ts:32` (`localhost:3000`), `packages/mcp-server/src/api-client.ts:3` (`localhost:3000/api`)
- **Fix:** Add `DEFAULT_API_URL = "http://localhost:3000"` to core constants. Both api-clients reference it.

### 4. Types (1 violation)

#### T1. TeamMatchResult name collision — MEDIUM

- **Locations:** `packages/teams/src/team-matcher.service.ts:21` (exported), `apps/web/src/app/api/battles/import/route.ts:13` (local)
- **Fix:** Rename API route type to `TeamImportResult`.

### 5. Package Boundaries (1 violation)

#### P1. Direct @smogon/calc in battle-engine AI — MEDIUM

- **Location:** `packages/battle-engine/src/ai/shared.ts:2` (imports `calculate`, `Pokemon`, `Move`, `Field`)
- **Fix:** Add `calculateQuickDamage()` wrapper to `@nasty-plot/damage-calc`. Update AI to use it.

### 6. Frontend Components (5 violations)

#### F1. Ability Selector duplicated (~106 lines) — CRITICAL

- **Locations:** `apps/web/src/features/team-builder/components/slot-editor.tsx:247`, `apps/web/src/features/team-builder/components/guided/simplified-set-editor.tsx:156`
- **Fix:** Extract `AbilitySelector` to `packages/ui/src/components/AbilitySelector.tsx`.

#### F2. EV/IV Editors duplicated (~205 lines) — HIGH

- **Locations:** `apps/web/src/features/team-builder/components/slot-editor.tsx:379`, `apps/web/src/features/team-builder/components/guided/simplified-set-editor.tsx:260`, `apps/web/src/features/damage-calc/components/damage-calculator.tsx:395`
- **Fix:** Extract `EvEditor`, `IvEditor`, `CalculatedStatsDisplay` to `packages/ui/src/components/`.

#### F3. Usage % formatting inconsistent — MEDIUM

- **Locations:** 5+ files using `.toFixed(0)` vs `.toFixed(1)` inline
- **Fix:** Add `formatUsagePercent(percent, decimals?)` to `packages/core/src/utils.ts`. Replace inline formatting.

#### F4. Pokemon list items duplicated (~50 lines) — MEDIUM

- **Locations:** `apps/web/src/features/battle/components/TeamPreview.tsx:59`, `apps/web/src/features/battle/components/PokeballIndicator.tsx:15`
- **Fix:** Extract shared rendering pattern.

#### F5. Nature/Tera selectors not reused in damage-calc — LOW

- **Locations:** `apps/web/src/features/team-builder/components/shared/nature-selector.tsx`, `apps/web/src/features/damage-calc/components/damage-calculator.tsx:331`
- **Fix:** Import shared selectors from `team-builder/shared/` in damage-calc.

### 7. Naming (3 violations)

#### N1. speciesId vs pokemonId — MEDIUM

- **Locations:** `packages/battle-engine/src/types.ts:61` (`BattlePokemon.speciesId`), `packages/pokemon-data/src/dex.service.ts` (parameter names), 30+ consumer files
- **Fix:** Rename all `speciesId` → `pokemonId` throughout codebase.

#### N2. ShowdownReplayJson deprecated alias — LOW

- **Location:** `packages/battle-engine/src/replay/replay-import.ts:20`
- **Fix:** Remove deprecated alias. Update any consumers to use `ShowdownReplayJSON`.

#### N3. 7 files not following .service.ts convention — MEDIUM

- **Files:**
  1. `packages/llm/src/mcp-client.ts` → `mcp-client.service.ts`
  2. `packages/llm/src/openai-client.ts` → `openai-client.service.ts`
  3. `packages/llm/src/context-builder.ts` → `context-builder.service.ts`
  4. `packages/llm/src/battle-context-builder.ts` → `battle-context-builder.service.ts`
  5. `packages/battle-engine/src/battle-manager.ts` → `battle-manager.service.ts`
  6. `packages/core/src/api-client.ts` → `api-client.service.ts`
  7. `packages/formats/src/resolver.ts` → `format-resolver.service.ts`
- **Fix:** Rename files, update barrel exports and within-package imports.

---

## Execution Plan — Parallel Agent Architecture

### Dependency Graph

```
Wave 1: Create canonical sources (no deps)
  ├── Agent 1: Core enhancements (constants, utils, stat-calc)
  ├── Agent 2: Dead code cleanup (delete files, remove deprecated)
  ├── Agent 3: Damage calc AI wrapper
  └── Agent 4: Teams barrel export fix
       │
Wave 2: Backend consumer updates (depends on Wave 1)
  ├── Agent 1: Service bypass fixes (prisma → service, getBaseStatTotal)
  ├── Agent 2: ID normalization (toId, resolveSpeciesName)
  ├── Agent 3: Constants consumers (DEFAULT_*, API URL)
  ├── Agent 4: Package boundary fix (@smogon/calc → wrapper)
  └── Agent 5: Type & formatting fixes (TeamMatchResult, formatUsagePercent)
       │
Wave 3: speciesId → pokemonId rename (depends on Wave 2)
  └── Agent 1: Comprehensive speciesId rename
       │
Wave 4: Structure & UI foundation (depends on Wave 3)
  ├── Agent 1: File renames to .service.ts
  └── Agent 2: Create UI components (AbilitySelector, EvEditor, IvEditor, CalculatedStatsDisplay)
       │
Wave 5: Frontend refactoring (depends on Wave 4)
  ├── Agent 1: Refactor team-builder components
  ├── Agent 2: Refactor damage-calc components
  └── Agent 3: Frontend polish (usage %, list items, Nature/Tera reuse)
```

### Wave 1 — 4 Agents (No Dependencies)

#### Agent 1: `core-enhancements`

**Scope:** `packages/core/` only
**Tasks:**

1. Read `packages/core/src/constants.ts`
2. Add constants: `DEFAULT_ABILITY = ""`, `DEFAULT_ITEM = ""`, `DEFAULT_NATURE = "Adamant"`, `DEFAULT_API_URL = "http://localhost:3000"`
3. Read `packages/core/src/stat-calc.ts`
4. Add `getBaseStatTotal(stats: StatsTable): number` — sums all 6 stats
5. Read `packages/core/src/utils.ts`
6. Add `formatUsagePercent(percent: number, decimals = 1): string` — returns `${percent.toFixed(decimals)}%`
7. Read `packages/core/src/showdown-paste.ts`
8. Make `deduplicateMoves` function public (add `export` keyword)
9. Ensure all new exports flow through barrel (`src/index.ts` uses `export *`)
10. Run `pnpm test -- tests/core/`

#### Agent 2: `dead-code-cleanup`

**Scope:** `packages/recommendations/`, `packages/battle-engine/`
**Tasks:**

1. DELETE file `packages/recommendations/src/usage-recommender.service.ts`
2. Verify `packages/recommendations/src/index.ts` imports from `usage-recommender.ts` (not `.service.ts`)
3. Read `packages/battle-engine/src/replay/replay-import.ts`
4. Remove the deprecated `ShowdownReplayJson` type alias export
5. Grep for any imports of `ShowdownReplayJson` — update to `ShowdownReplayJSON`
6. Read `packages/battle-engine/src/team-packer.ts`
7. Remove the deprecated `teamToShowdownPaste` function
8. Grep for any callers of `teamToShowdownPaste` — update to use `serializeShowdownPaste` from `@nasty-plot/core`
9. Read `packages/battle-engine/src/index.ts` — remove exports of deleted items
10. Run `pnpm test -- tests/battle-engine/ tests/recommendations/`

#### Agent 3: `damage-calc-wrapper`

**Scope:** `packages/damage-calc/` only
**Tasks:**

1. Read `packages/damage-calc/src/calc.service.ts` to understand existing API
2. Read `packages/battle-engine/src/ai/shared.ts` to understand what the AI needs
3. Add a new function `calculateQuickDamage(attackerName: string, defenderName: string, moveName: string, options?: { attackerLevel?: number, defenderLevel?: number }): { minPercent: number, maxPercent: number }` that wraps @smogon/calc for simple AI damage lookups
4. Export from barrel
5. Run `pnpm test -- tests/damage-calc/`

#### Agent 4: `teams-barrel-fix`

**Scope:** `packages/teams/` only
**Tasks:**

1. Read `packages/teams/src/index.ts`
2. Read `packages/teams/src/team.service.ts` to find `dbTeamToDomain`
3. Add `dbTeamToDomain` to the barrel exports in `packages/teams/src/index.ts`
4. Run `pnpm test -- tests/teams/`

### Wave 2 — 5 Agents (After Wave 1)

#### Agent 1: `service-bypass-fixes`

**Scope:** `packages/analysis/`, `packages/recommendations/`, `apps/web/src/app/api/pokemon/`, `apps/web/src/app/pokemon/`
**Tasks:**

1. Read `packages/analysis/src/analysis.service.ts`
2. Replace `prisma.team.findUnique({ where: { id: teamId }, include: { slots: true } })` with `import { getTeam } from "@nasty-plot/teams"` and `const team = await getTeam(teamId)`. Adapt surrounding code to work with `TeamData` return type.
3. Read `packages/recommendations/src/composite-recommender.ts`
4. Same replacement: `prisma.team.findUnique` → `getTeam()` from `@nasty-plot/teams`
5. Read `apps/web/src/app/api/pokemon/route.ts`
6. Replace inline `getBaseStatTotal` with import from `@nasty-plot/core`
7. Read `apps/web/src/app/pokemon/page.tsx`
8. Replace inline `getBaseStatTotal` with import from `@nasty-plot/core`
9. Run `pnpm test -- tests/analysis/ tests/recommendations/`

#### Agent 2: `id-normalization`

**Scope:** `packages/pokemon-data/`, `packages/battle-engine/src/protocol-parser.ts`, `packages/battle-engine/src/replay/`, `packages/battle-engine/src/team-packer.ts`
**Tasks:**

1. Read `packages/pokemon-data/src/dex.service.ts`
2. Remove private `toID` function, add `import { toId } from "@nasty-plot/core"`, replace all `toID(...)` calls with `toId(...)`
3. Read `packages/battle-engine/src/protocol-parser.ts`
4. Remove private `toSpeciesId` function, add `import { toId } from "@nasty-plot/core"`, replace all `toSpeciesId(...)` calls with `toId(...)`
5. Read `packages/battle-engine/src/replay/replay-import.ts`
6. Remove private `toSpeciesId` function, add `import { toId } from "@nasty-plot/core"`, replace all `toSpeciesId(...)` calls with `toId(...)`
7. Read `packages/battle-engine/src/team-packer.ts`
8. Remove private `resolveSpeciesName` function, add `import { resolveSpeciesName } from "@nasty-plot/pokemon-data"`, replace calls
9. Run `pnpm test -- tests/battle-engine/ tests/pokemon-data/`

#### Agent 3: `constants-consumers`

**Scope:** `apps/web/src/features/`, `packages/mcp-server/src/api-client.ts`, `packages/core/src/api-client.ts`
**Tasks:**

1. Search non-test production code for `item: ""` and `ability: ""` patterns
2. Replace with `DEFAULT_ITEM` and `DEFAULT_ABILITY` from `@nasty-plot/core` where appropriate (skip test files)
3. Search for hardcoded `"Adamant"` as default nature in production code
4. Replace with `DEFAULT_NATURE` from `@nasty-plot/core` (focus on: `apps/web/src/features/team-builder/hooks/use-guided-builder.ts`, `apps/web/src/features/team-builder/context/guided-builder-provider.tsx`)
5. Read `packages/core/src/api-client.ts` — replace hardcoded `"http://localhost:3000"` with `DEFAULT_API_URL` from core constants
6. Read `packages/mcp-server/src/api-client.ts` — replace hardcoded `"http://localhost:3000/api"` with `${DEFAULT_API_URL}/api` using `DEFAULT_API_URL` from core constants
7. Run `pnpm test`

#### Agent 4: `package-boundary-fix`

**Scope:** `packages/battle-engine/src/ai/shared.ts` only
**Tasks:**

1. Read `packages/battle-engine/src/ai/shared.ts`
2. Read the new `calculateQuickDamage` function from `packages/damage-calc/src/calc.service.ts` (created in Wave 1)
3. Replace the direct `@smogon/calc` import and manual `Pokemon`/`Move`/`Field` construction with a call to `calculateQuickDamage` from `@nasty-plot/damage-calc`
4. Remove the `@smogon/calc` import
5. Verify the function signature matches what the AI code needs
6. Run `pnpm test -- tests/battle-engine/`

#### Agent 5: `type-and-format-fixes`

**Scope:** `apps/web/src/app/api/battles/import/`, misc frontend files
**Tasks:**

1. Read `apps/web/src/app/api/battles/import/route.ts`
2. Rename local `TeamMatchResult` type to `TeamImportResult`
3. Update all references within the file
4. Search for inline `toFixed(0)` and `toFixed(1)` usage percentage patterns in `apps/web/src/features/`
5. Replace with `formatUsagePercent()` from `@nasty-plot/core` (imported via `@nasty-plot/core`)
6. Run `pnpm test`

### Wave 3 — 1 Agent (After Wave 2)

#### Agent 1: `speciesid-to-pokemonid`

**Scope:** Entire codebase (excluding tests unless they reference the type field directly)
**Tasks:**

1. Grep the entire codebase for `speciesId` (case-sensitive) to find ALL occurrences
2. Read `packages/battle-engine/src/types.ts` — rename `speciesId` field to `pokemonId` in `BattlePokemon` interface and any related types
3. For EVERY file that references `.speciesId` or destructures `speciesId`:
   - Read the file
   - Replace `speciesId` with `pokemonId` (both property access and destructuring)
4. Check `packages/pokemon-data/src/dex.service.ts` for `speciesId` parameter names — rename to `pokemonId`
5. Update all test files that reference `speciesId` on BattlePokemon objects
6. Run `pnpm test` (full suite — this is a cross-cutting rename)

### Wave 4 — 2 Agents (After Wave 3)

#### Agent 1: `file-renames`

**Scope:** `packages/llm/`, `packages/battle-engine/`, `packages/core/`, `packages/formats/`
**Tasks:**

1. For each rename below: read the file, create a new file with the `.service.ts` name and same content, delete the old file, update the barrel export in `src/index.ts`, update any within-package imports:
   - `packages/llm/src/mcp-client.ts` → `packages/llm/src/mcp-client.service.ts`
   - `packages/llm/src/openai-client.ts` → `packages/llm/src/openai-client.service.ts`
   - `packages/llm/src/context-builder.ts` → `packages/llm/src/context-builder.service.ts`
   - `packages/llm/src/battle-context-builder.ts` → `packages/llm/src/battle-context-builder.service.ts`
   - `packages/battle-engine/src/battle-manager.ts` → `packages/battle-engine/src/battle-manager.service.ts`
   - `packages/core/src/api-client.ts` → `packages/core/src/api-client.service.ts`
   - `packages/formats/src/resolver.ts` → `packages/formats/src/format-resolver.service.ts`
2. For each package, grep for internal imports of the old filename and update them
3. Run `pnpm test` (full suite)

#### Agent 2: `ui-component-creation`

**Scope:** `packages/ui/` only (CREATE components, do NOT refactor consumers)
**Tasks:**

1. Read `apps/web/src/features/team-builder/components/slot-editor.tsx` (lines 247-298 for ability selector, lines 379-452 for EV/IV editors)
2. Read `apps/web/src/features/team-builder/components/guided/simplified-set-editor.tsx` (lines 156-211 for ability selector, lines 260-351 for EV/IV editors)
3. Read existing `packages/ui/src/` to understand component patterns, styling, and exports
4. Create `packages/ui/src/components/AbilitySelector.tsx`:
   - Props: `value: string`, `onValueChange: (ability: string) => void`, `abilities: string[]`, `popularity?: { name: string; usagePercent: number }[]`, `placeholder?: string`
   - Renders Select with "Common" / "Other" groups based on usage percentages
   - Handles case where no popularity data exists
5. Create `packages/ui/src/components/EvEditor.tsx`:
   - Props: `evs: StatsTable`, `onChange: (stat: StatName, value: number) => void`, `showRemaining?: boolean`
   - Renders 6 stat sliders with labels, colors, 0-252 range, step=4
   - Shows remaining EVs count
6. Create `packages/ui/src/components/IvEditor.tsx`:
   - Props: `ivs: StatsTable`, `onChange: (stat: StatName, value: number) => void`
   - Renders 6 stat inputs, 0-31 range
7. Create `packages/ui/src/components/CalculatedStatsDisplay.tsx`:
   - Props: `stats: StatsTable`
   - Renders 3-column grid of calculated stats
8. Export all new components from `packages/ui/src/index.ts`
9. Run `pnpm test -- tests/ui/`

### Wave 5 — 3 Agents (After Wave 4)

#### Agent 1: `refactor-team-builder`

**Scope:** `apps/web/src/features/team-builder/` only
**Tasks:**

1. Read `apps/web/src/features/team-builder/components/slot-editor.tsx`
2. Replace inline ability selector code (lines ~247-298) with `<AbilitySelector>` from `@nasty-plot/ui`
3. Replace inline EV editor code (lines ~380-409) with `<EvEditor>` from `@nasty-plot/ui`
4. Replace inline IV editor code (lines ~414-433) with `<IvEditor>` from `@nasty-plot/ui`
5. Replace inline calculated stats display (lines ~438-452) with `<CalculatedStatsDisplay>` from `@nasty-plot/ui`
6. Read `apps/web/src/features/team-builder/components/guided/simplified-set-editor.tsx`
7. Same replacements: ability selector, EV editor, IV editor
8. Remove now-unused local state/memo logic that was only needed for the inline implementations
9. Run `pnpm test`

#### Agent 2: `refactor-damage-calc`

**Scope:** `apps/web/src/features/damage-calc/` only
**Tasks:**

1. Read `apps/web/src/features/damage-calc/components/damage-calculator.tsx`
2. Replace inline EV editor section (lines ~395-436) with `<EvEditor>` from `@nasty-plot/ui`
3. Check if Nature selector can import from `apps/web/src/features/team-builder/components/shared/nature-selector.tsx`
4. Check if Tera Type picker can import from `apps/web/src/features/team-builder/components/shared/tera-type-picker.tsx`
5. If yes, replace inline selectors with shared imports
6. Run `pnpm test`

#### Agent 3: `frontend-polish`

**Scope:** `apps/web/src/features/battle/`, misc frontend files
**Tasks:**

1. Search `apps/web/src/features/` for remaining `.toFixed(0)` and `.toFixed(1)` percentage patterns
2. Replace any remaining inline percentage formatting with `formatUsagePercent()` from `@nasty-plot/core`
3. Read `apps/web/src/features/battle/components/TeamPreview.tsx` and `PokeballIndicator.tsx`
4. Identify the duplicated Pokemon list item rendering pattern
5. Extract shared logic or simplify to reduce duplication
6. Run `pnpm test`

### Post-Execution Verification

```bash
# Full test suite
pnpm test

# Full build
pnpm build

# Verify no remaining deprecated items
grep -rn "ShowdownReplayJson\b" packages/ --include="*.ts" | grep -v node_modules
grep -rn "teamToShowdownPaste" packages/ --include="*.ts" | grep -v node_modules
grep -rn "usage-recommender.service" packages/ --include="*.ts" | grep -v node_modules

# Verify no remaining private toId copies
grep -rn "function toID\b" packages/ --include="*.ts" | grep -v node_modules | grep -v "core/"
grep -rn "function toSpeciesId\b" packages/ --include="*.ts" | grep -v node_modules

# Verify no remaining speciesId
grep -rn "speciesId" packages/ apps/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".test."

# Verify no direct @smogon/calc in battle-engine AI
grep -rn "from \"@smogon/calc\"" packages/battle-engine/ --include="*.ts" | grep -v node_modules

# Verify no remaining prisma.team bypasses
grep -rn "prisma\.team\.findUnique" packages/analysis/ packages/recommendations/ --include="*.ts"

# Verify file renames complete
ls packages/llm/src/mcp-client.service.ts
ls packages/llm/src/openai-client.service.ts
ls packages/battle-engine/src/battle-manager.service.ts
ls packages/core/src/api-client.service.ts
ls packages/formats/src/format-resolver.service.ts
```
