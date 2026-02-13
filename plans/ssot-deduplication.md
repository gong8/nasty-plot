# SSOT Deduplication Plan (v3)

**Audit date:** 2026-02-13
**Status:** 24 violations across 50+ files
**Test baseline:** All tests passing (green)

---

## Violations

### 1. Types (3 violations)

#### T1. MoveSelectorProps name conflict — HIGH

- **Locations:** `packages/ui/src/move-selector.tsx:26`, `apps/web/src/features/battle/components/MoveSelector.tsx:70`
- **Fix:** Rename web battle version to `BattleMoveSelectorProps`

#### T2. CliArgs duplicate names in data-pipeline — MEDIUM

- **Locations:** `packages/data-pipeline/src/cli/seed.ts:13`, `packages/data-pipeline/src/cli/verify.ts:32`
- **Fix:** Rename to `SeedCliArgs` and `VerifyCliArgs`

#### T3. ValidationError identical interface in two packages — MEDIUM

- **Locations:** `packages/core/src/validation.ts:5` (local), `packages/teams/src/validation.service.ts:12` (local)
- **Fix:** Export from `@nasty-plot/core`, import in teams

### 2. Constants (3 violations)

#### C1. "Hardy" nature string literal repeated — HIGH

- **Locations:** `core/showdown-paste.ts:87`, `damage-calc/calc.service.ts:76,201,206`, `battle-engine/team-packer.ts:43`, `apps/web/src/features/damage-calc/components/damage-calculator.tsx:66`, `apps/web/src/features/team-builder/components/guided/simplified-set-editor.tsx:71`, `apps/web/src/features/team-builder/components/slot-editor.tsx:69,84`
- **Fix:** Add `DEFAULT_NATURE = "Hardy"` to `core/constants.ts`, use everywhere

#### C2. MAX_SCORE = 100 defined 3x in recommendations — MEDIUM

- **Locations:** `recommendations/src/usage-recommender.ts:6`, `recommendations/src/composite-recommender.ts:6`, `recommendations/src/coverage-recommender.ts:15`
- **Fix:** Extract to `recommendations/src/constants.ts`

#### C3. MCP port 3001 hardcoded — LOW

- **Locations:** `mcp-server/src/index.ts:91`, `llm/src/config.ts:1`
- **Fix:** Share via env constant

### 3. Utilities (3 violations)

#### U1. capitalize() duplicated — MEDIUM

- **Locations:** `apps/web/src/app/battle/page.tsx:46`, `apps/web/src/features/team-builder/components/guided/role-suggestion-banner.tsx:13`
- **Fix:** Add to `core/utils.ts`, import in both files

#### U2. pickHealthiestSwitch inlined vs exported — HIGH

- **Locations:** `battle-engine/src/ai/heuristic-ai.ts:380` (inline), `battle-engine/src/ai/shared.ts:52` (exported)
- **Fix:** Use existing `pickHealthiestSwitch` from `shared.ts` in heuristic-ai.ts

#### U3. normalizeMoveName inlined — MEDIUM

- **Locations:** `battle-engine/src/ai/mcts-ai.ts:448` (inline), `core/src/utils.ts:1` (exported)
- **Fix:** Import from `@nasty-plot/core` in mcts-ai.ts

### 4. Services (4 violations)

#### S1. Species enrichment pattern duplicated — MEDIUM

- **Locations:** `apps/web/src/app/api/formats/[formatId]/usage/route.ts:22-30`, `apps/web/src/app/api/formats/[formatId]/cores/route.ts:18-28`
- **Fix:** Extract `enrichWithSpeciesData()` to `pokemon-data/src/dex.service.ts`

#### S2. upsertSyncLog identical Prisma pattern — MEDIUM

- **Locations:** `smogon-data/src/usage-stats.service.ts:87-99`, `smogon-data/src/smogon-sets.service.ts:36-48`
- **Fix:** Extract to shared function in smogon-data package

#### S3. Direct fetch() bypasses API client — LOW

