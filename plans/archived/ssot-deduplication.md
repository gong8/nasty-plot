# SSOT Deduplication Plan

**Audit date:** 2026-02-13
**Status:** COMPLETED — All 15 violations resolved, 1894 tests passing
**Test baseline:** 80 files, 1894 tests all passing (`pnpm test`)

---

## Agent Handoff Prompt

You are continuing the SSOT (Single Source of Truth) deduplication effort for the nasty-plot monorepo. The audit phase and design questions are COMPLETE. All user decisions have been captured below. Your job is to EXECUTE the plan wave by wave, using parallel agent teams.

**Before starting each wave:**

1. Run `pnpm test` to confirm green baseline
2. Create a team with `TeamCreate` named `ssot-wave-{N}`
3. Create tasks with `TaskCreate` for each agent
4. Spawn ALL agents for that wave in a SINGLE message via `Task` tool with `subagent_type: "general-purpose"` and `mode: "bypassPermissions"`
5. Monitor via `TaskList`
6. After all agents complete: shut down agents, run `pnpm test`, fix any failures before next wave
7. Delete team with `TeamDelete`

After all waves: run `pnpm build`, run post-execution verification greps, write session summary via `/summary`.

---

## Violations

### 1. Utilities (3 violations)

#### U1. Duplicate `toId`/`toID`/`toSpeciesId` — HIGH

- **Locations:**
  - `packages/core/src/showdown-paste.ts:189` — `toId` (exported, canonical)
  - `packages/pokemon-data/src/dex.service.ts:8-10` — `toID` (private, duplicate)
  - `packages/battle-engine/src/protocol-parser.ts:100-102` — `toSpeciesId` (private, duplicate)
  - `packages/battle-engine/src/replay/replay-import.ts:58-60` — `toSpeciesId` (private, duplicate)
- **Fix:** Remove all private copies. Import `toId` from `@nasty-plot/core` everywhere.
- **Current code (canonical):** `packages/core/src/showdown-paste.ts:189`:
  ```typescript
  export function toId(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]/g, "")
  }
  ```
- **Duplicate in pokemon-data:** regex is `[^a-z0-9]+` (with `+`) — functionally identical
- **Duplicates in battle-engine:** both are named `toSpeciesId` with identical regex to canonical

#### U2. Duplicate `resolveSpeciesName` — MEDIUM

- **Locations:**
  - `packages/pokemon-data/src/dex.service.ts:275-278` — exported (canonical)
  - `packages/battle-engine/src/team-packer.ts:29-34` — private copy
- **Fix:** Remove private copy in team-packer, import from `@nasty-plot/pokemon-data`.
- **Difference:** team-packer uses `getRawSpecies()` vs canonical uses `dex.species.get()` — same result since `getRawSpecies` wraps the dex call. Both have the same camelCase fallback regex.

#### U3. Duplicate `getBaseStatTotal` — MEDIUM

- **Locations:**
  - `apps/web/src/app/api/pokemon/route.ts:8-10` — private
  - `apps/web/src/app/pokemon/page.tsx:27-29` — private
- **Fix:** Add `getBaseStatTotal` to `packages/core/src/stat-calc.ts`, export from barrel, import in both web files.
- **Implementation:**
  ```typescript
  export function getBaseStatTotal(stats: StatsTable): number {
    return stats.hp + stats.atk + stats.def + stats.spa + stats.spd + stats.spe
  }
  ```

### 2. Services (3 violations)

#### S1. Duplicate team DB→domain mapping — MEDIUM

- **Locations:**
  - `packages/teams/src/team.service.ts:157-172` — `dbTeamToDomain` (already exported)
  - `packages/teams/src/version.service.ts` — `toTeamData` (duplicate, ~line 370+)
- **Fix:** version.service imports and calls `dbTeamToDomain` from team.service.
- **Note:** `dbTeamToDomain` is already exported from team.service.ts (line 157) and from the barrel (teams/index.ts does NOT currently export it, but `dbSlotToDomain` IS exported). Need to also export `dbTeamToDomain` from barrel.
- **CRITICAL:** version.service.ts is only 392 lines. `toTeamData` must be near the end. The agent should read the FULL file to find it.

#### S2. Direct Prisma team queries bypassing `getTeam()` — MEDIUM

- **Locations:**
  - `packages/analysis/src/analysis.service.ts:30-33` — `prisma.team.findUnique({ where: { id: teamId }, include: { slots: true } })`
  - `packages/recommendations/src/composite-recommender.ts:35-38` — same pattern
