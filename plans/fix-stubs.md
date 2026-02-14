# Fix Stubs Plan

**Audit date:** 2026-02-14
**Status:** 31 stubs across 50+ files
**Baseline:** 80 test files, 1879 tests passing

---

## Stubs

### 1. Frontend → Backend Gaps (1 stub)

#### FB-1. Battle Hub teams type mismatch — CRITICAL — WIRE

- **Locations:** `apps/web/src/app/battle/page.tsx:171-172`
- **Fix:** Change `useFetchData<{ teams?: ... }>` to `useFetchData<{ id: string; name: string }[]>` and replace `teamsData?.teams ?? []` with `teamsData ?? []`

### 2. MCP → API Gaps (5 stubs)

#### MA-1. `get_smogon_sets` parameter mismatch — CRITICAL — WIRE

- **Locations:** `packages/mcp-server/src/tools/data-query.ts:60`
- **Fix:** Change `buildParams({ format: formatId })` to `buildParams({ formatId })`

#### MA-2. `suggest_sets` parameter mismatch — CRITICAL — WIRE

- **Locations:** `packages/mcp-server/src/tools/meta-recs.ts:78`
- **Fix:** Change `buildParams({ format: formatId })` to `buildParams({ formatId })`

#### MA-3. `suggest_counters` wrong request body — CRITICAL — WIRE

- **Locations:** `packages/mcp-server/src/tools/analysis.ts:54-58`
- **Fix:** Change request body from `{ targetPokemonId, formatId, type }` to match API's expected `{ teamId, limit?, weights? }` schema

#### MA-4. `get_common_cores` uses wrong endpoint — MEDIUM — WIRE

- **Locations:** `packages/mcp-server/src/tools/meta-recs.ts:57`
- **Fix:** Change from `/formats/{formatId}/usage` to `/formats/{formatId}/cores` endpoint

#### MA-5. `get_moves_by_criteria` filters ignored — MEDIUM — WIRE

- **Locations:** `packages/mcp-server/src/tools/data-query.ts:86-105`
- **Fix:** Add type/category query param support to learnset API route, or filter client-side in MCP tool

### 3. Unused Barrel Exports (8 stubs, 31 symbols)

#### UE-1. analysis: 11 internal-only constants — MEDIUM — INTERNALIZE

- **Locations:** `packages/analysis/src/index.ts`, `packages/analysis/src/constants.ts`
- **Fix:** Remove `export * from "./constants"` from barrel. Constants stay in source for internal use.

#### UE-2. recommendations: `MAX_SCORE` — MEDIUM — INTERNALIZE

- **Locations:** `packages/recommendations/src/index.ts`
- **Fix:** Remove MAX_SCORE from barrel exports

#### UE-3. teams: 4 internal types — MEDIUM — INTERNALIZE

- **Locations:** `packages/teams/src/index.ts`
- **Fix:** Remove `DbSlotRow`, `TeamFingerprint`, `MatchLevel`, `TeamMatchResult` from barrel

#### UE-4. llm: 2 internal types — MEDIUM — INTERNALIZE

- **Locations:** `packages/llm/src/index.ts`
- **Fix:** Remove `BattleCommentaryContext`, `CreateSessionOptions` from barrel

#### UE-5. battle-engine: 8 internal types — MEDIUM — INTERNALIZE

- **Locations:** `packages/battle-engine/src/index.ts`
- **Fix:** Remove `ParsedBattleImport`, `ListBattlesOptions`, `CreateBattleData`, `CreateBatchData`, `EvalResult`, `EvalFeature`, `MCTSConfig`, `PokemonStats` from barrel

#### UE-6. ui: 8 component prop types — MEDIUM — INTERNALIZE

- **Locations:** `packages/ui/src/index.ts`
- **Fix:** Remove 8 component prop types from barrel (PokemonSpriteProps, GroupedSelectorItem, GroupedSelectorGroup, GroupedSelectorProps, AbilitySelectorProps, EvEditorProps, IvEditorProps, CalculatedStatsDisplayProps)