- **Locations:** `battle-engine/src/ai/set-predictor.ts:17`
- **Fix:** Use `@nasty-plot/core` API client (`checkedFetch`)

#### S4. Smogon fetch error patterns duplicated — LOW

- **Locations:** `smogon-data/src/usage-stats.service.ts:201`, `smogon-data/src/smogon-sets.service.ts:63,129`
- **Fix:** Extract `fetchSmogonData()` helper in smogon-data

### 5. Frontend (7 violations)

#### F1. Dialog async loading pattern — HIGH

- **Locations:** `BattleExportDialog.tsx:24-56`, `new-chat-modal.tsx:56-80`, `merge-wizard.tsx:45-54`
- **Fix:** Extract `useDialogAsyncData` hook

#### F2. Loading/Empty/Data state branching — HIGH

- **Locations:** `battle/sample-teams/page.tsx:44-77`, `battle/page.tsx:315-345`, `pokemon/page.tsx:164-219`, `teams/[teamId]/battles/page.tsx:22-43`
- **Fix:** Extract `DataStateRenderer` component

#### F3. useEffect + fetchJson cancel pattern — MEDIUM

- **Locations:** `battle/page.tsx:176-197`, `battle/simulate/page.tsx:78-100`, `battle/sample-teams/page.tsx:52-77`, `pokemon/page.tsx:62-65`
- **Fix:** Extract `useFetchData` hook

#### F4. Pokemon card layouts — MEDIUM

- **Locations:** `SampleTeamCard.tsx:18-59`, `QuickBattleCard.tsx:13-44`, `recommendation-card.tsx:33-117`
- **Fix:** Extract shared `PokemonCard` component

#### F5. Pokemon info header inline — MEDIUM

- **Locations:** `slot-editor.tsx:189-210`, `simplified-set-editor.tsx:112-122`
- **Fix:** Extract `PokemonInfoHeader` component

#### F6. React Query used inconsistently — MEDIUM

- **Locations:** `item-combobox.tsx`, `opponent-selector.tsx` use useQuery; pages use manual fetch
- **Fix:** Standardize on custom `useFetchData` hook (per user decision)

#### F7. Pokemon sprite row/grid — LOW

- **Locations:** `SampleTeamCard.tsx:42-47`, `TeamPickerCard.tsx:42-61`, `teams/page.tsx:141-149`
- **Fix:** Extract `PokemonSpriteRow` component

### 6. Imports (1 violation)

#### I1. Unused re-exports from llm — LOW

- **Locations:** `llm/src/index.ts:47-53`
- **Fix:** Remove dead re-exports of ChatMessage, ChatSessionData, ChatRole, ChatMessageMetadata, AutoAnalyzeDepth

### 7. Naming (5 violations)

#### N1. Generic `id` param in service functions — HIGH

- **Locations:** 15+ functions in `team.service.ts`, `sample-team.service.ts`, `chat-session.service.ts`, `battle.service.ts`
- **Fix:** Rename to `teamId`, `sampleTeamId`, `sessionId`, `battleId`, `batchId` respectively + update all callers

#### N2. Sample team parameter mismatch — HIGH

- **Locations:** API routes use `sampleTeamId`, service uses `id`
- **Fix:** Align service to use `sampleTeamId` (included in N1 fix)

#### N3. Non-.service.ts files in battle-engine — MEDIUM

- **Locations:** `protocol-parser.ts`, `team-packer.ts`, `battle-state-serializer.ts`, `evaluator.ts`, `hint-engine.ts`, `win-probability.ts`
- **Fix:** Rename all to `.service.ts` suffix, update all imports

#### N4. MCP tool parameter naming inconsistency — MEDIUM

- **Locations:** `mcp-server/src/tools/analysis.ts:96-98` uses `attackerPokemon`/`defenderPokemon`
- **Fix:** Rename to `attackerPokemonId`/`defenderPokemonId`

#### N5. getAll* vs list* naming split — MEDIUM

- **Locations:** `getAllSpecies`, `getAllMoves`, `getAllItems`, `getAllAbilities` in pokemon-data; `getAllFormats` in formats
- **Fix:** Rename all to `list*` pattern + update all callers