- **Fix:** Replace with `getTeam(teamId)` from `@nasty-plot/teams`. The return type of `getTeam` is `TeamData` which has `slots: TeamSlotData[]` — these are already the domain type, no need to call `dbSlotToDomain` separately.
- **IMPORTANT:** After replacing, remove `import { prisma } from "@nasty-plot/db"` and `import { dbSlotToDomain } from "@nasty-plot/teams"` from both files (they become unused). Add `import { getTeam } from "@nasty-plot/teams"` instead.
- **analysis.service.ts current code (lines 29-39):**
  ```typescript
  export async function analyzeTeam(teamId: string): Promise<TeamAnalysis> {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { slots: true },
    })
    if (!team) throw new Error(`Team not found: ${teamId}`)
    const slots: TeamSlotData[] = team.slots.map(dbSlotToDomain)
  ```
  **Should become:**
  ```typescript
  export async function analyzeTeam(teamId: string): Promise<TeamAnalysis> {
    const team = await getTeam(teamId)
    if (!team) throw new Error(`Team not found: ${teamId}`)
    const slots = team.slots
  ```
- **composite-recommender.ts current code (lines 35-42):**
  ```typescript
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { slots: true },
  })
  if (!team) throw new Error(`Team not found: ${teamId}`)
  const slots = team.slots.map(dbSlotToDomain)
  ```
  **Should become:**
  ```typescript
  const team = await getTeam(teamId)
  if (!team) throw new Error(`Team not found: ${teamId}`)
  const slots = team.slots
  ```

#### S3. Missing battle CRUD service — MEDIUM

- **10 API route files** use direct Prisma for battle operations
- **Fix:** Create `packages/battle-engine/src/battle.service.ts` with CRUD functions, update all routes
- **Files:**
  - `apps/web/src/app/api/battles/route.ts`
  - `apps/web/src/app/api/battles/batch/route.ts`
  - `apps/web/src/app/api/battles/[battleId]/route.ts`
  - `apps/web/src/app/api/battles/[battleId]/replay/route.ts`
  - `apps/web/src/app/api/battles/[battleId]/export/route.ts`
  - `apps/web/src/app/api/battles/[battleId]/commentary/route.ts`
  - `apps/web/src/app/api/battles/batch/[batchId]/route.ts`
  - `apps/web/src/app/api/teams/[teamId]/battles/stats/route.ts`
  - `apps/web/src/app/api/data/seed/route.ts`
  - `apps/web/src/app/pokemon/[id]/page.tsx`

### 3. Frontend (3 violations)

#### F1. Inline type badge rendering — MEDIUM

- 4+ files render type badges inline with `TYPE_COLORS` + `isLightTypeColor()` instead of using `TypeBadge` from `@nasty-plot/ui`
- **Files:** MoveSelector.tsx, TeraTypePicker.tsx, WeaknessHeatmap.tsx, CoverageChart.tsx

#### F2. Health bar color logic duplication — MEDIUM

- `MoveSelector.tsx` TargetCard has inline `hpPercent > 50 ? "bg-green-500" : hpPercent > 20 ? "bg-yellow-500" : "bg-red-500"` duplicating `HealthBar.tsx:11-15`

#### F3. Status badge constants duplication — MEDIUM

- `BattleField.tsx:25-31` has `STATUS_BADGE` object
- `SwitchMenu.tsx:18-25` has `STATUS_LABELS` + `STATUS_COLORS` (same data, different structure)
- **Fix:** Extract `STATUS_BADGE_CONFIG` to `@nasty-plot/core/constants.ts`

### 4. Constants (1 violation)

#### C1. Inline default EVs in test — LOW

- `tests/core/stat-calc.test.ts:230` — uses inline `{ hp: 0, ... }` instead of `DEFAULT_EVS`

### 5. Naming (2 violations)

#### N1. `speciesId`/`species` in ExtractedPokemonData — LOW

- **Location:** `packages/core/src/types.ts:446-455`
- **Current:**
  ```typescript
  export interface ExtractedPokemonData {
    speciesId: string // → rename to pokemonId
    species: string // → rename to pokemonName
    nickname?: string
    level: number
    moves: string[]
    ability?: string
    item?: string
    teraType?: string
  }
  ```
