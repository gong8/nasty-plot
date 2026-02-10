# Deduplication: Single Source of Truth

**Goal:** Eliminate duplicate definitions across the codebase so every type, utility, constant, and service function has exactly one canonical location.

---

## 1. Duplicate Type Definitions

### 1a. ChatMessage — Incompatible Interfaces (HIGH)

- **`packages/core/src/types.ts`** — `id?: number`, has `toolCalls`, `createdAt`
- **`apps/web/src/features/chat/hooks/use-chat-stream.ts`** — `id: string`, minimal fields

**Fix:** Reconcile into a single interface in `@nasty-plot/core`. The web hook should import and extend or narrow the core type. If the UI needs a simpler shape, define a `ChatMessageUI` type derived from the core one.

### 1b. PageType — Exact Duplicate (MEDIUM)

- **`packages/llm/src/tool-context.ts`**
- **`apps/web/src/features/chat/context/page-context-provider.tsx`**

**Fix:** Delete the web copy. Import `PageType` from `@nasty-plot/llm`.

### 1c. PlanStep — Exact Duplicate (MEDIUM)

- **`apps/web/src/features/chat/components/chat-plan-display.tsx`**
- **`apps/web/src/features/chat/hooks/use-chat-stream.ts`**

**Fix:** Define `PlanStep` once in one of these files (or a shared `types.ts` in the chat feature) and import in the other.

---

## 2. Duplicate Utility Functions

### 2a. `cn()` — Identical Copy (HIGH)

- **`packages/ui/src/utils.ts`** (canonical)
- **`apps/web/src/lib/utils.ts`** (copy)

**Fix:** Delete `apps/web/src/lib/utils.ts`. Update all web app imports to use `import { cn } from "@nasty-plot/ui"`.

### 2b. `resolveSpeciesName()` — Identical (HIGH)

- **`packages/battle-engine/src/team-packer.ts`**
- **`packages/damage-calc/src/calc.service.ts`**

**Fix:** Move to `packages/pokemon-data/src/dex.service.ts` as an exported function (it already wraps `Dex.species.get()`). Import in both consumers.

### 2c. `flattenDamage()` — Near-Identical (HIGH)

- **`packages/battle-engine/src/ai/shared.ts`** (exported)
- **`packages/damage-calc/src/calc.service.ts`** (private)

**Fix:** Keep the exported version in `battle-engine/src/ai/shared.ts` or move to `packages/damage-calc` as the canonical export. The other package imports it. Alternatively, if both packages shouldn't depend on each other, move to `@nasty-plot/core`.

### 2d. `getTypeEffectiveness()` — Different Implementations (MEDIUM)

- **`packages/core/src/type-chart.ts`** — uses `TYPE_CHART` constant
- **`packages/battle-engine/src/ai/shared.ts`** — uses `@pkmn/dex` `damageTaken` encoding

**Fix:** Audit both for correctness. Standardize on the core version and have battle-engine import from `@nasty-plot/core`. Remove the battle-engine copy.

### 2e. Status Move Scoring — Near-Identical (MEDIUM)

- **`packages/battle-engine/src/ai/hint-engine.ts`** (`estimateStatusMoveScore`)
- **`packages/battle-engine/src/ai/heuristic-ai.ts`** (`scoreStatusMove`)

**Fix:** Extract shared scoring logic into `battle-engine/src/ai/shared.ts` and import in both AI modules.

---

## 3. Duplicate Constants

### 3a. `DEFAULT_IVS` — Redefined (HIGH)

- **`packages/core/src/constants.ts`** (canonical)
- **`packages/mcp-server/src/tools/team-crud.ts`** (local copy)

**Fix:** Delete the mcp-server copy. Import from `@nasty-plot/core`.

### 3b. `DEFAULT_EVS` / Zero EVs — Scattered Inline (MEDIUM)

- **`packages/core/src/constants.ts`** (canonical `DEFAULT_EVS`)
- **`packages/mcp-server/src/tools/team-crud.ts`** (local `ZERO_EVS`)
- **18+ test files** hardcode `{ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }`
- **Web components** (`slot-editor.tsx`, `simplified-set-editor.tsx`, `damage-calculator.tsx`)
- **`battle-engine/src/protocol-parser.ts`**

**Fix:** Import `DEFAULT_EVS` from `@nasty-plot/core` in all production code. For test files, consider a shared test helper or import from core directly.

### 3c. `MCP_URL` — Duplicated in Same Package (LOW)

- **`packages/llm/src/mcp-client.ts`**
- **`packages/llm/src/cli-chat.ts`**

**Fix:** Extract to `packages/llm/src/constants.ts` and import in both.

### 3d. Default Level (100) — Hardcoded (LOW)

- `packages/core/src/showdown-paste.ts`
- `packages/battle-engine/src/protocol-parser.ts`
- `packages/damage-calc/src/calc.service.ts`
- `packages/analysis/src/analysis.service.ts`

**Fix:** Add `DEFAULT_LEVEL = 100` (and `VGC_LEVEL = 50`, `LC_LEVEL = 5`) to `packages/core/src/constants.ts`. Import where needed.

---

## 4. Duplicate Service Logic

### 4a. DB Slot to Domain Mapping — Near-Identical (HIGH)

- **`packages/analysis/src/analysis.service.ts`** (`analyzeTeam()` inline)
- **`packages/recommendations/src/composite-recommender.ts`** (`dbSlotToDomain()`)

Both do the same Prisma TeamSlot row → `TeamSlotData` conversion (EVs columns → StatsTable, move1-4 → array, Dex hydration).

**Fix:** Extract a `dbSlotToTeamSlotData()` function into `@nasty-plot/teams` (which already owns team CRUD) and import in both packages.

### 4b. Direct `@pkmn/dex` Calls Bypassing `pokemon-data` (MEDIUM)

Packages that call `Dex` directly instead of using `@nasty-plot/pokemon-data`:

- `packages/battle-engine/src/ai/shared.ts`
- `packages/battle-engine/src/ai/heuristic-ai.ts`
- `packages/battle-engine/src/ai/hint-engine.ts`
- `packages/recommendations/src/coverage-recommender.ts`
- `packages/recommendations/src/usage-recommender.ts`
- `packages/recommendations/src/composite-recommender.ts`
- `packages/analysis/src/threat.service.ts`
- `packages/analysis/src/analysis.service.ts`

**Fix:** Add any missing wrapper functions to `packages/pokemon-data/src/dex.service.ts` (e.g. `getMove()`, `getMoveByName()`). Update consumers to import from `@nasty-plot/pokemon-data` instead of `@pkmn/dex` directly. This preserves the dependency layer abstraction.

---

## 5. Naming Issue (LOW)

**`apps/web/src/features/battle/components/PokemonSprite.tsx`** exports `BattleSprite` — not a true duplicate of `packages/ui/src/pokemon-sprite.tsx`, but the filename is misleading.

**Fix:** Rename file to `battle-sprite.tsx` to match the export.

---

## Execution Order

1. **Types first** (1a, 1b, 1c) — no runtime risk, just import changes
2. **Constants** (3a, 3b) — safe find-and-replace
3. **Utility functions** (2a, 2b, 2c) — move + update imports
4. **Service logic** (4a, 4b) — extract shared functions, update consumers
5. **AI dedup** (2d, 2e) — requires careful testing of battle AI behavior
6. **Cleanup** (3c, 3d, 5) — low-priority polish