---

## Decisions (Pre-Approved)

1. Use `list*` everywhere for collection-returning functions
2. Rename non-.service.ts files to .service.ts
3. Use custom hooks (useFetchData, useDialogAsyncData) for frontend fetch patterns
4. Aggressive deduplication — fix all 24 violations (HIGH + MEDIUM + LOW)
5. Update all callers immediately — no backward-compatible aliases
6. `capitalize()` goes in `core/utils.ts`
7. Species enrichment helper goes in `pokemon-data` package
8. Keep current type suffix mix (Data/View/Record/Entry/Result) — document convention

---

## Execution Plan — Parallel Agent Architecture

### Dependency Graph

```
Wave 1 (Foundation — create canonical sources)
  ├── Agent 1: Core foundation (constants, utils, validation export)
  ├── Agent 2: Package-level constants (recommendations, smogon-data sync)
  ├── Agent 3: Pokemon-data enrichment helper
  └── Agent 4: Frontend infrastructure (hooks + components)
          │
          ▼
Wave 2 (Consumers — update files to use Wave 1 sources)
  ├── Agent 1: Package constant consumers (Hardy, MAX_SCORE, upsertSyncLog)
  ├── Agent 2: Battle-engine internal fixes (heuristic-ai, mcts-ai, set-predictor)
  ├── Agent 3: API route consumers (enrichment helper, smogon fetch)
  ├── Agent 4: Frontend hook migration (pages using fetch patterns)
  ├── Agent 5: Team-builder + damage-calc frontend (Hardy + PokemonInfoHeader)
  └── Agent 6: Type fixes + remaining frontend (MoveSelectorProps, ValidationError, CliArgs, SpriteRow)
          │
          ▼
Wave 3 (Naming — broad renames across codebase)
  ├── Agent 1: Teams domain (id→teamId/sampleTeamId + all callers)
  ├── Agent 2: Battle-engine domain (id→battleId + file renames to .service.ts)
  ├── Agent 3: LLM domain (id→sessionId + remove unused re-exports)
  ├── Agent 4: Data domain (getAll→list in pokemon-data/formats + all callers)
  └── Agent 5: MCP fixes (analysis.ts param naming)
```

### Wave 1 — 4 Agents (No Dependencies)

#### Agent 1: `core-foundation`

**Scope:** `packages/core/src/constants.ts`, `packages/core/src/utils.ts`, `packages/core/src/validation.ts`, `packages/core/src/index.ts`
**Tasks:**

1. Read `packages/core/src/constants.ts`. Add `export const DEFAULT_NATURE = "Hardy" as const` near the other defaults (DEFAULT_LEVEL, etc.)
2. Read `packages/core/src/utils.ts`. Add `export function capitalize(str: string): string { return str.charAt(0).toUpperCase() + str.slice(1) }`
3. Read `packages/core/src/validation.ts`. Change the local `interface ValidationError` to `export interface ValidationError` so it can be imported by other packages
4. Read `packages/core/src/index.ts`. Ensure `ValidationError` is exported (add to exports from `./validation` if not already). Ensure `capitalize` is exported from `./utils`. Ensure `DEFAULT_NATURE` is accessible via barrel (constants are likely already re-exported)
5. Run: `pnpm test -- tests/core/`

#### Agent 2: `package-constants`

**Scope:** `packages/recommendations/src/constants.ts` (new), `packages/smogon-data/src/sync-log.service.ts` (new), `packages/smogon-data/src/index.ts`, `packages/recommendations/src/index.ts`
**Tasks:**

1. Create `packages/recommendations/src/constants.ts` with: `export const MAX_SCORE = 100`
2. Read `packages/recommendations/src/index.ts`. Add export for the new constants file
3. Read `packages/smogon-data/src/usage-stats.service.ts` lines 87-99 to see the upsertSyncLog pattern
4. Create `packages/smogon-data/src/sync-log.service.ts` with extracted `upsertSyncLog(source: string, formatId: string, message: string)` function
5. Read `packages/smogon-data/src/index.ts`. Add export for `sync-log.service`
6. Run: `pnpm test -- tests/recommendations/ tests/smogon-data/`