- **CRITICAL SCOPE WARNING:** Only rename fields on `ExtractedPokemonData` and `ExtractedTeamData` (which contains `pokemon: ExtractedPokemonData[]`). Do NOT rename `BattlePokemon.speciesId` (different type in `packages/battle-engine/src/types.ts:61`) or `TeamFingerprint.speciesIds` (in `packages/teams/src/team-matcher.service.ts:14`). Those are separate types with different semantics.
- **Consumer files that reference ExtractedPokemonData fields:**
  - `packages/core/src/showdown-paste.ts:145` — `slot.species?.name`... wait, this is `TeamSlotData.species` NOT `ExtractedPokemonData.species`. Do NOT change this.
  - `packages/battle-engine/src/replay/replay-import.ts:100-170` — builds `ExtractedPokemonData` objects with `speciesId` and `species` fields
  - `packages/smogon-data/src/set-inference.service.ts:256` — reads `pokemon.speciesId`
  - `packages/teams/src/import-export.service.ts:114-115` — reads `p.speciesId`
  - `packages/teams/src/team-matcher.service.ts:52,58` — params typed as `{ speciesId: string; moves: string[] }[]` matching ExtractedPokemonData shape. Rename these params too.
  - Tests (many files): `speciesId:` in `makeExtracted()`, `fingerprintFromExtracted()`, `parseProtocolLog()` result assertions, etc.
- **Test files to update (ExtractedPokemonData-related only):**
  - `tests/teams/import-export.service.test.ts` (~8 occurrences)
  - `tests/teams/team-matcher.test.ts` (~25 occurrences — but ONLY the ones in `fingerprintFromExtracted` calls and `{ speciesId: ...}` object literals passed as ExtractedPokemonData)
  - `tests/smogon-data/set-inference.test.ts` (~12 occurrences)
  - `tests/battle-engine/replay-import.test.ts` (~15 occurrences)
  - `tests/battle-engine/ai-predictor-integration.test.ts` — these use `makePokemon()` which creates `BattlePokemon`, NOT `ExtractedPokemonData`. DO NOT CHANGE THESE.
  - `tests/battle-engine/ai.test.ts` — same: `BattlePokemon`. DO NOT CHANGE.
  - `tests/battle-engine/evaluator-hints.test.ts` — same: `BattlePokemon`. DO NOT CHANGE.
  - `tests/battle-engine/mcts-ai.test.ts` — same: `BattlePokemon`. DO NOT CHANGE.

#### N2. DB column naming `evSpA`/`ivSpA` vs domain `spa`/`spd` — LOW

- **Location:** `prisma/schema.prisma:132-139`, `packages/teams/src/team.service.ts:32-40`
- **Current Prisma schema (TeamSlot model):**
  ```
  evSpA  Int @default(0)
  evSpD  Int @default(0)
  ivSpA  Int @default(31)
  ivSpD  Int @default(31)
  ```
- **Fix:** Rename columns: `evSpA`→`evSpa`, `evSpD`→`evSpd`, `ivSpA`→`ivSpa`, `ivSpD`→`ivSpd`
- **DbSlotRow type in team.service.ts (lines 32-39):** Update field names to match
- **Mapping code in team.service.ts:** Update `dbSlotToDomain` (lines 126-127, 134-135) and `evsToDb`/`ivsToDb` functions
- **After schema change:** Run `pnpm db:push` then `pnpm db:generate`

### 6. Imports (3 violations)

#### I1. Unused battle-engine exports — LOW

- `formatShowdownLog`, `formatShowdownReplayJSON` at `packages/battle-engine/src/index.ts:46`
- **Fix:** Remove from barrel export line

#### I2. Unused core constants — LOW

- Remove from `packages/core/src/constants.ts`: `CURRENT_GENERATION` (line 145), `MAX_IV` (line 151), `MIN_IV` (line 152)
- Keep: `VGC_LEVEL`, `LC_LEVEL` (future format support)
- Also remove from `packages/core/src/index.ts` if individually exported (currently uses `export * from "./constants"` so no barrel change needed)

#### I3. Redundant teams re-exports from core — INFORMATIONAL

- `packages/teams/src/index.ts:50-59` re-exports 8 types from `@nasty-plot/core`:
  ```typescript
  export type {
    TeamDiff,
    SlotChange,
    FieldChange,
    DiffSummary,
    MergeDecision,
    MergeOptions,
    ForkOptions,
    LineageNode,
  } from "@nasty-plot/core"
  ```
- **Fix:** Remove these re-exports. All consumers already import them from `@nasty-plot/core`.
- **Verify first:** grep for `from "@nasty-plot/teams"` importing any of these 8 types. If none found, safe to remove.

