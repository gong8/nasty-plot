# Wave 3 Prompt — SSOT Deduplication

## Context

You are continuing the SSOT (Single Source of Truth) deduplication project. Waves 1 and 2 are complete. All 1896 tests pass across 80 test files. This prompt describes Wave 3: the final wave.

**Full plan:** `plans/deduplication-single-source-of-truth.md` — read it for full context on the 48 violations and decisions.

**All decisions are pre-approved in the plan's "Decisions (Pre-Approved)" section — do NOT re-ask them.**

---

## What Was Done in Waves 1 & 2

### Wave 1 (5 agents, complete)

- **constants-author**: Added `DEFAULT_LEVEL`, `VGC_LEVEL`, `LC_LEVEL`, `DEFAULT_FORMAT_ID`, `WEATHERS`, `TERRAINS`, `STATUSES`, `BOOST_VALUES`, `ARCHETYPE_OPTIONS` to `packages/core/src/constants.ts`
- **mcp-deduper**: Deleted inline TYPE_CHART, NATURES_DATA, FORMATS_LIST from MCP resources. Deleted local DEFAULT_IVS/ZERO_EVS from team-crud.ts. All imported from core/formats.
- **cn-sweeper**: Deleted `apps/web/src/lib/utils.ts`, updated 72+ imports to `import { cn } from "@nasty-plot/ui"`
- **types-consolidator**: Fixed all 13 type violations (T1-T13). `PageType`, `ExtractedPokemonData` moved to core. `UIChatMessage` renamed. `ShowdownReplayJSON`, `DexMove`, `BattleFormat→GameType` unified. `BattleSummary`, `TeamValidation`, `SortMode` deduplicated in web.
- **llm-deduper**: Created `packages/llm/src/config.ts` with `MCP_URL` and `MODEL`. `tool-labels.ts` derives keys from `TOOL_CATEGORIES`.

### Wave 2 (6 agents, complete)

- **constants-sweeper-packages**: Replaced `DEFAULT_LEVEL`, `DEFAULT_FORMAT_ID`, `DEFAULT_EVS`, `STATS`, `MAX_TOTAL_EVS`/`MAX_SINGLE_EV` in all `packages/` files
- **constants-sweeper-web**: Replaced all hardcoded constants in `apps/web/` with core imports
- **constants-sweeper-tests**: Replaced `DEFAULT_IVS`, `DEFAULT_EVS`, `DEFAULT_LEVEL` in 17 test files
- **pokemon-data-expander**: `getMove()`, `getAbility()`, `getItem()` **already existed**. No new wrappers were actually added (see "Gaps" below).
- **util-deduper**: `flattenDamage` exported from damage-calc, imported in battle-engine. `teamToShowdownPaste` now wraps `serializeShowdownPaste` from core. `serializeBattleState` moved to `packages/battle-engine/src/battle-state-serializer.ts`. Status move score constants extracted to `shared.ts`.
- **frontend-components**: Created `MoveInput`, `NatureSelector`, `TeraTypePicker` shared components. Replaced inline TypeBadge usage in 4 files.

### Deviations from Plan (IMPORTANT — read these!)

1. **U4 (getTypeEffectiveness) — intentionally kept local**: The battle-engine version in `packages/battle-engine/src/ai/shared.ts` uses `@pkmn/dex` **defensive** `damageTaken` encoding (returns how much damage defTypes deal TO atkType). Core's version uses offensive TYPE_CHART semantics. These are fundamentally different. The battle-engine copy was kept with a docstring explaining this. Core's type signature was widened to accept `string`.

2. **`gen9` / `getGen9()` NOT added to pokemon-data**: Despite the agent reporting success, `packages/pokemon-data/src/dex.service.ts` does NOT export a shared `Generations` instance. Four files still create their own `new Generations(Dex).get(9)`:
   - `packages/damage-calc/src/calc.service.ts:12`
   - `packages/battle-engine/src/ai/heuristic-ai.ts:27`
   - `packages/battle-engine/src/ai/greedy-ai.ts:8`
   - `packages/battle-engine/src/ai/hint-engine.ts:18`

3. **`resolveSpeciesName()` NOT added to pokemon-data**: Was supposed to be added in Wave 2 but wasn't. Still exists locally in `packages/damage-calc/src/calc.service.ts:70`.

4. **`getType()` NOT added to pokemon-data**: Not yet available as a wrapper.