#### Agent 3: `pokemon-data-enrichment`

**Scope:** `packages/pokemon-data/src/dex.service.ts`, `packages/pokemon-data/src/index.ts`
**Tasks:**

1. Read `packages/pokemon-data/src/dex.service.ts`
2. Read `apps/web/src/app/api/formats/[formatId]/usage/route.ts` to see the enrichment pattern
3. Read `apps/web/src/app/api/formats/[formatId]/cores/route.ts` to see the other enrichment pattern
4. Add to `dex.service.ts`: `export function enrichWithSpeciesData(pokemonId: string): { pokemonName: string | undefined; types: PokemonType[] | undefined; num: number | undefined }` that calls `getSpecies()` internally
5. Ensure it's exported from `packages/pokemon-data/src/index.ts`
6. Run: `pnpm test -- tests/pokemon-data/`

#### Agent 4: `frontend-infrastructure`

**Scope:** New files only — `apps/web/src/lib/hooks/`, `apps/web/src/components/`
**Tasks:**

1. Create `apps/web/src/lib/hooks/use-fetch-data.ts`:
   ```typescript
   export function useFetchData<T>(
     url: string | null,
     enabled = true,
   ): { data: T | null; loading: boolean; error: string | null }
   ```
   Implements the useEffect + fetchJson + cancelled flag pattern
2. Create `apps/web/src/lib/hooks/use-dialog-async-data.ts`:
   ```typescript
   export function useDialogAsyncData<T>(
     open: boolean,
     fetchFn: () => Promise<T>,
     deps?: any[],
   ): { data: T | null; loading: boolean }
   ```
   Implements the dialog-specific async loading pattern with cancellation
3. Read `apps/web/src/features/team-builder/components/slot-editor.tsx:189-210` to see PokemonInfoHeader pattern
4. Create `apps/web/src/components/pokemon-info-header.tsx`: `PokemonInfoHeader` component (pokemonId, speciesData, spriteSize props)
5. Create `apps/web/src/components/pokemon-sprite-row.tsx`: `PokemonSpriteRow` component (pokemonIds, size props)
6. Create `apps/web/src/components/data-state-renderer.tsx`: `DataStateRenderer` component with loading/empty/data states
7. Verify files compile: read relevant imports to ensure correct paths

### Wave 2 — 6 Agents (After Wave 1)

#### Agent 1: `constant-consumers`

**Scope:** `packages/core/src/showdown-paste.ts`, `packages/damage-calc/src/calc.service.ts`, `packages/battle-engine/src/team-packer.ts`, `packages/recommendations/src/usage-recommender.ts`, `packages/recommendations/src/composite-recommender.ts`, `packages/recommendations/src/coverage-recommender.ts`, `packages/smogon-data/src/usage-stats.service.ts`, `packages/smogon-data/src/smogon-sets.service.ts`
**Tasks:**

1. Read each file, then replace `"Hardy"` string literals with `DEFAULT_NATURE` imported from `@nasty-plot/core` in: `core/showdown-paste.ts`, `damage-calc/calc.service.ts`, `battle-engine/team-packer.ts`
2. In each of the 3 recommender files, replace `const MAX_SCORE = 100` with `import { MAX_SCORE } from "./constants"`
3. In `smogon-data/usage-stats.service.ts`, replace the inline upsertSyncLog code with import from `./sync-log.service`
4. In `smogon-data/smogon-sets.service.ts`, replace the inline upsertSyncLog code with import from `./sync-log.service`
5. Extract `fetchSmogonData()` helper for shared fetch+error pattern in smogon-data (create in smogon-sets.service.ts or a shared file, and use in both services)
6. Run: `pnpm test -- tests/core/ tests/damage-calc/ tests/battle-engine/ tests/recommendations/ tests/smogon-data/`

#### Agent 2: `battle-engine-fixes`