---

## Decisions (Pre-Approved by User)

1. All ID normalization (`toId`) goes through `@nasty-plot/core` as SSOT
2. Create `battle.service.ts` in `@nasty-plot/battle-engine` for battle CRUD
3. Rename `ExtractedPokemonData` fields: `speciesId`→`pokemonId`, `species`→`pokemonName` now (breaking change, immediate updates)
4. Remove dead exports: `CURRENT_GENERATION`, `MAX_IV`, `MIN_IV`, `formatShowdownLog`, `formatShowdownReplayJSON`. Keep `VGC_LEVEL`, `LC_LEVEL`
5. `analysis` and `recommendations` use `getTeam()` from teams instead of direct Prisma
6. Extract all shared UI (type badges, health bars, status badges) to shared components
7. Fix DB column naming now with Prisma migration (`evSpA`→`evSpa`, etc.)
8. Immediate consumer updates — no backward-compatible re-exports or deprecation aliases

---

## Execution Plan — Parallel Agent Architecture

### Dependency Graph

```
Wave 1 (Foundation)         Wave 2 (Consumers)          Wave 3 (Frontend + Cleanup)
┌──────────────┐
│ Agent 1:     │
│ Core utils   │──────┐
│ (U1,U3,N1,  │      │
│  C1,I2)      │      │     ┌──────────────┐
└──────────────┘      ├────→│ Agent 4:     │
                      │     │ Battle svc   │
┌──────────────┐      │     │ (S3)         │
│ Agent 2:     │──────┤     └──────────────┘     ┌──────────────┐
│ Teams svc    │      │                          │ Agent 6:     │
│ (S1,S2,I3)   │      │     ┌──────────────┐    │ Frontend     │
└──────────────┘      ├────→│ Agent 5:     │    │ (F1,F2,F3)   │
                      │     │ BE consumers │    └──────────────┘
┌──────────────┐      │     │ (U1,U2,I1)   │
│ Agent 3:     │──────┘     └──────────────┘     ┌──────────────┐
│ DB migration │                                 │ Agent 7:     │
│ (N2)         │                                 │ Verify       │
└──────────────┘                                 └──────────────┘
```

### Wave 1 — 3 Agents (No Dependencies)

These agents create new canonical sources and clean up foundation packages. They have NO shared files.

---

#### Agent 1: Core Foundation Updates

**Violations:** U3, N1, C1, I2
**Scope:** `packages/core/src/` and `tests/core/` ONLY

**Tasks:**

1. **Add `getBaseStatTotal` to stat-calc.ts (U3):**
   - Read `packages/core/src/stat-calc.ts`
   - Add at the bottom of the file:
     ```typescript
     /** Sum all base stats (HP + Atk + Def + SpA + SpD + Spe) */
     export function getBaseStatTotal(stats: StatsTable): number {
       return stats.hp + stats.atk + stats.def + stats.spa + stats.spd + stats.spe
     }
     ```
   - The barrel `packages/core/src/index.ts` uses `export * from "./stat-calc"` so no barrel change needed.