#### UE-7. smogon-data: 5 internal types — MEDIUM — INTERNALIZE

- **Locations:** `packages/smogon-data/src/index.ts`
- **Fix:** Remove `ExtractedTeam`, `SetMatchScore`, `InferredSetResult`, `EnrichedPokemon`, `EnrichedTeam` from barrel

#### UE-8. pokemon-data: `IconData` — MEDIUM — INTERNALIZE

- **Locations:** `packages/pokemon-data/src/index.ts`
- **Fix:** Remove `IconData` from barrel

### 4. Unused Service Functions (5 stubs)

#### US-1. `getDataStatus()` — MEDIUM — REMOVE

- **Locations:** `packages/data-pipeline/src/staleness.service.ts:36`
- **Fix:** Remove the function entirely. Also remove from barrel if exported.

#### US-2. `generateSetsFromChaos()` — MEDIUM — INTERNALIZE

- **Locations:** `packages/smogon-data/src/chaos-sets.service.ts:66`
- **Fix:** Remove `export` keyword (keep function for internal use by smogon-sets.service.ts)

#### US-3. `ensureFormatExists()` — MEDIUM — INTERNALIZE

- **Locations:** `packages/formats/src/format-db.service.ts:14`
- **Fix:** Remove from barrel export (keep for internal use)

#### US-4. `createApiClient()` / `checkedFetch()` — MEDIUM — REMOVE

- **Locations:** `packages/core/src/api-client.service.ts`
- **Fix:** Delete the entire file and remove from barrel

#### US-5. `scoreSetMatch()` / `resolveMoves()` — MEDIUM — INTERNALIZE

- **Locations:** `packages/smogon-data/src/set-inference.service.ts:103,163`
- **Fix:** Remove from barrel export (keep for internal use by inferFromSets)

### 5. Dead Types (3 stubs, 12 types)

#### DT-1. Dead standalone types — MEDIUM — REMOVE

- **Locations:** `packages/core/src/types.ts` (ApiError, CheckCounterData), `packages/battle-engine/src/types.ts` (BattleSetupConfig)
- **Fix:** Delete the type definitions and remove from barrels

#### DT-2. Dead ChatContextData hierarchy — MEDIUM — REMOVE

- **Locations:** `packages/core/src/chat-context.ts`
- **Fix:** Delete the entire file and remove from barrel

#### DT-3. Dead MCTS worker types — MEDIUM — REMOVE

- **Locations:** `packages/battle-engine/src/ai/mcts-types.ts` (MCTSWorkerRequest, MCTSWorkerProgress, MCTSWorkerResult, MCTSWorkerError, MCTSWorkerMessage)
- **Fix:** Remove the 5 worker type definitions from the file. Keep other MCTS types that are used.

### 6. Dead Types — Internalize (1 stub, 4 types)

#### DT-4. Internal-only types — LOW — INTERNALIZE

- **Locations:** `packages/core/src/constants.ts` (StatusEntry), `packages/data-pipeline/src/data/sample-teams.ts` (SampleTeamSeedEntry), `packages/llm/src/chat.service.ts` (StreamChatOptions), `packages/core/src/type-chart.ts` (EffectivenessBucket)
- **Fix:** Remove `export` keyword from type definitions (keep types for internal use)

### 7. Unused Constants (2 stubs, 3 constants)

#### UC-1. `ARCHETYPE_OPTIONS` — LOW — REMOVE

- **Locations:** `packages/core/src/constants.ts:206`
- **Fix:** Delete the constant definition and remove from barrel

#### UC-2. `VGC_LEVEL` / `LC_LEVEL` — LOW — REMOVE

- **Locations:** `packages/core/src/constants.ts:169-170`
- **Fix:** Delete both constant definitions and remove from barrel

### 8. Integration Chain Gaps (1 stub)

#### IC-1. Server actions bypass service layer — MEDIUM — WIRE

- **Locations:** `apps/web/src/app/pokemon/[pokemonId]/actions.ts`
- **Fix:** Replace direct Prisma queries with service function calls from `@nasty-plot/formats` and `@nasty-plot/smogon-data`