5. **`getMoveByName()` NOT needed**: `getMove()` already accepts name or ID.

6. **`DexMove` type in `battle-engine/src/types.ts:16`** uses `import { Dex } from "@pkmn/dex"` for `ReturnType<typeof Dex.moves.get>`. This is a type-level-only import but still creates a dependency.

7. **`getTypeEffectiveness` in `battle-engine/src/ai/shared.ts`** still uses `Dex.types.get()` directly. Since this function was intentionally kept (different semantics), it still needs `@pkmn/dex`.

---

## Current State — `@pkmn/dex` Imports Still Present

13 files in `packages/` still import directly from `@pkmn/dex` (excluding `pokemon-data` itself which is canonical):

```
packages/battle-engine/src/types.ts          — DexMove type definition only
packages/battle-engine/src/team-packer.ts    — Dex.species.get() (1 call)
packages/battle-engine/src/protocol-parser.ts — const dex = Dex.forGen(9) (module-level)
packages/battle-engine/src/ai/shared.ts      — Dex.species.get() + Dex.types.get()
packages/battle-engine/src/ai/greedy-ai.ts   — new Generations(Dex) + @smogon/calc
packages/battle-engine/src/ai/heuristic-ai.ts — Dex.moves.get() + new Generations(Dex) + @smogon/calc
packages/battle-engine/src/ai/hint-engine.ts  — Dex.moves.get() + new Generations(Dex) + @smogon/calc
packages/damage-calc/src/calc.service.ts      — Dex.species.get() + new Generations(Dex)
packages/analysis/src/analysis.service.ts     — Dex.species.get() (2 calls)
packages/analysis/src/threat.service.ts       — Dex.species.get() (1 call)
packages/recommendations/src/coverage-recommender.ts  — Dex.species.get() + Dex.species.all()
packages/recommendations/src/composite-recommender.ts — Dex.species.get()
packages/recommendations/src/usage-recommender.ts     — Dex.species.get()
```

---

## Wave 3 — What Needs to Be Done

Spawn 5 agents in parallel. All are `subagent_type: general-purpose`.

**IMPORTANT pre-task:** Before spawning the 5 agents, first add the missing pokemon-data wrappers that Wave 2 failed to add. Add these to `packages/pokemon-data/src/dex.service.ts` and export from the barrel:

```ts
// Lazy gen9 instance for @smogon/calc consumers
import { Generations } from "@pkmn/data"
let _gen9: ReturnType<ReturnType<typeof Generations.prototype.get>> | null = null
export function getGen9() {
  if (!_gen9) {
    _gen9 = new Generations(Dex).get(9)
  }
  return _gen9
}

// Raw Dex access for type-level utilities (used by DexMove type)
export function getRawMove(nameOrId: string) {
  return dex.moves.get(nameOrId)
}

export function getRawSpecies(nameOrId: string) {
  return dex.species.get(nameOrId)
}

export function getType(name: string) {
  return dex.types.get(name)
}

export function resolveSpeciesName(pokemonId: string): string {
  const species = dex.species.get(pokemonId)
  if (species?.exists) return species.name
  return pokemonId.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (s) => s.toUpperCase())
}
```

Ensure `@pkmn/data` is in `packages/pokemon-data/package.json` dependencies. Export all new functions from `packages/pokemon-data/src/index.ts`. Then run `pnpm test` to verify before spawning agents.

**Note on `getGen9()` vs `gen9` constant:** Use a lazy function, NOT a module-level constant. Eagerly creating `new Generations(Dex).get(9)` at import time crashes tests that mock `@pkmn/dex` (e.g., recommendations tests).

---

### Agent 12: `dex-migrator-battle-engine`

**Scope:** Migrate 6 battle-engine files from `@pkmn/dex` to `@nasty-plot/pokemon-data`.

**Read files before editing. Do not guess at file contents.**

**Tasks:**

1. **`packages/battle-engine/src/types.ts`** — Replace `import { Dex } from "@pkmn/dex"` + `type DexMove = ReturnType<typeof Dex.moves.get>` with `import { getRawMove } from "@nasty-plot/pokemon-data"` + `type DexMove = ReturnType<typeof getRawMove>`.