2. **Rename ExtractedPokemonData fields (N1):**
   - Read `packages/core/src/types.ts`
   - At lines 446-455, change:
     - `speciesId: string` → `pokemonId: string`
     - `species: string` → `pokemonName: string`
   - Do NOT touch `ExtractedTeamData` (it just contains `pokemon: ExtractedPokemonData[]`, no field rename needed)
   - Do NOT touch any other type. `TeamSlotData.species` is a DIFFERENT field (it's `PokemonSpecies | undefined`, not a string).

3. **Remove unused constants (I2):**
   - Read `packages/core/src/constants.ts`
   - Remove these 3 lines:
     - `export const CURRENT_GENERATION = 9` (line 145)
     - `export const MAX_IV = 31` (line 151)
     - `export const MIN_IV = 0` (line 152)
   - Keep `VGC_LEVEL` and `LC_LEVEL`
   - Clean up any leftover comment headers that become orphaned

4. **Add STATUS_BADGE_CONFIG constant (F3 prep):**
   - Add to `packages/core/src/constants.ts` at the bottom:
     ```typescript
     // --- Status Badge Config (for battle UI) ---
     export const STATUS_BADGE_CONFIG: Record<string, { label: string; color: string }> = {
       brn: { label: "BRN", color: "bg-red-500" },
       par: { label: "PAR", color: "bg-yellow-500" },
       slp: { label: "SLP", color: "bg-gray-500" },
       frz: { label: "FRZ", color: "bg-cyan-400" },
       psn: { label: "PSN", color: "bg-purple-500" },
       tox: { label: "TOX", color: "bg-purple-600" },
     }
     ```

5. **Fix inline EVs in test (C1):**
   - Read `tests/core/stat-calc.test.ts`
   - Find the inline `{ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }` near line 230
   - Replace with `DEFAULT_EVS` and add the import at the top: `import { DEFAULT_EVS } from "@nasty-plot/core"`
   - If `DEFAULT_EVS` is already imported, just use it

6. **Run tests:** `pnpm test -- tests/core/`

---

#### Agent 2: Teams Service Consolidation

**Violations:** S1, S2, I3
**Scope:** `packages/teams/`, `packages/analysis/src/analysis.service.ts`, `packages/recommendations/src/composite-recommender.ts`

**Tasks:**

1. **Export `dbTeamToDomain` from barrel (S1 prep):**
   - Read `packages/teams/src/index.ts`
   - The barrel already exports `dbSlotToDomain` (line 13). Add `dbTeamToDomain` next to it:
     ```typescript
     export {
       ...existing...,
       dbTeamToDomain,
       dbSlotToDomain,
       ...
     } from "./team.service"
     ```

2. **Replace `toTeamData` in version.service.ts (S1):**
   - Read `packages/teams/src/version.service.ts` (full file, 392 lines)
   - Find the `toTeamData` function (should be near the end)
   - Replace the function body with a call to `dbTeamToDomain`:
     - Add import at top: `import { dbTeamToDomain } from "./team.service"`
     - Find all calls to `toTeamData(...)` and replace with `dbTeamToDomain(...)`
     - Delete the `toTeamData` function definition
   - Note: `dbSlotToDomain` is likely already imported. `dbTeamToDomain` uses it internally.

3. **Replace direct Prisma in analysis.service.ts (S2):**
   - Read `packages/analysis/src/analysis.service.ts`
   - Current imports (lines 1-17):
     ```typescript
     import { prisma } from "@nasty-plot/db"
     import { dbSlotToDomain } from "@nasty-plot/teams"
     ```
   - Replace with:
     ```typescript
     import { getTeam } from "@nasty-plot/teams"
     ```
   - Remove `import { prisma } from "@nasty-plot/db"` (becomes unused)
   - Remove `import { dbSlotToDomain } from "@nasty-plot/teams"` (becomes unused)
   - In `analyzeTeam()` function (lines 29-39), replace:
     ```typescript
     const team = await prisma.team.findUnique({ where: { id: teamId }, include: { slots: true } })
     if (!team) throw new Error(`Team not found: ${teamId}`)
     const slots: TeamSlotData[] = team.slots.map(dbSlotToDomain)
     ```
     With:
     ```typescript
     const team = await getTeam(teamId)
     if (!team) throw new Error(`Team not found: ${teamId}`)
     const slots = team.slots
     ```
   - The rest of the function uses `slots` and `team.formatId` which both work with `TeamData`

4. **Replace direct Prisma in composite-recommender.ts (S2):**
   - Read `packages/recommendations/src/composite-recommender.ts`
   - Current imports:
     ```typescript
     import { prisma } from "@nasty-plot/db"
     import { dbSlotToDomain } from "@nasty-plot/teams"
     ```
   - Replace with:
     ```typescript
     import { getTeam } from "@nasty-plot/teams"
     ```
   - In `getRecommendations()` (lines 35-42), replace:
     ```typescript
     const team = await prisma.team.findUnique({ where: { id: teamId }, include: { slots: true } })
     if (!team) throw new Error(`Team not found: ${teamId}`)
     const slots = team.slots.map(dbSlotToDomain)
     ```
     With:
     ```typescript
     const team = await getTeam(teamId)
     if (!team) throw new Error(`Team not found: ${teamId}`)
     const slots = team.slots
     ```

5. **Remove re-exports from teams barrel (I3):**
   - Read `packages/teams/src/index.ts`
   - Verify no file imports these 8 types from `@nasty-plot/teams` (grep for `from "@nasty-plot/teams"` + each type name)
   - If confirmed safe, remove lines 50-59:
     ```typescript
     export type {
       TeamDiff,
       SlotChange,
       FieldChange,
       DiffSummary,
       MergeDecision,
       MergeOptions,
       ForkOptions,
       LineageNode,
     } from "@nasty-plot/core"
     ```

6. **Run tests:** `pnpm test -- tests/teams/ tests/analysis/ tests/recommendations/`

---

#### Agent 3: Database Migration

**Violation:** N2
**Scope:** `prisma/schema.prisma`, `packages/teams/src/team.service.ts` (DbSlotRow type and mapping functions ONLY)

**Tasks:**

1. **Rename columns in Prisma schema:**
   - Read `prisma/schema.prisma`
   - In the `TeamSlot` model (starts ~line 114), change:
     - `evSpA` → `evSpa` (line 132)
     - `evSpD` → `evSpd` (line 133)
     - `ivSpA` → `ivSpa` (line 138)
     - `ivSpD` → `ivSpd` (line 139)

2. **Update DbSlotRow type:**
   - Read `packages/teams/src/team.service.ts`
   - In `DbSlotRow` type (lines 14-41), change:
     - `evSpA: number` → `evSpa: number` (line 32)
     - `evSpD: number` → `evSpd: number` (line 33)
     - `ivSpA: number` → `ivSpa: number` (line 38)
     - `ivSpD: number` → `ivSpd: number` (line 39)

3. **Update mapping functions:**
   - In `evsToDb` function: change `evSpA:` → `evSpa:` and `evSpD:` → `evSpd:`
   - In `ivsToDb` function: change `ivSpA:` → `ivSpa:` and `ivSpD:` → `ivSpd:`
   - In `dbSlotToDomain` function (lines 122-137): change `dbSlot.evSpA` → `dbSlot.evSpa`, `dbSlot.evSpD` → `dbSlot.evSpd`, `dbSlot.ivSpA` → `dbSlot.ivSpa`, `dbSlot.ivSpD` → `dbSlot.ivSpd`

4. **Regenerate Prisma client and push schema:**
   - Run: `pnpm db:push` (pushes schema changes to SQLite without migration file)
   - Run: `pnpm db:generate` (regenerates Prisma client)

5. **Run tests:** `pnpm test -- tests/teams/`

---

### Wave 2 — 2 Agents (After Wave 1)

These agents consume the canonical sources created in Wave 1.

---

#### Agent 4: Battle CRUD Service

**Violation:** S3
**Scope:** `packages/battle-engine/src/` (new file), `apps/web/src/app/api/battles/`, `apps/web/src/app/api/data/seed/route.ts`, `apps/web/src/app/pokemon/[id]/page.tsx`, `apps/web/src/app/api/teams/[teamId]/battles/stats/route.ts`

**Tasks:**

1. **Read ALL 10 API route files** listed under S3 to understand every Prisma query pattern
2. **Create `packages/battle-engine/src/battle.service.ts`:**
   - Import `prisma` from `@nasty-plot/db`
   - Extract each distinct Prisma query from the routes into a named function:
     - `listBattles(options)` — from battles/route.ts GET (paginated, filtered by format/gameType/batchId)
     - `createBattle(data)` — from battles/route.ts POST
     - `getBattle(id)` — from battles/[battleId]/route.ts GET
     - `deleteBattle(id)` — from battles/[battleId]/route.ts DELETE
     - `getBattleReplay(id)` — from battles/[battleId]/replay/route.ts GET
     - `getBattleForExport(id)` — from battles/[battleId]/export/route.ts GET
     - `createBatchSimulation(data)` — from battles/batch/route.ts POST
     - `getBatchSimulation(id)` — from battles/batch/[batchId]/route.ts GET
     - `deleteBatchSimulation(id)` — from battles/batch/[batchId]/route.ts DELETE
     - `getTeamBattleStats(teamId)` — from teams/[teamId]/battles/stats/route.ts GET
   - Follow existing service conventions: pure async functions, no classes
3. **Update `packages/battle-engine/src/index.ts`** — add exports for all new service functions
4. **Update all 10 route files** to import service functions instead of using direct Prisma
5. **Note on pokemon/[id]/page.tsx:** This file queries `prisma.format.findMany()` and `prisma.usageStats.findFirst()` — these are format/usage queries, NOT battle queries. Create helpers in the appropriate packages (formats, smogon-data) or leave as-is if there's no natural service owner.
6. **Run tests:** `pnpm test -- tests/api/ tests/battle-engine/`

---

#### Agent 5: Battle Engine & Package Consumer Updates

**Violations:** U1 (consumers), U2, I1, N1 (consumers)
**Scope:** `packages/pokemon-data/src/dex.service.ts`, `packages/battle-engine/src/protocol-parser.ts`, `packages/battle-engine/src/replay/replay-import.ts`, `packages/battle-engine/src/team-packer.ts`, `packages/battle-engine/src/index.ts`, `packages/smogon-data/src/set-inference.service.ts`, `packages/teams/src/import-export.service.ts`, `packages/teams/src/team-matcher.service.ts`, and ALL related test files

**Tasks:**

1. **Remove `toID` from pokemon-data (U1):**
   - Read `packages/pokemon-data/src/dex.service.ts`
   - Remove the private `toID` function (lines 8-10)
   - Add import: `import { toId } from "@nasty-plot/core"`
   - Replace all calls to `toID(...)` with `toId(...)` in this file

2. **Remove `toSpeciesId` from protocol-parser.ts (U1):**
   - Read `packages/battle-engine/src/protocol-parser.ts`
   - Find and remove the `toSpeciesId` function
   - Add import: `import { toId } from "@nasty-plot/core"`
   - Replace all calls to `toSpeciesId(...)` with `toId(...)` in this file

3. **Remove `toSpeciesId` from replay-import.ts and update N1 fields (U1 + N1):**
   - Read `packages/battle-engine/src/replay/replay-import.ts`
   - Remove the `toSpeciesId` function (lines 58-60)
   - Add `toId` to the import from `@nasty-plot/core` (line 8-13)
   - Replace all `toSpeciesId(...)` calls with `toId(...)`
   - Update all `ExtractedPokemonData` object construction to use new field names:
     - `speciesId` → `pokemonId`
     - `species` → `pokemonName`
   - The `ensurePokemon` function (~line 100) creates ExtractedPokemonData objects — update field names there

4. **Update set-inference.service.ts (N1):**
   - Read `packages/smogon-data/src/set-inference.service.ts`
   - Find all reads of `pokemon.speciesId` and change to `pokemon.pokemonId`
   - The deprecated type aliases (`ExtractedPokemon`, `ExtractedTeam`) can stay as-is (they alias the type, not the fields)

5. **Update import-export.service.ts (N1):**
   - Read `packages/teams/src/import-export.service.ts`
   - Find all reads of `p.speciesId` and change to `p.pokemonId`
   - Update the `resolveDefaultAbility(speciesId)` call if it reads from ExtractedPokemonData

6. **Update team-matcher.service.ts (N1):**
   - Read `packages/teams/src/team-matcher.service.ts`
   - Update function signatures: `pokemon: { speciesId: string; moves: string[] }[]` → `pokemon: { pokemonId: string; moves: string[] }[]`
   - Update internal accesses: `p.speciesId` → `p.pokemonId`
   - Do NOT rename `TeamFingerprint.speciesIds` — that's a different concept (the fingerprint's species list)