---

## Decisions (Pre-Approved)

1. FB-1: Fix frontend type to match API response (array, not wrapped object)
2. MA-1/2/3: Fix MCP tools to send correct parameters (don't change API)
3. BF-1/2/3: Keep admin routes as-is (no action)
4. UE-1–8: Remove all 31 internal-only symbols from barrel exports
5. US-1/4: Remove dead service functions entirely
6. US-2/3/5: Internalize (remove export, keep code)
7. DT-1/2/3: Remove all 12 dead types
8. DT-4: Internalize 4 internal-only types
9. UC-1/2: Remove all 3 unused constants
10. IC-1/MA-4/MA-5: Fix all 3 (server action, get_common_cores, get_moves_by_criteria)

---

## Execution Plan — Wave Architecture

### Wave 1: Critical Bug Fixes

Fix broken functionality — no interdependencies between agents.

#### Agent A: `fix-frontend-teams`

**Scope:** `apps/web/src/app/battle/page.tsx`
**Tasks:**

1. Read `apps/web/src/app/battle/page.tsx`
2. Fix the `useFetchData` type parameter and data access pattern at line 171-172
3. Change from `useFetchData<{ teams?: { id: string; name: string }[] }>` to `useFetchData<{ id: string; name: string }[]>`
4. Change `teamsData?.teams ?? []` to `teamsData ?? []`

#### Agent B: `fix-mcp-critical`

**Scope:** `packages/mcp-server/src/tools/data-query.ts`, `packages/mcp-server/src/tools/meta-recs.ts`, `packages/mcp-server/src/tools/analysis.ts`
**Tasks:**

1. Read all three tool files
2. Fix MA-1: In `data-query.ts`, change `get_smogon_sets` from `buildParams({ format: formatId })` to `buildParams({ formatId })`
3. Fix MA-2: In `meta-recs.ts`, change `suggest_sets` from `buildParams({ format: formatId })` to `buildParams({ formatId })`
4. Fix MA-3: In `analysis.ts`, fix `suggest_counters` request body to match `/api/recommend` expected schema `{ teamId, limit?, weights? }`
5. Read `/apps/web/src/app/api/recommend/route.ts` to understand exact expected schema before fixing

#### Agent C: `fix-mcp-improvements`

**Scope:** `packages/mcp-server/src/tools/meta-recs.ts` (get_common_cores only), `packages/mcp-server/src/tools/data-query.ts` (get_moves_by_criteria only), `apps/web/src/app/api/pokemon/[pokemonId]/learnset/route.ts`
**Tasks:**

1. Fix MA-4: Read the `/cores` route to understand its API, then update `get_common_cores` in `meta-recs.ts` to call `/formats/{formatId}/cores` instead of `/formats/{formatId}/usage`
2. Fix MA-5: Read the learnset route, then add type/category query param filtering to the learnset API endpoint so `get_moves_by_criteria` filters work

#### Agent D: `fix-server-actions`

**Scope:** `apps/web/src/app/pokemon/[pokemonId]/actions.ts`
**Tasks:**

1. Read the current server actions file
2. Read relevant service functions from `@nasty-plot/formats` and `@nasty-plot/smogon-data`
3. Replace direct `prisma.format.findMany` with appropriate service function
4. Replace direct `prisma.usageStats.findFirst` with appropriate service function

### Wave 2: Dead Code Removal + Barrel Cleanup

Remove dead code and internalize exports. Each agent works on non-overlapping packages.

#### Agent E: `cleanup-core`

**Scope:** `packages/core/` only
**Tasks:**

1. Read `packages/core/src/types.ts` — remove `ApiError` and `CheckCounterData` type definitions
2. Read `packages/core/src/chat-context.ts` — delete the entire file
3. Read `packages/core/src/constants.ts` — remove `ARCHETYPE_OPTIONS`, `VGC_LEVEL`, `LC_LEVEL`; remove `export` from `StatusEntry`
4. Read `packages/core/src/api-client.service.ts` — delete the entire file
5. Read `packages/core/src/type-chart.ts` — remove `export` from `EffectivenessBucket`
6. Read `packages/core/src/index.ts` — remove barrel exports for: deleted types, deleted file re-exports, deleted constants, deleted api-client service

#### Agent F: `cleanup-battle-engine`

**Scope:** `packages/battle-engine/` only
**Tasks:**

1. Read `packages/battle-engine/src/types.ts` — remove `BattleSetupConfig` interface
2. Read `packages/battle-engine/src/ai/mcts-types.ts` — remove `MCTSWorkerRequest`, `MCTSWorkerProgress`, `MCTSWorkerResult`, `MCTSWorkerError`, `MCTSWorkerMessage` types
3. Read `packages/battle-engine/src/index.ts` — remove barrel exports for: deleted types + 8 internal-only types (`ParsedBattleImport`, `ListBattlesOptions`, `CreateBattleData`, `CreateBatchData`, `EvalResult`, `EvalFeature`, `MCTSConfig`, `PokemonStats`)

#### Agent G: `cleanup-analysis-recs-pipeline`

**Scope:** `packages/analysis/`, `packages/recommendations/`, `packages/data-pipeline/`
**Tasks:**

1. Read `packages/analysis/src/index.ts` — remove `export * from "./constants"` line (internalize all 11 constants)
2. Read `packages/recommendations/src/index.ts` — remove `MAX_SCORE` from barrel
3. Read `packages/data-pipeline/src/staleness.service.ts` — remove `getDataStatus()` function entirely
4. Read `packages/data-pipeline/src/data/sample-teams.ts` — remove `export` from `SampleTeamSeedEntry` type
5. Update `packages/data-pipeline/src/index.ts` if it re-exports `getDataStatus`

#### Agent H: `cleanup-remaining-packages`

**Scope:** `packages/teams/`, `packages/llm/`, `packages/ui/`, `packages/smogon-data/`, `packages/pokemon-data/`, `packages/formats/`
**Tasks:**

1. Read `packages/teams/src/index.ts` — remove `DbSlotRow`, `TeamFingerprint`, `MatchLevel`, `TeamMatchResult` from barrel
2. Read `packages/llm/src/index.ts` — remove `BattleCommentaryContext`, `CreateSessionOptions` from barrel
3. Read `packages/llm/src/chat.service.ts` — remove `export` from `StreamChatOptions` type
4. Read `packages/ui/src/index.ts` — remove 8 component prop types from barrel
5. Read `packages/smogon-data/src/index.ts` — remove 5 internal types + `scoreSetMatch` + `resolveMoves` + `generateSetsFromChaos` from barrel
6. Read `packages/pokemon-data/src/index.ts` — remove `IconData` from barrel
7. Read `packages/formats/src/index.ts` — remove `ensureFormatExists` from barrel if present

### Post-Execution

```bash
# Verify all tests pass
pnpm test

# Verify build passes
pnpm build

# Verify no remaining references to deleted code
grep -r "ApiError" packages/ apps/ --include="*.ts" | grep -v node_modules | grep -v ".d.ts"
grep -r "ChatContextData" packages/ apps/ --include="*.ts" | grep -v node_modules
grep -r "BattleSetupConfig" packages/ apps/ --include="*.ts" | grep -v node_modules
grep -r "MCTSWorkerRequest\|MCTSWorkerProgress\|MCTSWorkerResult\|MCTSWorkerError\|MCTSWorkerMessage" packages/ apps/ --include="*.ts" | grep -v node_modules
grep -r "createApiClient\|checkedFetch" packages/ apps/ --include="*.ts" | grep -v node_modules
grep -r "getDataStatus" packages/ apps/ --include="*.ts" | grep -v node_modules
grep -r "ARCHETYPE_OPTIONS\|VGC_LEVEL\|LC_LEVEL" packages/ apps/ --include="*.ts" | grep -v node_modules
grep -r "CheckCounterData" packages/ apps/ --include="*.ts" | grep -v node_modules
```