2. **`packages/battle-engine/src/team-packer.ts`** — Replace `Dex.species.get()` with `getRawSpecies()` from `@nasty-plot/pokemon-data`. This file needs the raw species object (with `.name`), not the mapped `PokemonSpecies`. Remove `@pkmn/dex` import.

3. **`packages/battle-engine/src/protocol-parser.ts`** — Replace `const dex = Dex.forGen(9)` module-level Dex with imports from `@nasty-plot/pokemon-data`. Check what `dex.species.get()` and `dex.moves.get()` calls exist and replace with `getRawSpecies()` / `getRawMove()` or `getSpecies()` / `getMove()` as appropriate (use raw versions if they need fields not in the mapped types). Remove `@pkmn/dex` import.

4. **`packages/battle-engine/src/ai/shared.ts`** — Replace `Dex.species.get()` with `getRawSpecies()`. The local `getTypeEffectiveness` uses `Dex.types.get()` — replace with `getType()` from pokemon-data. Remove `@pkmn/dex` import.

5. **`packages/battle-engine/src/ai/greedy-ai.ts`** — Replace `new Generations(Dex).get(9)` with `getGen9()` from pokemon-data. Remove `@pkmn/dex` and `@pkmn/data` imports.

6. **`packages/battle-engine/src/ai/heuristic-ai.ts`** — Replace `Dex.moves.get()` with `getRawMove()` from pokemon-data (AI files need the raw Dex move object with `.basePower`, `.type`, `.category`, `.flags`, etc.). Replace `new Generations(Dex).get(9)` with `getGen9()`. Remove `@pkmn/dex` and `@pkmn/data` imports.

7. **`packages/battle-engine/src/ai/hint-engine.ts`** — Same as heuristic-ai: replace `Dex.moves.get()` with `getRawMove()`, replace `new Generations(Dex).get(9)` with `getGen9()`. Remove `@pkmn/dex` and `@pkmn/data` imports.

8. Update `packages/battle-engine/package.json`: add `"@nasty-plot/pokemon-data": "workspace:*"` dependency. Keep `@pkmn/dex` if `@pkmn/sim` still needs it (check), otherwise remove.

9. Run `pnpm test -- tests/battle-engine/` to verify.

---

### Agent 13: `dex-migrator-other`

**Scope:** Migrate 6 non-battle-engine files from `@pkmn/dex` to `@nasty-plot/pokemon-data`.

**Read files before editing. Do not guess at file contents.**

**Tasks:**

1. **`packages/recommendations/src/coverage-recommender.ts`** — Replace `Dex.species.get()` calls with `getSpecies()` from pokemon-data (mapped version is fine here, it returns `PokemonSpecies`). Replace `Dex.species.all()` in `getAllLegalSpeciesIds()` with `getAllSpecies()` from pokemon-data — adjust the filter logic since `getAllSpecies()` already filters out nonstandard. Remove `@pkmn/dex` import. Also replace `prisma.usageStats.findMany()` with `getUsageStats()` from `@nasty-plot/smogon-data` (see S3 in plan).

2. **`packages/recommendations/src/usage-recommender.ts`** — Replace `Dex.species.get()` with `getSpecies()`. Remove `@pkmn/dex` import.

3. **`packages/recommendations/src/composite-recommender.ts`** — Replace `Dex.species.get()` with `getSpecies()`. Remove `@pkmn/dex` import. Note: this file also has a local `dbSlotToDomain` — Agent 14 handles that separately.

4. **`packages/analysis/src/threat.service.ts`** — Replace `Dex.species.get()` with `getSpecies()`. Also replace `prisma.usageStats.findMany()` with `getUsageStats()` from `@nasty-plot/smogon-data`. Remove `@pkmn/dex` import.

5. **`packages/analysis/src/analysis.service.ts`** — This file has a dynamic `import("@pkmn/dex")`. Replace with static import from `@nasty-plot/pokemon-data`. Replace all `Dex.species.get()` calls with `getSpecies()`. Also replace `prisma.usageStats.findMany()` with `getUsageStats()`. Remove `@pkmn/dex` import.

6. **`packages/damage-calc/src/calc.service.ts`** — Replace `Dex.species.get()` with `getRawSpecies()` from pokemon-data (this file uses `.name` for `@smogon/calc` which needs display names). Delete the local `resolveSpeciesName()` function (lines ~70-74), import from `@nasty-plot/pokemon-data`. Replace `new Generations(Dex).get(9)` with `getGen9()`. Remove `@pkmn/dex` and `@pkmn/data` imports.