7. **Remove unused exports from battle-engine barrel (I1):**
   - Read `packages/battle-engine/src/index.ts`
   - Remove line 46: `export { formatShowdownLog, formatShowdownReplayJSON } from "./export/battle-export.service"`
   - Keep line 47: `export type { BattleRecord } from "./export/battle-export.service"` (if used)

8. **Remove `resolveSpeciesName` from team-packer.ts (U2):**
   - Read `packages/battle-engine/src/team-packer.ts`
   - Remove the private `resolveSpeciesName` function (lines 29-34)
   - Add import: `import { resolveSpeciesName } from "@nasty-plot/pokemon-data"`
   - All call sites remain the same

9. **Update ALL affected test files (N1):**
   - For tests that create `ExtractedPokemonData` objects (identified by `speciesId:` property in object literals passed to functions like `fingerprintFromExtracted`, `makeExtracted`, `inferFullTeam`, `createTeamFromExtractedData`):
     - Change `speciesId:` → `pokemonId:`
     - Change `species:` → `pokemonName:` (where present)
   - Test files to update:
     - `tests/teams/import-export.service.test.ts`
     - `tests/teams/team-matcher.test.ts` (ONLY the `fingerprintFromExtracted` calls)
     - `tests/smogon-data/set-inference.test.ts`
     - `tests/battle-engine/replay-import.test.ts`
   - **DO NOT** change test files that use `speciesId` for `BattlePokemon` objects (ai.test.ts, evaluator-hints.test.ts, mcts-ai.test.ts, ai-predictor-integration.test.ts, shared.test.ts, doubles-ai.test.ts, etc.)