**Scope:** `packages/battle-engine/src/ai/heuristic-ai.ts`, `packages/battle-engine/src/ai/mcts-ai.ts`, `packages/battle-engine/src/ai/set-predictor.ts`
**Tasks:**

1. Read `packages/battle-engine/src/ai/heuristic-ai.ts`. Find the inlined healthiest switch logic (~line 380). Replace with import and call to `pickHealthiestSwitch` from `./shared`
2. Read `packages/battle-engine/src/ai/mcts-ai.ts`. Find the inline `m.toLowerCase().replace(/\s/g, "")` (~line 448). Replace with import of `normalizeMoveName` from `@nasty-plot/core`
3. Read `packages/battle-engine/src/ai/set-predictor.ts`. Replace the direct `fetch()` call with `checkedFetch` from `@nasty-plot/core` or the appropriate API client utility
4. Run: `pnpm test -- tests/battle-engine/`

#### Agent 3: `api-route-consumers`

**Scope:** `apps/web/src/app/api/formats/[formatId]/usage/route.ts`, `apps/web/src/app/api/formats/[formatId]/cores/route.ts`
**Tasks:**

1. Read `apps/web/src/app/api/formats/[formatId]/usage/route.ts`. Replace inline species enrichment with `enrichWithSpeciesData` from `@nasty-plot/pokemon-data`
2. Read `apps/web/src/app/api/formats/[formatId]/cores/route.ts`. Replace inline species enrichment with `enrichWithSpeciesData` from `@nasty-plot/pokemon-data`
3. Run: `pnpm test -- tests/api/`

#### Agent 4: `frontend-hook-migration`

**Scope:** `apps/web/src/app/battle/page.tsx`, `apps/web/src/app/battle/simulate/page.tsx`, `apps/web/src/app/battle/sample-teams/page.tsx`, `apps/web/src/app/pokemon/page.tsx`, `apps/web/src/features/battle/components/BattleExportDialog.tsx`, `apps/web/src/features/chat/components/new-chat-modal.tsx`, `apps/web/src/features/team-builder/components/merge-wizard.tsx`, `apps/web/src/app/teams/[teamId]/battles/page.tsx`
**Tasks:**

1. Read each page file. Identify the useEffect + fetchJson + cancel pattern
2. Replace with `useFetchData` hook from `../../lib/hooks/use-fetch-data` (adjust path for each file)
3. For dialog components (BattleExportDialog, new-chat-modal, merge-wizard), replace the dialog-specific loading pattern with `useDialogAsyncData` hook
4. Where Loading/Empty/Data branching exists, replace with `DataStateRenderer` component
5. Remove the now-unused `capitalize()` function from `battle/page.tsx` (it will be imported from `@nasty-plot/core` instead)
6. Run: `pnpm test` (frontend changes may not have dedicated tests, but verify no build errors)

#### Agent 5: `team-builder-frontend`

**Scope:** `apps/web/src/features/team-builder/components/slot-editor.tsx`, `apps/web/src/features/team-builder/components/guided/simplified-set-editor.tsx`, `apps/web/src/features/damage-calc/components/damage-calculator.tsx`
**Tasks:**

1. Read `slot-editor.tsx`. Replace `"Hardy"` string literals with `DEFAULT_NATURE` imported from `@nasty-plot/core`. Replace inline Pokemon info header JSX (~lines 189-210) with `PokemonInfoHeader` component
2. Read `simplified-set-editor.tsx`. Replace `"Hardy"` with `DEFAULT_NATURE`. Replace inline Pokemon info header JSX (~lines 112-122) with `PokemonInfoHeader` component
3. Read `damage-calculator.tsx`. Replace `"Hardy"` with `DEFAULT_NATURE`
4. Import `capitalize` from `@nasty-plot/core` in `role-suggestion-banner.tsx` and remove the local definition
5. Run: `pnpm test`

#### Agent 6: `type-fixes-and-remaining-frontend`