7. Update `package.json` in each package: add `"@nasty-plot/pokemon-data": "workspace:*"` and `"@nasty-plot/smogon-data": "workspace:*"` (where S3 applies). Remove `@pkmn/dex` from packages that no longer need it.

8. Run `pnpm test -- tests/recommendations/ tests/analysis/ tests/damage-calc/` to verify.

**Note on `getUsageStats`:** Check `packages/smogon-data/src/usage-stats.service.ts` for the `getUsageStats()` function signature. It should accept `(formatId, options?)` with a `limit` field. If it doesn't support `limit`, add it. The direct prisma calls that need replacing are:

- `analysis.service.ts:129` — `take: 20`
- `threat.service.ts:23` — `take: 50`
- `coverage-recommender.ts:28` — `take: 100`
- `apps/web/src/app/api/damage-calc/matchup-matrix/route.ts:37` — `take: 10` (this is a web route, handle it too)

---

### Agent 14: `service-deduper`

**Scope:** Deduplicate service logic — `dbSlotToDomain` (S1), format resolution (S6).

**Read files before editing. Do not guess at file contents.**

**Tasks:**

1. **`dbSlotToDomain` (S1) — 4 copies → 1:**
   - Read the canonical `dbSlotToDomain` in `packages/teams/src/team.service.ts` (around line 104-139).
   - Export it from `packages/teams/src/index.ts` barrel.
   - In `packages/recommendations/src/composite-recommender.ts`: delete local `dbSlotToDomain` (around lines 128-179). Import from `@nasty-plot/teams`.
   - In `packages/analysis/src/analysis.service.ts`: delete inline mapping (around lines 32-75). Import `dbSlotToDomain` from `@nasty-plot/teams`.
   - In `packages/teams/src/version.service.ts`: replace inline mapping (around lines 483-510) with call to `dbSlotToDomain` from `./team.service` (same package, relative import).
   - Verify `@nasty-plot/teams` is in the `dependencies` of `packages/recommendations/package.json` and `packages/analysis/package.json`. Add if missing.

2. **Format resolution (S6):**
   - Read `packages/formats/src/resolver.ts` (canonical `resolveFormatId`).
   - Read `packages/smogon-data/src/set-inference.service.ts` around lines 70-108 (`buildFormatFallbacks`).
   - Extend `resolveFormatId` in `@nasty-plot/formats` to handle the cases `buildFormatFallbacks` covers (bo3/bo5 suffix stripping, VGC year fallbacks, regulation stripping).
   - In `set-inference.service.ts`: delete `buildFormatFallbacks`. Import `resolveFormatId` from `@nasty-plot/formats`. Adapt calling code to use `resolveFormatId` with appropriate fallback chain.
   - Add `@nasty-plot/formats` as dependency of `packages/smogon-data/package.json` if not already present.

3. Run `pnpm test` to verify.

---

### Agent 15: `calc-boilerplate`

**Scope:** Reduce `@smogon/calc` boilerplate in battle-engine AI files (S7).

**Read files before editing. Do not guess at file contents.**

**Tasks:**

1. Read the damage calculation pattern in all three AI files:
   - `packages/battle-engine/src/ai/greedy-ai.ts`
   - `packages/battle-engine/src/ai/heuristic-ai.ts`
   - `packages/battle-engine/src/ai/hint-engine.ts`

2. All three construct `new Pokemon(gen, name, {...})` from `BattlePokemon` data, then `new Move(gen, moveName)`, then call `calculate(gen, attacker, defender, move)`. This boilerplate is repeated in each file.

3. Add a helper to `packages/battle-engine/src/ai/shared.ts`:

   ```ts
   import { Pokemon, Move, calculate, Field } from "@smogon/calc"
   import type { Result } from "@smogon/calc"
   import { getGen9 } from "@nasty-plot/pokemon-data"

   export function calculateBattleDamage(
     attacker: BattlePokemon,
     defender: BattlePokemon,
     moveName: string,
     field?: Partial<Field>,
   ): { damage: number[]; result: Result } {
     const gen = getGen9()
     // ... construct Pokemon instances from BattlePokemon data
     // ... construct Move
     // ... call calculate()
     // ... flatten damage
   }
   ```

   Look at how each AI file constructs the calc objects and extract the common pattern. Account for differences (e.g., field conditions, ability/item/nature mapping).