10. **Run tests:** `pnpm test -- tests/battle-engine/ tests/smogon-data/ tests/teams/`

---

### Wave 3 — 2 Agents (After Wave 2)

---

#### Agent 6: Frontend Deduplication

**Violations:** F1, F2, F3, U3 (consumers)
**Scope:** `apps/web/src/`, `packages/ui/src/`

**Tasks:**

1. **Read `packages/ui/src/type-badge.tsx`** — understand the TypeBadge component API (props, what it renders)

2. **Replace inline type badges in 4 files (F1):**
   - For each file, read it, find inline `TYPE_COLORS[type]` + `isLightTypeColor()` patterns, replace with `<TypeBadge>` import from `@nasty-plot/ui`
   - Files: MoveSelector.tsx (TargetCard), TeraTypePicker.tsx, WeaknessHeatmap.tsx, CoverageChart.tsx
   - Adapt TypeBadge usage to each context (some are small/compact, some are clickable)

3. **Fix health bar duplication (F2):**
   - Read `apps/web/src/features/battle/components/HealthBar.tsx` to understand its API
   - Read `apps/web/src/features/battle/components/MoveSelector.tsx`
   - In TargetCard, replace inline HP color logic with HealthBar component or extract `getHealthColor` as a shared utility

4. **Replace status badge constants (F3):**
   - Read `apps/web/src/features/battle/components/BattleField.tsx` — find `STATUS_BADGE` object
   - Read `apps/web/src/features/battle/components/SwitchMenu.tsx` — find `STATUS_LABELS` + `STATUS_COLORS`
   - Replace both with `import { STATUS_BADGE_CONFIG } from "@nasty-plot/core"` (added in Wave 1)
   - Adapt rendering code to use the new shared config structure