**Scope:** `apps/web/src/features/battle/components/MoveSelector.tsx`, `packages/teams/src/validation.service.ts`, `packages/data-pipeline/src/cli/seed.ts`, `packages/data-pipeline/src/cli/verify.ts`, `apps/web/src/features/battle/components/SampleTeamCard.tsx`, `apps/web/src/features/battle/components/TeamPickerCard.tsx`, `apps/web/src/app/teams/page.tsx`, `packages/mcp-server/src/index.ts`
**Tasks:**

1. Read `MoveSelector.tsx` (battle). Rename `interface MoveSelectorProps` to `interface BattleMoveSelectorProps`. Update the component function signature
2. Read `packages/teams/src/validation.service.ts`. Remove the local `ValidationError` interface. Add `import type { ValidationError } from "@nasty-plot/core"`
3. Read `packages/data-pipeline/src/cli/seed.ts`. Rename `CliArgs` to `SeedCliArgs`
4. Read `packages/data-pipeline/src/cli/verify.ts`. Rename `CliArgs` to `VerifyCliArgs`
5. Read `SampleTeamCard.tsx`. Replace inline Pokemon sprite row with `PokemonSpriteRow` component
6. Read `TeamPickerCard.tsx`. Replace inline Pokemon sprite grid with `PokemonSpriteRow` component
7. Read `apps/web/src/app/teams/page.tsx`. Replace inline Pokemon sprite list with `PokemonSpriteRow` component
8. Read `packages/mcp-server/src/index.ts` — verify MCP port constant usage (C3 fix)
9. Run: `pnpm test -- tests/teams/ tests/data-pipeline/`

### Wave 3 — 5 Agents (After Wave 2)

#### Agent 1: `teams-domain-renames`

**Scope:** `packages/teams/src/team.service.ts`, `packages/teams/src/sample-team.service.ts`, `packages/teams/src/version.service.ts`, `packages/teams/src/import-export.service.ts`, `packages/teams/src/index.ts`, all files under `apps/web/src/app/api/teams/`, `apps/web/src/app/api/sample-teams/`, `packages/mcp-server/src/tools/team-crud.ts`, web team pages
**Tasks:**

1. Read `team.service.ts`. Rename all `id: string` parameters to `teamId: string` in: `getTeam`, `updateTeam`, `deleteTeam`, and any other functions using generic `id` for teams
2. Read `sample-team.service.ts`. Rename `id` to `sampleTeamId` in: `getSampleTeam`, `deleteSampleTeam`
3. Read `version.service.ts`. Rename any generic `id` to `teamId` where applicable
4. Read `import-export.service.ts`. Rename any generic `id` to `teamId`
5. Update barrel exports if function signatures changed
6. Read and update ALL callers: API routes under `/api/teams/`, `/api/sample-teams/`, MCP team-crud.ts, web team page components
7. Update test files: `tests/teams/`, `tests/api/` (team-related tests), `tests/mcp-server/` (team-crud tests)
8. Run: `pnpm test`

#### Agent 2: `battle-domain-renames`

**Scope:** `packages/battle-engine/src/battle.service.ts`, `packages/battle-engine/src/index.ts`, all `packages/battle-engine/src/*.ts` files (for file renames), all files under `apps/web/src/app/api/battles/`, web battle pages
**Tasks:**

1. Read `battle.service.ts`. Rename all `id: string` to `battleId: string` in: `getBattle`, `deleteBattle`, `getBattleReplay`, etc. Rename `id` to `batchId` for batch-related functions
2. Update barrel exports in `index.ts`
3. Rename files to `.service.ts`:
   - `protocol-parser.ts` → `protocol-parser.service.ts`
   - `team-packer.ts` → `team-packer.service.ts`
   - `battle-state-serializer.ts` → `battle-state-serializer.service.ts`
   - `ai/evaluator.ts` → `ai/evaluator.service.ts`
   - `ai/hint-engine.ts` → `ai/hint-engine.service.ts`
   - `ai/win-probability.ts` → `ai/win-probability.service.ts`