4. Refactor all 3 AI files to use `calculateBattleDamage()` instead of inline construction.

5. Run `pnpm test -- tests/battle-engine/` to verify — AI behavior must not change.

---

### Agent 16: `frontend-cleanup`

**Scope:** Remaining frontend cleanup (F4, F7, F8). F5/F6 were done in Wave 2.

**Read files before editing. Do not guess at file contents.**

**Tasks:**

1. **Sample teams from DB (F4):** In `apps/web/src/features/battle/components/BattleSetup.tsx` and `apps/web/src/app/battle/simulate/page.tsx`:
   - Delete hardcoded `SAMPLE_TEAM_1` and `SAMPLE_TEAM_2` paste strings.
   - Replace with a fetch to `GET /api/sample-teams?formatId=${formatId}&limit=2` (or similar).
   - Use the fetched sample teams as defaults. Handle loading state gracefully (show a spinner or disabled state while loading).
   - Per the pre-approved decision: "Load from DB via existing SampleTeam API. Do NOT use shared constants."

2. **Shared query hooks (F7):** Create `apps/web/src/features/team-builder/hooks/use-pokemon-data.ts`:

   ```ts
   export function usePokemonQuery(pokemonId: string | null) { ... }
   export function useLearnsetQuery(pokemonId: string | null) { ... }
   ```

   Extract the shared `fetch("/api/pokemon/${id}")` and `fetch("/api/pokemon/${id}/learnset")` patterns from `slot-editor.tsx`, `simplified-set-editor.tsx`, and `page-context-provider.tsx`. Update all three to use the shared hooks.

3. **`SampleTeamCard` sprites (F8):** In `apps/web/src/features/battle/components/SampleTeamCard.tsx`:
   - Replace inline `Sprites.getPokemon()` + `<img>` with `<PokemonSprite>` from `@nasty-plot/ui`.

4. Run `pnpm build` to verify.

---

## Execution Instructions

1. **First:** Add missing pokemon-data wrappers (see "pre-task" section above). Run `pnpm test` to verify.
2. **Then:** Create a team with `TeamCreate` named `ssot-wave3`. Create 5 tasks (one per agent). Spawn all 5 agents in parallel via `Task` tool with `team_name: "ssot-wave3"` and `subagent_type: "general-purpose"`.
3. **After all agents complete:** Run `pnpm test` to verify no regressions.
4. **Post-execution verification:** Run these grep checks:

   ```bash
   # No remaining @pkmn/dex imports outside pokemon-data
   grep -r 'from ["'"'"']@pkmn/dex["'"'"']' packages/ --include="*.ts" | grep -v pokemon-data | grep -v node_modules

   # No remaining @/lib/utils imports
   grep -r '@/lib/utils' apps/web/

   # No remaining inline zero EVs in production code
   grep -r 'hp: 0, atk: 0, def: 0' packages/ apps/web/src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v test
   ```

5. **Fix any lint errors:** Run `eslint --fix` and fix any remaining unused import warnings.
6. **Run `pnpm build`** to verify the full build passes.
7. Write session summary to `sessions/`.

---

## Key Gotchas

- **`@pkmn/dex` damageTaken encoding:** `0`=neutral, `1`=super effective, `2`=resist, `3`=immune (counterintuitive!)
- **`@smogon/calc` needs display names:** `"Great Tusk"` not `"greatTusk"` — use `species.name` or `resolveSpeciesName()`
- **Lazy `getGen9()`:** Use a lazy function, NOT a module-level constant, to avoid crashing mocked tests
- **`getSpecies()` returns `PokemonSpecies | null`** (mapped type) vs **`getRawSpecies()` returns raw Dex object** — AI files that use `.exists`, `.types`, `.baseStats` directly may need the raw version
- **`getMove()` returns `MoveData | null`** (mapped type) vs **`getRawMove()` returns raw Dex move** — AI files that need `.flags`, `.priority`, `.secondary`, `.target` etc. need the raw version
- **battle-engine's `getTypeEffectiveness`** has different semantics from core's — it was intentionally kept. Don't delete it.
- **When a file already imports from a package**, add to the existing import instead of adding a new import line
- **`packages/battle-engine` may still need `@pkmn/dex` as a transitive dep** because `@pkmn/sim` depends on it. Check before removing from package.json.