5. **Replace `getBaseStatTotal` in web files (U3 consumers):**
   - Read `apps/web/src/app/api/pokemon/route.ts` — remove private `getBaseStatTotal`, add `import { getBaseStatTotal } from "@nasty-plot/core"`
   - Read `apps/web/src/app/pokemon/page.tsx` — same replacement

6. **Run tests:** `pnpm test`

---

#### Agent 7: Final Verification (read-only)

**Scope:** Entire codebase

**Tasks:**

1. Run `pnpm test` — full test suite, all 1894 tests must pass
2. Run `pnpm build` — build must succeed
3. Run these verification greps (all should return empty):

   ```bash
   # No duplicate toId/toSpeciesId functions
   grep -rn "function toID\b" packages/ --include="*.ts" | grep -v node_modules
   grep -rn "function toSpeciesId" packages/ --include="*.ts" | grep -v node_modules

   # No duplicate resolveSpeciesName
   grep -rn "function resolveSpeciesName" packages/ --include="*.ts" | grep -v "pokemon-data/src/dex.service" | grep -v node_modules

   # No duplicate getBaseStatTotal
   grep -rn "function getBaseStatTotal" apps/ packages/ --include="*.ts" --include="*.tsx" | grep -v "core/src/stat-calc" | grep -v node_modules

   # ExtractedPokemonData no longer has speciesId/species
   grep -n "speciesId" packages/core/src/types.ts
   # (should return nothing related to ExtractedPokemonData)

   # Removed constants
   grep -n "CURRENT_GENERATION\|MAX_IV\|MIN_IV" packages/core/src/constants.ts
   # (should return nothing)

   # No direct prisma in battles routes
   grep -rn "from \"@nasty-plot/db\"" apps/web/src/app/api/battles/ --include="*.ts"
   # (should return nothing)

   # Old DB column names gone
   grep -n "evSpA\|evSpD\|ivSpA\|ivSpD" prisma/schema.prisma
   # (should return nothing)
   ```

4. Report results

---

## Agent Prompt Template

Every execution agent should receive this preamble:

```
You are Agent {N}: `{name}` for the SSOT deduplication project.

**Read the full plan at plans/ssot-deduplication.md for context, then find YOUR agent section for specific tasks.**

**Rules:**
- Read each file BEFORE modifying it
- When a file already imports from a package, add to the existing import statement
- Run the specified tests after all changes
- If tests fail, investigate and fix the issue. If you can't fix it, revert your changes and report.
- Do NOT modify files outside your scope
- Do NOT change public API signatures unless the plan explicitly says to
- Do NOT add comments, docstrings, or type annotations to code you didn't change
- Do NOT add backward-compatibility aliases or re-exports

After completion, mark your task as completed using TaskUpdate.
```