4. Update ALL internal imports within battle-engine that reference the renamed files
5. Update ALL barrel exports (`index.ts`, `client.ts`) to use new file paths
6. Read and update ALL callers: API routes under `/api/battles/`, web battle pages/hooks
7. Update test files: `tests/battle-engine/`, `tests/api/` (battle-related tests)
8. Run: `pnpm test`

#### Agent 3: `llm-domain-renames`

**Scope:** `packages/llm/src/chat-session.service.ts`, `packages/llm/src/index.ts`, all files under `apps/web/src/app/api/chat/`, web chat page
**Tasks:**

1. Read `chat-session.service.ts`. Rename all `id: string` to `sessionId: string` in: `getSession`, `deleteSession`, and any other functions
2. Read `llm/src/index.ts`. Remove unused re-exports (lines 47-53): `ChatMessage`, `ChatSessionData`, `ChatRole`, `ChatMessageMetadata`, `AutoAnalyzeDepth`
3. Read and update ALL callers: API routes under `/api/chat/`, web chat page components
4. Update test files: `tests/llm/` (chat-session related tests)
5. Run: `pnpm test -- tests/llm/ tests/api/`

#### Agent 4: `data-domain-renames`

**Scope:** `packages/pokemon-data/src/dex.service.ts`, `packages/pokemon-data/src/index.ts`, `packages/formats/src/format.service.ts`, `packages/formats/src/index.ts`, ALL callers across entire codebase
**Tasks:**

1. Read `pokemon-data/src/dex.service.ts`. Rename:
   - `getAllSpecies` → `listSpecies`
   - `getAllMoves` → `listMoves`
   - `getAllItems` → `listItems`
   - `getAllAbilities` → `listAbilities`
   - Any other `getAll*` functions
2. Read `formats/src/format.service.ts`. Rename `getAllFormats` → `listFormats`
3. Update barrel exports in both `index.ts` files
4. Search entire codebase for callers of the old names and update them. Key locations:
   - `packages/analysis/src/*.ts`
   - `packages/recommendations/src/*.ts`
   - `packages/mcp-server/src/tools/data-query.ts`
   - `packages/mcp-server/src/tools/meta-recs.ts`
   - `apps/web/src/app/api/pokemon/route.ts`
   - `apps/web/src/app/api/formats/route.ts`
   - `apps/web/src/app/api/items/route.ts`
   - Any other files that import these functions
5. Update ALL test files that reference the old names
6. Run: `pnpm test`

#### Agent 5: `mcp-analysis-fix`

**Scope:** `packages/mcp-server/src/tools/analysis.ts`
**Tasks:**

1. Read `packages/mcp-server/src/tools/analysis.ts`
2. Find the `calculate_damage` tool definition (~line 96-98)
3. Rename parameters: `attackerPokemon` → `attackerPokemonId`, `defenderPokemon` → `defenderPokemonId`
4. Update the tool implementation to use the new parameter names
5. Run: `pnpm test -- tests/mcp-server/`

### Post-Execution

After all waves complete:

```bash
# Full test suite
pnpm test

# Full build
pnpm build

# Verify no remaining "Hardy" literals in source (excluding test files)
grep -r '"Hardy"' packages/ apps/web/src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v '.test.'

# Verify no remaining getAll* in source
grep -rn 'getAllSpecies\|getAllMoves\|getAllItems\|getAllAbilities\|getAllFormats' packages/ apps/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v '.test.'

# Verify no remaining generic id params in service functions
grep -n 'function get.*\bid: string\b\|function delete.*\bid: string\b\|function update.*\bid: string\b' packages/teams/src/*.ts packages/battle-engine/src/*.ts packages/llm/src/*.ts

# Verify no remaining non-.service.ts files that should have been renamed
ls packages/battle-engine/src/protocol-parser.ts packages/battle-engine/src/team-packer.ts packages/battle-engine/src/battle-state-serializer.ts packages/battle-engine/src/ai/evaluator.ts packages/battle-engine/src/ai/hint-engine.ts packages/battle-engine/src/ai/win-probability.ts 2>/dev/null
```
