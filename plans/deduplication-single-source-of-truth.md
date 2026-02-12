# Deduplication: Single Source of Truth

**Goal:** Eliminate duplicate definitions across the codebase so every type, utility, constant, and service function has exactly one canonical location.

**Audit date:** 2026-02-12
**Status:** 48 violations across 150+ files. Zero from original plan addressed.

---

## 1. Duplicate Type Definitions (13 violations)

### CRITICAL / HIGH

#### T1. ChatMessage — Divergent Interfaces (HIGH)

- **`packages/core/src/types.ts:409`** — `id?: number`, `role: ChatRole` (includes "system"), `toolCalls`, `metadata`, `createdAt`
- **`apps/web/src/features/chat/hooks/use-chat-stream.ts:9`** — `id: string`, `role: "user" | "assistant"` (no "system"), no `toolCalls`/`createdAt`

**Fix:** Rename web version to `UIChatMessage`. Derive from core: `Omit<ChatMessage, 'id'> & { id: string }` or define as a narrowed pick.

#### T2. ExtractedPokemon[Data] — Near-Identical (HIGH)

- **`packages/battle-engine/src/replay/replay-import.ts:17`** — `ExtractedPokemonData` with `nickname?` field
- **`packages/smogon-data/src/set-inference.service.ts:9`** — `ExtractedPokemon` without `nickname?`

Comment in smogon-data says "matches battle-engine's ExtractedPokemonData".

**Fix:** Move to `@nasty-plot/core`. Include `nickname?` as optional. Delete both copies.

#### T3. SampleTeamData — Missing Field (HIGH)

- **`packages/teams/src/sample-team.service.ts:4`** — canonical, has `createdAt: Date`
- **`apps/web/src/features/battle/hooks/use-sample-teams.ts:5`** — missing `createdAt`

**Fix:** Import from `@nasty-plot/teams`. Use `Omit<SampleTeamData, 'createdAt'>` if needed.

#### T4. SampleTeamEntry — 4 Divergent Variants (HIGH)

- **`packages/data-pipeline/src/data/sample-teams.ts:1`** — seed input: `{ name, formatId, archetype: string, paste, source: string }`
- **`apps/web/src/features/team-builder/hooks/use-guided-builder.ts:33`** — runtime: `{ id, pokemonIds: string[], archetype?, ... }`
- **`packages/teams/src/sample-team.service.ts:4`** — DB output: `{ pokemonIds: string, createdAt, ... }`
- **`apps/web/src/app/battle/sample-teams/page.tsx:20`** — `interface SampleTeam` (yet another variant)

**Fix:** Rename data-pipeline type to `SampleTeamSeedEntry`. Canonical runtime type = `SampleTeamData` from `@nasty-plot/teams`. Web imports from teams.

#### T5. TeamBattleAnalytics — Identical Copy-Paste (HIGH)

- **`packages/battle-engine/src/battle-history.service.ts:9`** — canonical, exported via barrel
- **`apps/web/src/features/battle/hooks/use-team-battles.ts:28`** — identical copy

**Fix:** Delete web copy. Import from `@nasty-plot/battle-engine`.

### MEDIUM

#### T6. PageType — Exact Duplicate

- **`packages/llm/src/tool-context.ts:49`**
- **`apps/web/src/features/chat/context/page-context-provider.tsx:15`**

**Fix:** Move to `@nasty-plot/core`. Delete both copies, import from core.

#### T7. ShowdownReplayJSON/Json — Divergent (same package)

- **`packages/battle-engine/src/export/battle-export.service.ts:22`** — `ShowdownReplayJSON` with `format`, `turns`, `winner`
- **`packages/battle-engine/src/replay/replay-import.ts:8`** — `ShowdownReplayJson` with `formatid`, `rating`

**Fix:** Unify into one interface in `battle-engine/src/types.ts` with all fields optional as needed.

#### T8. BattleSummary — Subset vs Superset (within web)

- **`apps/web/src/app/battle/page.tsx:32`** — 10 fields
- **`apps/web/src/features/battle/hooks/use-team-battles.ts:5`** — same + `team1Id`, `team2Id`, `batchId`

**Fix:** Single definition in a shared `apps/web/src/features/battle/types.ts`. Use the superset.

#### T9. SortMode — Exact Duplicate (within web)

- **`apps/web/src/app/api/pokemon/route.ts:7`**
- **`apps/web/src/app/pokemon/page.tsx:30`**

**Fix:** Define once in `apps/web/src/features/pokemon/types.ts`. Import in both.

#### T10. TeamValidation — Exact Duplicate (within web)

- **`apps/web/src/features/battle/components/TeamPicker.tsx:20`**
- **`apps/web/src/features/battle/components/BattleSetup.tsx:190`**

**Fix:** Define once in `apps/web/src/features/battle/types.ts`. Import in both.

### LOW

#### T11. PlanStep — Exact Duplicate (within web)

- **`apps/web/src/features/chat/hooks/use-chat-stream.ts:30`**
- **`apps/web/src/features/chat/components/chat-plan-display.tsx:6`**

**Fix:** Delete from component. Import from hook.

#### T12. BattleFormat vs GameType — Same Values, Different Names

- **`packages/battle-engine/src/types.ts:12`** — `type BattleFormat = "singles" | "doubles"`
- **`packages/core/src/types.ts:115`** — `type GameType = "singles" | "doubles"`

**Fix:** Delete `BattleFormat`. Use `GameType` from core.

#### T13. DexMove — Exact Duplicate (within battle-engine)

- **`packages/battle-engine/src/ai/hint-engine.ts:11`**
- **`packages/battle-engine/src/ai/heuristic-ai.ts:19`**

**Fix:** Define once in `battle-engine/src/types.ts`. Import in both.

---

## 2. Duplicate Utility Functions (7 violations)

#### U1. `cn()` — Identical Copy (HIGH) — 72 consumers

- **`packages/ui/src/utils.ts:4`** (canonical)
- **`apps/web/src/lib/utils.ts:4`** (copy)

72 files in `apps/web/` import from `@/lib/utils` instead of `@nasty-plot/ui`.

**Fix:** Delete `apps/web/src/lib/utils.ts`. Update all 72 imports to `import { cn } from "@nasty-plot/ui"`.

#### U2. `resolveSpeciesName()` — Triplicated (HIGH)

- **`packages/damage-calc/src/calc.service.ts:70`** (private)
- **`packages/battle-engine/src/team-packer.ts:15`** (private)
- **`packages/battle-engine/src/protocol-parser.ts:1007`** (inline regex)

All do `Dex.species.get(pokemonId)` with camelCase→display fallback regex.

**Fix:** Move to `packages/pokemon-data/src/dex.service.ts` as exported function. Import in all 3 consumers.

#### U3. `flattenDamage()` — Near-Identical (HIGH)

- **`packages/battle-engine/src/ai/shared.ts:9`** (exported)
- **`packages/damage-calc/src/calc.service.ts:80`** (private)

Same logic, minor structural differences.

**Fix:** Move to `@nasty-plot/damage-calc` as canonical export. Import in battle-engine.

#### U4. `getTypeEffectiveness()` — Different Implementations (HIGH) — 11+ consumers

- **`packages/core/src/type-chart.ts:7`** — uses `TYPE_CHART` constant (canonical)
- **`packages/battle-engine/src/ai/shared.ts:28`** — uses `@pkmn/dex` `damageTaken` encoding

Core version uses `PokemonType`, battle-engine uses `string`. Both produce same results.

**Fix:** Widen core version to accept `string`. Delete battle-engine copy. Import from `@nasty-plot/core` in all AI files.

#### U5. `teamToShowdownPaste()` / `serializeShowdownPaste()` — Duplicate (MEDIUM)

- **`packages/core/src/showdown-paste.ts:135`** — `serializeShowdownPaste()` (canonical)
- **`packages/battle-engine/src/team-packer.ts:86`** — `teamToShowdownPaste()` (copy)

**Fix:** Delete battle-engine copy. Import from `@nasty-plot/core`.

#### U6. `serializeBattleState()` — Misplaced (MEDIUM)

- **`apps/web/src/features/chat/context/page-context-provider.tsx:79-247`** — ~170 lines

Data transformation producing LLM-readable text. Should be in a package.

**Fix:** Move to `@nasty-plot/battle-engine` (or `@nasty-plot/llm`). Import in web.

#### U7. Status Move Scoring — Parallel Systems (LOW)

- **`packages/battle-engine/src/ai/hint-engine.ts:113`** — `estimateStatusMoveScore()` (returns `{ score, explanation }`)
- **`packages/battle-engine/src/ai/heuristic-ai.ts:196`** — `scoreStatusMove()` (returns `number`)

Intentionally different (explanations vs numeric), but share hardcoded score values.

**Fix:** Extract shared base score constants to `battle-engine/src/ai/shared.ts`. Both functions import the constants but keep their own logic.

---

## 3. Duplicate Constants (12 violations)

### HIGH — Data Constants (copy-pasted into MCP server)

#### C1. `TYPE_CHART` — Full 85-Line Copy

- **`packages/core/src/constants.ts:68-121`** (canonical)
- **`packages/mcp-server/src/resources/index.ts:5-90`** (copy)

**Fix:** Import from `@nasty-plot/core`.

#### C2. `NATURE_DATA` — Full Copy

- **`packages/core/src/constants.ts:5-31`** (canonical)
- **`packages/mcp-server/src/resources/index.ts:92-118`** (copy, omits `name` field)

**Fix:** Import from `@nasty-plot/core`. Transform if needed.

#### C3. `FORMATS_LIST` — Stale, Incomplete, HAS BUG

- **`packages/formats/src/data/format-definitions.ts`** (canonical, 18+ formats)
- **`packages/mcp-server/src/resources/index.ts:147-156`** (8 formats, BUG: `"gen9uber"` should be `"gen9ubers"`)

Missing: gen9pu, gen9lc, all VGC 2025/2026, doubles, BSS formats.

**Fix:** Import `FORMAT_DEFINITIONS` from `@nasty-plot/formats`. Use `getActiveFormats()`.

### HIGH — Value Constants

#### C4. `DEFAULT_IVS` — 22 Files

- **`packages/core/src/constants.ts:156`** (canonical)
- **`packages/mcp-server/src/tools/team-crud.ts:6`** (redefined)
- **3 web components** (`slot-editor.tsx`, `simplified-set-editor.tsx`, `damage-calculator.tsx`)
- **17 test files** (hardcoded `{ hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }`)

**Fix:** Import from `@nasty-plot/core` in production code. Consider test helper for tests.

#### C5. `DEFAULT_EVS` / `ZERO_EVS` — 20 Files

- **`packages/core/src/constants.ts:157`** (canonical)
- **`packages/mcp-server/src/tools/team-crud.ts:7`** (`ZERO_EVS` — different name, same value)
- **`packages/battle-engine/src/protocol-parser.ts:131`** (inline)
- **3 web components** + **12 test files**

**Fix:** Import from `@nasty-plot/core` everywhere.

#### C6. `level: 100` — No Constant Exists — 30+ Occurrences

Production code: `showdown-paste.ts`, `protocol-parser.ts` (x2), `calc.service.ts`, `replay-import.ts` (x2), `guided-builder-provider.tsx`, `damage-calculator.tsx`, `use-guided-builder.ts`
Test files: 20+ files, 100+ occurrences

**Fix:** Add `DEFAULT_LEVEL = 100` (+ `VGC_LEVEL = 50`, `LC_LEVEL = 5`) to `@nasty-plot/core/constants.ts`. Import in all production code.

### MEDIUM

#### C7. `"gen9ou"` Default — 11 Files, No Constant

- `battle-manager.ts` (x2), `automated-battle-manager.ts`, `mcts-ai.ts`, `replay-import.ts`
- `mcp-server/tools/analysis.ts`, `set-inference.service.ts`
- `web: teams/new`, `battle/live`, `battle/simulate`, `BattleSetup.tsx`

**Fix:** Add `DEFAULT_FORMAT_ID = "gen9ou"` to `@nasty-plot/core/constants.ts`. Import everywhere.

#### C8. `MCP_URL` — Same Package Duplicate

- **`packages/llm/src/mcp-client.ts:5`**
- **`packages/llm/src/cli-chat.ts:10`**

Both: `const MCP_URL = process.env.MCP_URL || "http://localhost:3001/mcp"`

**Fix:** Extract to `packages/llm/src/config.ts`.

#### C9. `MODEL` — 3 Definitions in LLM

- **`packages/llm/src/openai-client.ts:15`** — exported, `process.env.LLM_MODEL || process.env.OPENAI_MODEL || "claude-opus-4-6"`
- **`packages/llm/src/chat.service.ts:20`** — shadows the export with `process.env.LLM_MODEL || "claude-opus-4-6"`
- **`packages/llm/src/cli-chat.ts:11`** — `process.env.LLM_MODEL || "opus"` (different default)

**Fix:** `chat.service.ts` imports from `openai-client`. `cli-chat.ts` keeps `CLI_MODEL` with comment explaining difference.

#### C10. `STATS` Array — 2 Copies

- **`packages/core/src/types.ts:30`** (canonical)
- **`packages/smogon-data/src/chaos-sets.service.ts:20`** — `const stats = ["hp", "atk", "def", "spa", "spd", "spe"]`
- **`packages/teams/src/version.service.ts:421`** — `const statNames = ["hp", "atk", "def", "spa", "spd", "spe"] as const`

**Fix:** Import `STATS` from `@nasty-plot/core`.

#### C11. `510`/`252` EV Limits — Hardcoded

- **`packages/core/src/constants.ts:149-150`** (canonical: `MAX_TOTAL_EVS`, `MAX_SINGLE_EV`)
- **`apps/web/src/features/damage-calc/components/damage-calculator.tsx`** — 5 occurrences of literal `510`/`252`
- **`packages/core/src/stat-calc.ts`** — 4 occurrences of literal `252`/`510`

**Fix:** Import the named constants.

### LOW

#### C12. Tool Name Lists — Dual Enumeration

- **`packages/llm/src/tool-context.ts:4-37`** — `TOOL_CATEGORIES` (groups tools by category)
- **`packages/llm/src/tool-labels.ts:3-35`** — maps same 24 tool names to display labels

**Fix:** `tool-labels.ts` derives its keys from `TOOL_CATEGORIES`.

---

## 4. Duplicate Service Logic (8 violations)

### CRITICAL

#### S1. `dbSlotToDomain()` — 4 Copies

- **`packages/teams/src/team.service.ts:104-139`** — canonical, uses `getSpecies()` from pokemon-data
- **`packages/recommendations/src/composite-recommender.ts:128-179`** — uses `Dex.species.get()` directly
- **`packages/analysis/src/analysis.service.ts:32-75`** — inline in `analyzeTeam()`, uses `Dex.species.get()` via dynamic import
- **`packages/teams/src/version.service.ts:483-510`** — inline, uses `getSpecies()` (same pkg, doesn't reuse Copy A)

All do: EV columns → StatsTable, IV columns → StatsTable, move1-4 → array, nature/teraType cast. Canonical version NOT re-exported from `@nasty-plot/teams` barrel.

**Fix:** Export `dbSlotToDomain` from `@nasty-plot/teams` barrel. Delete 3 copies. `version.service.ts` imports from its own package.

### HIGH

#### S2. Direct `@pkmn/dex` Bypassing `pokemon-data` — 12 Files

| Package         | Files                                                                                                                |
| --------------- | -------------------------------------------------------------------------------------------------------------------- |
| battle-engine   | `team-packer.ts`, `protocol-parser.ts`, `ai/shared.ts`, `ai/greedy-ai.ts`, `ai/heuristic-ai.ts`, `ai/hint-engine.ts` |
| recommendations | `coverage-recommender.ts`, `usage-recommender.ts`, `composite-recommender.ts`                                        |
| analysis        | `threat.service.ts`, `analysis.service.ts`                                                                           |
| damage-calc     | `calc.service.ts`                                                                                                    |

Only 7 files use the `@nasty-plot/pokemon-data` wrapper.

**Fix:** Add missing wrappers to `pokemon-data/dex.service.ts`: `getMove()`, `getMoveByName()`, `getAbility()`, `getItem()`, `getType()`. Migrate all 12 files.

#### S3. Direct `prisma.usageStats.findMany()` — 4 Locations

- `analysis/analysis.service.ts:129` (`take: 20`)
- `analysis/threat.service.ts:23` (`take: 50`)
- `recommendations/coverage-recommender.ts:28` (`take: 100`)
- `apps/web/src/app/api/damage-calc/matchup-matrix/route.ts:37` (`take: 10`)

`@nasty-plot/smogon-data` already exports `getUsageStats(formatId, { limit })`.

**Fix:** Replace direct Prisma calls with `getUsageStats()` from smogon-data.

### MEDIUM

#### S4. Inline Species Hydration — 3 Locations

- `recommendations/composite-recommender.ts:129-147` — builds `{ id, name, types, baseStats, abilities, weightkg }` manually
- `analysis/analysis.service.ts:34-44` — identical manual construction
- `analysis/analysis.service.ts:140` — simpler inline lookup

All bypass `getSpecies()` from `@nasty-plot/pokemon-data`.

**Fix:** Use `getSpecies()` instead of manual construction. Resolved by S2 migration.

#### S5. `new Generations(Dex)` Redundant Construction — 4 Files

- `damage-calc/calc.service.ts:12`
- `battle-engine/ai/heuristic-ai.ts:16`
- `battle-engine/ai/greedy-ai.ts:7`
- `battle-engine/ai/hint-engine.ts:8`

4 separate module-level `Generations` instances.

**Fix:** Export a shared `gen9` instance from `@nasty-plot/pokemon-data` or `@nasty-plot/damage-calc`.

#### S6. Duplicate Format Resolution

- **`packages/formats/src/resolver.ts`** — `resolveFormatId()` (canonical)
- **`packages/smogon-data/src/set-inference.service.ts:70-108`** — `buildFormatFallbacks()` (parallel system)

Both handle VGC suffixes, regulation stripping, etc. but with diverging coverage.

**Fix:** Extend `resolveFormatId` in `@nasty-plot/formats` to handle all cases. Have `set-inference.service.ts` import and use it instead of its own fallback builder.

#### S7. `@smogon/calc` Boilerplate — 4 Files

- `damage-calc/calc.service.ts` — canonical calc wrapper
- `battle-engine/ai/greedy-ai.ts`, `heuristic-ai.ts`, `hint-engine.ts` — repeat `new Pokemon(gen, ...)` + `new Move(gen, ...)` + `calculate(gen, ...)`

Different input types (TeamSlotData vs BattlePokemon), so not a simple extract.

**Fix:** Add `calculateBattleDamage(attacker: BattlePokemon, defender: BattlePokemon, move: string)` helper to `battle-engine/ai/shared.ts`.

---

## 5. Frontend-Specific Violations (8 violations)

### HIGH — Duplicate Components

#### F1. `MoveInput` Component — ~270 Lines Duplicated

- **`apps/web/src/features/team-builder/components/slot-editor.tsx:587-723`**
- **`apps/web/src/features/team-builder/components/guided/simplified-set-editor.tsx:450-583`**

Both: two-tier autocomplete with popularity data, duplicate detection, ~135 lines each.

**Fix:** Extract to `apps/web/src/features/team-builder/components/shared/move-input.tsx`.

#### F2. Nature Dropdown with Popularity — ~100 Lines Duplicated

- **`slot-editor.tsx:159-168,396-443`**
- **`simplified-set-editor.tsx:112-120,260-303`**

**Fix:** Extract to `apps/web/src/features/team-builder/components/shared/nature-selector.tsx`.

#### F3. Inline Type Badges — 8 Files

These use `TYPE_COLORS` + `isLightTypeColor()` inline instead of `<TypeBadge>` from `@nasty-plot/ui`:

- `coverage-chart.tsx`, `weakness-heatmap.tsx`, `pokemon-search-panel.tsx`
- `slot-editor.tsx` (type display + tera picker), `team-grid.tsx`
- `simplified-set-editor.tsx` (tera picker), `MoveSelector.tsx`

Tera type picker pattern repeated identically in 2 files.

**Fix:** Use `<TypeBadge>` where appropriate. Extract `<TeraTypePicker>` shared component.

### MEDIUM

#### F4. Hardcoded Sample Teams — 2 Files, ~190 Lines

- **`BattleSetup.tsx:52-183`** — `SAMPLE_TEAM_1/2` (~130 lines)
- **`simulate/page.tsx:29-87`** — different `SAMPLE_TEAM_1/2` (~60 lines)

**Fix:** Load from DB sample teams or share a single constant.

#### F5. Game Constants — Missing from Core

`apps/web/src/features/damage-calc/components/damage-calculator.tsx:61-82`:

- `WEATHERS`, `TERRAINS`, `STATUSES`, `BOOST_VALUES` hardcoded inline

**Fix:** Add to `@nasty-plot/core/constants.ts`.

#### F6. `ARCHETYPE_OPTIONS` — No Canonical Source

`apps/web/src/app/battle/sample-teams/page.tsx:38-49`: hardcoded archetype list.

**Fix:** Add to `@nasty-plot/core/constants.ts` or `@nasty-plot/teams`.

#### F7. Pokemon/Learnset Fetch Duplication

Same `fetch(/api/pokemon/${id})` pattern in: `slot-editor.tsx`, `simplified-set-editor.tsx`, `page-context-provider.tsx`. Same learnset fetch in `slot-editor.tsx` and `simplified-set-editor.tsx`.

React Query deduplicates at runtime, but the fetch function definitions are copy-pasted.

**Fix:** Extract shared query functions (e.g., `usePokemonQuery(id)`, `useLearnsetQuery(id)`).

#### F8. `SampleTeamCard` Inline Sprites

`SampleTeamCard.tsx:44-58` manually calls `Sprites.getPokemon()` instead of using `PokemonSprite` from `@nasty-plot/ui`.

**Fix:** Use `PokemonSprite` from `@nasty-plot/ui`.

---

## What's Properly Centralized (No Issues)

- Format definitions: `packages/formats/` (seeder imports correctly)
- `toId()`: imported from `@nasty-plot/core` everywhere
- API URLs (Smogon/pkmn.cc): only in `packages/smogon-data/`
- Staleness logic: only in `packages/data-pipeline/`
- Validation layering: `core/validation.ts` → `teams/validation.service.ts` (proper extension)
- Format legality: `isLegalInFormat()` only in `packages/formats/`
- MCP API client pattern: single `api-client.ts` used by all tool modules
- Chat types in LLM: re-exports from `@nasty-plot/core`
- Battle types in LLM: imported from `@nasty-plot/battle-engine`

---

## Decisions (Pre-Approved)

These decisions were made during planning. Do NOT re-ask them.

1. **Test files:** Update production code AND test files. Tests import constants from `@nasty-plot/core` too. Full consistency.
2. **`@pkmn/dex` migration:** Migrate ALL 12 files through `@nasty-plot/pokemon-data`. No exceptions for battle-engine AI.
3. **`cn()` change:** Isolated commit. One commit that only changes imports. Do NOT bundle with other changes.
4. **Frontend components (MoveInput, NatureSelector, TeraTypePicker):** Keep in `apps/web/src/features/team-builder/components/shared/`. These are feature-specific, NOT package-level.
5. **`serializeBattleState()`:** Move to `@nasty-plot/battle-engine` package.
6. **`Generations` instance:** Export shared `gen9` from `@nasty-plot/pokemon-data` package.
7. **Hardcoded sample teams:** Load from DB via existing SampleTeam API. Do NOT use shared constants.

---

## Execution Plan — Parallel Agent Architecture

**Goal:** Execute all 48 violations using parallel agent teams across 3 waves. Each wave runs fully in parallel. Waves are sequential (Wave 2 starts after Wave 1 completes). Run `pnpm test` after each wave to catch regressions.

### Dependency Graph

```
Wave 1 (all independent, run in parallel):
  Phase 1: New Constants ──────────────────┐
  Phase 2: MCP Server Dedup                │
  Phase 3: cn() Sweep (isolated commit)    │ Wave 1 complete
  Phase 5: Types Consolidation             │ then run tests
  LLM Config Dedup (C8, C9, C12)          │
                                           ▼
Wave 2 (needs Wave 1 constants + types):
  Phase 4: Constants Sweep (packages)  ────┐
  Phase 4: Constants Sweep (web)           │
  Phase 4: Constants Sweep (tests)         │ Wave 2 complete
  Phase 6a: pokemon-data expansion         │ then run tests
  Phase 6b: Utility function dedup         │
  Phase 8a: Frontend component extraction  │
                                           ▼
Wave 3 (needs Wave 2 pokemon-data wrappers):
  Phase 7a: Dex migration (battle-engine)──┐
  Phase 7b: Dex migration (other packages) │ Wave 3 complete
  Phase 7c: Service dedup (dbSlotToDomain) │ then run tests
  Phase 7d: Calc boilerplate               │
  Phase 8b: Frontend cleanup               │
```

---

### Wave 1 — 5 Parallel Agents (No Dependencies)

#### Agent 1: `constants-author` (subagent_type: general-purpose)

**Scope:** Add new constants to `packages/core/src/constants.ts` and ensure barrel export.

**Tasks:**

1. Read `packages/core/src/constants.ts` and `packages/core/src/index.ts`
2. Add these constants to `packages/core/src/constants.ts`:
   ```ts
   export const DEFAULT_LEVEL = 100
   export const VGC_LEVEL = 50
   export const LC_LEVEL = 5
   export const DEFAULT_FORMAT_ID = "gen9ou"
   ```
3. Add game constants (get the values from `apps/web/src/features/damage-calc/components/damage-calculator.tsx:61-82`):
   ```ts
   export const WEATHERS = [...] // copy from damage-calculator.tsx
   export const TERRAINS = [...]
   export const STATUSES = [...]
   export const BOOST_VALUES = [...]
   ```
4. Add archetype options (get values from `apps/web/src/app/battle/sample-teams/page.tsx:38-49`):
   ```ts
   export const ARCHETYPE_OPTIONS = [...]
   ```
5. Ensure all new constants are exported from `packages/core/src/index.ts` barrel.
6. Do NOT modify any consumers yet — that's Wave 2.

---

#### Agent 2: `mcp-deduper` (subagent_type: general-purpose)

**Scope:** Clean MCP server — delete all copied constants, import from canonical sources.

**Tasks:**

1. Read `packages/mcp-server/src/resources/index.ts` and `packages/mcp-server/src/tools/team-crud.ts`
2. In `resources/index.ts`:
   - Delete the inline `TYPE_CHART` object (lines ~5-90). Import `TYPE_CHART` from `@nasty-plot/core`.
   - Delete the inline `NATURES_DATA` object (lines ~92-118). Import `NATURE_DATA` from `@nasty-plot/core`. Transform to strip `name` field if the MCP resource needs the simpler shape.
   - Delete the inline `FORMATS_LIST` array (lines ~147-156). Import `FORMAT_DEFINITIONS` from `@nasty-plot/formats` and derive the list: `FORMAT_DEFINITIONS.filter(f => f.isActive).map(f => ({ id: f.id, name: f.name, generation: f.generation, gameType: f.gameType }))`. This fixes the `"gen9uber"` → `"gen9ubers"` bug.
   - Delete `STAT_FORMULAS` string if possible, or leave it (LOW priority).
3. In `tools/team-crud.ts`:
   - Delete local `DEFAULT_IVS` and `ZERO_EVS` constants (lines ~6-7). Import `DEFAULT_IVS` and `DEFAULT_EVS` from `@nasty-plot/core`. Replace all `ZERO_EVS` references with `DEFAULT_EVS`.
4. Check `packages/mcp-server/package.json` has `@nasty-plot/core` and `@nasty-plot/formats` as dependencies. Add if missing.
5. Run `pnpm test -- tests/mcp-server/` to verify.

---

#### Agent 3: `cn-sweeper` (subagent_type: general-purpose)

**Scope:** Delete the duplicate `cn()` utility and update all 72 imports. This is an ISOLATED change.

**Tasks:**

1. Delete `apps/web/src/lib/utils.ts`.
2. Find ALL files in `apps/web/` that import from `@/lib/utils` or `../lib/utils` etc.
3. Replace every import with `import { cn } from "@nasty-plot/ui"`.
4. If any file imported OTHER things from `@/lib/utils` besides `cn`, handle those too (unlikely — the file only exports `cn`).
5. Verify `@nasty-plot/ui` exports `cn` from its barrel (`packages/ui/src/index.ts`).
6. Run `pnpm build` to verify no import errors.

**Critical:** This agent's changes should be committed SEPARATELY from all other agents. It's a single isolated commit.

---

#### Agent 4: `types-consolidator` (subagent_type: general-purpose)

**Scope:** Fix all 13 duplicate type definitions (T1-T13).

**Tasks (grouped by canonical location):**

**Move to `@nasty-plot/core` (T2, T6):**

1. Move `PageType` to `packages/core/src/types.ts`. Delete from `packages/llm/src/tool-context.ts` and `apps/web/src/features/chat/context/page-context-provider.tsx`. Update both to import from `@nasty-plot/core`. Update `packages/core/src/index.ts` barrel.
2. Move `ExtractedPokemonData` and `ExtractedTeamData` to `packages/core/src/types.ts` (use the battle-engine version which has `nickname?`). Delete from `packages/battle-engine/src/replay/replay-import.ts` and `packages/smogon-data/src/set-inference.service.ts`. Update imports. Update barrel.

**Fix in `@nasty-plot/battle-engine` (T7, T12, T13):** 3. Unify `ShowdownReplayJSON` / `ShowdownReplayJson` into ONE interface in `packages/battle-engine/src/types.ts` with all fields (some optional). Update `battle-export.service.ts` and `replay-import.ts` to import from `./types`. 4. Delete `BattleFormat` from `packages/battle-engine/src/types.ts`. Replace with `GameType` imported from `@nasty-plot/core`. Update all consumers in battle-engine. 5. Define `DexMove` once in `packages/battle-engine/src/types.ts`: `export type DexMove = ReturnType<typeof Dex.moves.get>`. Delete from `hint-engine.ts` and `heuristic-ai.ts`. Both import from `../types`.

**Fix in web — ChatMessage (T1):** 6. In `apps/web/src/features/chat/hooks/use-chat-stream.ts`: rename `ChatMessage` to `UIChatMessage`. Update all consumers in `apps/web/` that import `ChatMessage` from this file to use `UIChatMessage`.

**Fix in web — SampleTeam types (T3, T4):** 7. In `apps/web/src/features/battle/hooks/use-sample-teams.ts`: delete local `SampleTeamData`, import from `@nasty-plot/teams`. If `createdAt` is missing, use `Omit<SampleTeamData, 'createdAt'>`. 8. In `packages/data-pipeline/src/data/sample-teams.ts`: rename `SampleTeamEntry` to `SampleTeamSeedEntry`. 9. In `apps/web/src/features/team-builder/hooks/use-guided-builder.ts`: check if the local `SampleTeamEntry` can be replaced with `SampleTeamData` from `@nasty-plot/teams` (it may need a `pokemonIds: string[]` vs `string` adapter). 10. In `apps/web/src/app/battle/sample-teams/page.tsx`: delete local `SampleTeam` interface, import from teams.

**Fix in web — simple dedup (T5, T8, T9, T10, T11):** 11. Delete `TeamBattleAnalytics` from `apps/web/src/features/battle/hooks/use-team-battles.ts`. Import from `@nasty-plot/battle-engine`. 12. Create `apps/web/src/features/battle/types.ts` with unified `BattleSummary` (superset version) and `TeamValidation`. Update `battle/page.tsx`, `use-team-battles.ts`, `TeamPicker.tsx`, `BattleSetup.tsx` to import from it. 13. Create `apps/web/src/features/pokemon/types.ts` with `SortMode`. Update `api/pokemon/route.ts` and `pokemon/page.tsx` to import from it. 14. Delete `PlanStep` from `apps/web/src/features/chat/components/chat-plan-display.tsx`. Import from `../hooks/use-chat-stream`.

**Run tests:** `pnpm test` to verify no breakage.

---

#### Agent 5: `llm-deduper` (subagent_type: general-purpose)

**Scope:** Clean up duplicates within the `packages/llm/` package (C8, C9, C12).

**Tasks:**

1. Create `packages/llm/src/config.ts`:
   ```ts
   export const MCP_URL = process.env.MCP_URL || "http://localhost:3001/mcp"
   export const MODEL = process.env.LLM_MODEL || process.env.OPENAI_MODEL || "claude-opus-4-6"
   ```
2. In `packages/llm/src/mcp-client.ts`: delete local `MCP_URL`, import from `./config`.
3. In `packages/llm/src/cli-chat.ts`: delete local `MCP_URL`, import from `./config`. Keep `CLI_MODEL` but add comment: `// CLI uses shorthand model names ("opus") vs full model IDs`.
4. In `packages/llm/src/chat.service.ts`: delete local `MODEL`, import from `./config`.
5. In `packages/llm/src/openai-client.ts`: delete local `MODEL`, import from `./config`.
6. For tool name lists (C12): Read `packages/llm/src/tool-context.ts` and `packages/llm/src/tool-labels.ts`. Make `tool-labels.ts` derive its keys from `TOOL_CATEGORIES` in `tool-context.ts` instead of hardcoding all 24 tool names separately.
7. Run `pnpm test -- tests/llm/` to verify.

---

### Wave 2 — 6 Parallel Agents (After Wave 1 + Tests Pass)

**Pre-condition:** Wave 1 complete. New constants exist in core. Types consolidated. Run `pnpm test` before starting.

#### Agent 6: `constants-sweeper-packages` (subagent_type: general-purpose)

**Scope:** Replace all hardcoded constants in `packages/` with imports from `@nasty-plot/core`.

**Tasks:**

1. **`DEFAULT_LEVEL`** — Replace `level: 100` in these production files:
   - `packages/core/src/showdown-paste.ts:73`
   - `packages/battle-engine/src/protocol-parser.ts:87,120`
   - `packages/battle-engine/src/replay/replay-import.ts:137,170`
   - `packages/damage-calc/src/calc.service.ts:218`
     Add `import { DEFAULT_LEVEL } from "@nasty-plot/core"` (or adjust existing core import).

2. **`DEFAULT_FORMAT_ID`** — Replace `"gen9ou"` in:
   - `packages/battle-engine/src/battle-manager.ts:165,367`
   - `packages/battle-engine/src/simulation/automated-battle-manager.ts:148`
   - `packages/battle-engine/src/ai/mcts-ai.ts:41`
   - `packages/battle-engine/src/replay/replay-import.ts:298`
   - `packages/mcp-server/src/tools/analysis.ts:55`
   - `packages/smogon-data/src/set-inference.service.ts:103`
     Add `import { DEFAULT_FORMAT_ID } from "@nasty-plot/core"`.

3. **`DEFAULT_EVS` / `DEFAULT_IVS`** — Replace inline `{ hp: 0, atk: 0, ... }` and `{ hp: 31, atk: 31, ... }` in:
   - `packages/battle-engine/src/protocol-parser.ts:131` (EVs)
   - Any other packages/ files found via grep. Import from `@nasty-plot/core`.

4. **`STATS`** — Replace local stat name arrays:
   - `packages/smogon-data/src/chaos-sets.service.ts:20` — replace `const stats = [...]` with `import { STATS } from "@nasty-plot/core"`
   - `packages/teams/src/version.service.ts:421` — replace `const statNames = [...]` with `import { STATS } from "@nasty-plot/core"`

5. **`MAX_TOTAL_EVS` / `MAX_SINGLE_EV`** — Replace hardcoded `510`/`252` in:
   - `packages/core/src/stat-calc.ts` (4 occurrences) — import from `./constants`

6. Run `pnpm test -- tests/battle-engine/ tests/damage-calc/ tests/analysis/ tests/recommendations/ tests/core/` to verify.

---

#### Agent 7: `constants-sweeper-web` (subagent_type: general-purpose)

**Scope:** Replace all hardcoded constants in `apps/web/` with imports from `@nasty-plot/core`.

**Tasks:**

1. **`DEFAULT_LEVEL`** — Replace `level: 100` in:
   - `apps/web/src/features/team-builder/hooks/use-guided-builder.ts:238`
   - `apps/web/src/features/team-builder/context/guided-builder-provider.tsx:167`
   - `apps/web/src/features/damage-calc/components/damage-calculator.tsx:50`
   - `apps/web/src/features/recommendations/components/recommendation-panel.tsx:65` (if exists)

2. **`DEFAULT_FORMAT_ID`** — Replace `"gen9ou"` in:
   - `apps/web/src/app/teams/new/page.tsx:32`
   - `apps/web/src/app/battle/live/page.tsx:50`
   - `apps/web/src/app/battle/simulate/page.tsx:122`
   - `apps/web/src/features/battle/components/BattleSetup.tsx:235`

3. **`DEFAULT_EVS` / `DEFAULT_IVS`** — Replace inline stats objects in:
   - `apps/web/src/features/damage-calc/components/damage-calculator.tsx:54,55,56`
   - `apps/web/src/features/team-builder/components/slot-editor.tsx:77,80,93,94`
   - `apps/web/src/features/team-builder/components/guided/simplified-set-editor.tsx:123,127`

4. **`MAX_TOTAL_EVS` / `MAX_SINGLE_EV`** — Replace `510`/`252` in:
   - `apps/web/src/features/damage-calc/components/damage-calculator.tsx:105,231,233,252,255`

5. **`WEATHERS`, `TERRAINS`, `STATUSES`, `BOOST_VALUES`** — Replace inline arrays in:
   - `apps/web/src/features/damage-calc/components/damage-calculator.tsx:61-82`
     Import from `@nasty-plot/core`.

6. **Stat names** — Replace `["atk", "def", "spa", "spd", "spe"] as const` in:
   - `apps/web/src/features/damage-calc/components/damage-calculator.tsx:269`
     Import `STATS` from `@nasty-plot/core`.

7. Run `pnpm build` to verify no web build errors.

---

#### Agent 8: `constants-sweeper-tests` (subagent_type: general-purpose)

**Scope:** Replace all hardcoded constants in `tests/` with imports from `@nasty-plot/core`.

**Tasks:**

1. **`DEFAULT_IVS`** — grep `tests/` for `hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31` and replace with `import { DEFAULT_IVS } from "@nasty-plot/core"`. Files include:
   - `tests/teams/validation.service.test.ts`, `tests/teams/import-export.service.test.ts`, `tests/damage-calc/calc.service.test.ts`, `tests/mcp-server/tools-team-crud.test.ts`, `tests/teams/team.service.test.ts`, `tests/teams/team-matcher.test.ts`, `tests/analysis/coverage.service.test.ts`, `tests/llm/context-builder.test.ts`, `tests/recommendations/coverage-recommender.test.ts`, `tests/teams/version.service.test.ts`, `tests/core/showdown-paste.test.ts`, `tests/core/stat-calc.test.ts`, `tests/analysis/synergy.service.test.ts`, `tests/analysis/threat.service.test.ts`, `tests/battle-engine/set-predictor.test.ts`, `tests/battle-engine/team-packer.test.ts`, `tests/core/validation.test.ts`

2. **`DEFAULT_EVS`** — grep `tests/` for `hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0` and replace with `import { DEFAULT_EVS } from "@nasty-plot/core"`. Files include:
   - `tests/analysis/coverage.service.test.ts`, `tests/llm/context-builder.test.ts`, `tests/analysis/threat.service.test.ts`, `tests/analysis/synergy.service.test.ts`, `tests/teams/validation.service.test.ts`, `tests/core/stat-calc.test.ts`, `tests/recommendations/coverage-recommender.test.ts`, `tests/teams/version.service.test.ts`, `tests/teams/team-matcher.test.ts`, `tests/mcp-server/tools-team-crud.test.ts`, `tests/teams/team.service.test.ts`, `tests/core/validation.test.ts`, `tests/damage-calc/calc.service.test.ts`

3. **`DEFAULT_LEVEL`** — Replace `level: 100` in test files where it appears as a default (NOT as intentional test data for specific level scenarios). Use judgment: if a test is specifically testing level 100 behavior vs level 50, keep the literal.

4. Be careful with test data objects that spread: `{ ...baseSlot, level: 100 }` — if `DEFAULT_LEVEL` is already the default, the explicit `level: 100` may be redundant and can be removed. But if it's part of the test's explicit setup, keep it as `level: DEFAULT_LEVEL` for clarity.

5. Run `pnpm test` to verify all tests still pass.

---

#### Agent 9: `pokemon-data-expander` (subagent_type: general-purpose)

**Scope:** Expand `@nasty-plot/pokemon-data` with missing wrapper functions and exports needed by Wave 3.

**Tasks:**

1. Read `packages/pokemon-data/src/dex.service.ts` to understand existing wrappers.
2. Add these wrapper functions:
   ```ts
   export function getMove(nameOrId: string) {
     return dex.moves.get(nameOrId)
   }
   export function getMoveByName(name: string) {
     return dex.moves.get(name)
   }
   export function getAbility(nameOrId: string) {
     return dex.abilities.get(nameOrId)
   }
   export function getItem(nameOrId: string) {
     return dex.items.get(nameOrId)
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
   (Copy `resolveSpeciesName` logic from `packages/damage-calc/src/calc.service.ts:70-74`)
3. Add shared `Generations` instance:
   ```ts
   import { Generations } from "@pkmn/data"
   export const gen9 = new Generations(Dex).get(9)
   ```
   Ensure `@pkmn/data` is in `packages/pokemon-data/package.json` dependencies.
4. Export ALL new functions from `packages/pokemon-data/src/index.ts` barrel.
5. Run `pnpm test -- tests/pokemon-data/` (if tests exist) or just `pnpm build`.

---

#### Agent 10: `util-deduper` (subagent_type: general-purpose)

**Scope:** Consolidate duplicate utility functions (U3, U4, U5, U6, U7).

**Tasks:**

1. **`flattenDamage()` (U3):** Read both versions. Keep/move the canonical version to `packages/damage-calc/src/calc.service.ts` as an EXPORTED function. In `packages/battle-engine/src/ai/shared.ts`: delete the local `flattenDamage`, add `import { flattenDamage } from "@nasty-plot/damage-calc"`. Update `packages/damage-calc/src/index.ts` barrel to export it. Check `packages/battle-engine/package.json` has `@nasty-plot/damage-calc` dependency.

2. **`getTypeEffectiveness()` (U4):** Read the core version at `packages/core/src/type-chart.ts:7`. Widen the type signature to accept `string` (not just `PokemonType`):

   ```ts
   export function getTypeEffectiveness(attackType: string, defenseTypes: string[]): number
   ```

   Then in `packages/battle-engine/src/ai/shared.ts`: delete the local `getTypeEffectiveness`. Add `import { getTypeEffectiveness } from "@nasty-plot/core"`. Update all AI files that import from `./shared` — they should still work since shared re-exports it.

3. **`teamToShowdownPaste()` (U5):** In `packages/battle-engine/src/team-packer.ts`: delete `teamToShowdownPaste()` function. Replace with import: `import { serializeShowdownPaste } from "@nasty-plot/core"`. Update all callers in battle-engine to use `serializeShowdownPaste` instead of `teamToShowdownPaste`. Check if `team-packer.ts` exports `teamToShowdownPaste` — if so, re-export `serializeShowdownPaste as teamToShowdownPaste` for backward compat, or update all consumers.

4. **`serializeBattleState()` (U6):** Move the ~170-line function from `apps/web/src/features/chat/context/page-context-provider.tsx:79-247` (including `serializeSide`, `serializePokemon`, `serializeSideConditions` helpers) to `packages/battle-engine/src/`. Create a new file `packages/battle-engine/src/battle-state-serializer.ts` or add to an existing file. Export from battle-engine barrel. In the web file, replace the 170 lines with an import.

5. **Status move score constants (U7):** Read `packages/battle-engine/src/ai/hint-engine.ts:113+` and `packages/battle-engine/src/ai/heuristic-ai.ts:196+`. Extract shared BASE score constants (e.g., `HAZARD_SCORES`, `STATUS_SCORES`) to `packages/battle-engine/src/ai/shared.ts`. Both files import the constants but keep their own scoring logic (hint returns explanation, heuristic returns number).

6. Run `pnpm test -- tests/battle-engine/ tests/damage-calc/ tests/core/` to verify.

---

#### Agent 11: `frontend-components` (subagent_type: general-purpose)

**Scope:** Extract duplicate frontend components (F1, F2, F3).

**Tasks:**

1. **`MoveInput` (F1):** Read both copies:
   - `apps/web/src/features/team-builder/components/slot-editor.tsx:587-723`
   - `apps/web/src/features/team-builder/components/guided/simplified-set-editor.tsx:450-583`
     Create `apps/web/src/features/team-builder/components/shared/move-input.tsx` with a unified `MoveInput` component. Identify any differences between the two copies and parameterize them via props. Update both `slot-editor.tsx` and `simplified-set-editor.tsx` to import from the shared location. Delete the inline copies.

2. **`NatureSelector` (F2):** Read both copies:
   - `slot-editor.tsx:159-168,396-443`
   - `simplified-set-editor.tsx:112-120,260-303`
     Create `apps/web/src/features/team-builder/components/shared/nature-selector.tsx`. Extract the nature sorting-by-popularity and dropdown rendering logic. Update both editors to use it.

3. **`TeraTypePicker` + TypeBadge cleanup (F3):** Read the tera type picker patterns in:
   - `slot-editor.tsx:454-460`
   - `simplified-set-editor.tsx:317-323`
     Create `apps/web/src/features/team-builder/components/shared/tera-type-picker.tsx`. Then for the 8 files using inline type badges (`coverage-chart.tsx`, `weakness-heatmap.tsx`, `pokemon-search-panel.tsx`, `slot-editor.tsx`, `team-grid.tsx`, `simplified-set-editor.tsx`, `MoveSelector.tsx`), replace inline `TYPE_COLORS` + `isLightTypeColor()` badge rendering with `<TypeBadge>` from `@nasty-plot/ui` where appropriate (non-interactive displays). Leave interactive pickers as the new `<TeraTypePicker>`.

4. Run `pnpm build` to verify.

---

### Wave 3 — 5 Parallel Agents (After Wave 2 + Tests Pass)

**Pre-condition:** Wave 2 complete. pokemon-data has new wrappers. Utility functions consolidated. Run `pnpm test` before starting.

#### Agent 12: `dex-migrator-battle-engine` (subagent_type: general-purpose)

**Scope:** Migrate 6 battle-engine files from `@pkmn/dex` to `@nasty-plot/pokemon-data`.

**Tasks:**
For each file, replace `import { Dex } from "@pkmn/dex"` with imports from `@nasty-plot/pokemon-data`:

1. `packages/battle-engine/src/team-packer.ts` — replace `Dex.species.get()` with `getSpecies()`. `resolveSpeciesName` should now be imported from pokemon-data (done in Wave 2).
2. `packages/battle-engine/src/protocol-parser.ts` — replace `const dex = Dex.forGen(9)` and all `dex.species.get()` / `dex.moves.get()` calls with pokemon-data wrappers.
3. `packages/battle-engine/src/ai/shared.ts` — replace `Dex.species.get()` with `getSpecies()`. The `getTypeEffectiveness` was already deleted in Wave 2 (U4), so `Dex.types.get()` calls should be gone.
4. `packages/battle-engine/src/ai/greedy-ai.ts` — replace all Dex usage with pokemon-data imports. Replace `new Generations(Dex).get(9)` with `gen9` from pokemon-data.
5. `packages/battle-engine/src/ai/heuristic-ai.ts` — replace `Dex.moves.get()` with `getMove()` from pokemon-data. Replace `new Generations(Dex).get(9)` with `gen9`.
6. `packages/battle-engine/src/ai/hint-engine.ts` — replace `Dex.moves.get()` with `getMove()`. Replace `new Generations(Dex).get(9)` with `gen9`.

Update `packages/battle-engine/package.json`: add `@nasty-plot/pokemon-data` dependency, potentially remove `@pkmn/dex` direct dependency if no longer needed.

Run `pnpm test -- tests/battle-engine/` to verify.

---

#### Agent 13: `dex-migrator-other` (subagent_type: general-purpose)

**Scope:** Migrate 6 non-battle-engine files from `@pkmn/dex` to `@nasty-plot/pokemon-data`.

**Tasks:**

1. `packages/recommendations/src/coverage-recommender.ts` — replace `Dex.species.get()` with `getSpecies()` from pokemon-data.
2. `packages/recommendations/src/usage-recommender.ts` — same.
3. `packages/recommendations/src/composite-recommender.ts` — same. Note: this file also has `dbSlotToDomain` which will be handled by Agent 15, but the Dex import replacement is independent.
4. `packages/analysis/src/threat.service.ts` — replace `Dex.species.get()` with `getSpecies()`.
5. `packages/analysis/src/analysis.service.ts` — replace dynamic `import("@pkmn/dex")` with static import from `@nasty-plot/pokemon-data`. Replace all `Dex.species.get()` calls.
6. `packages/damage-calc/src/calc.service.ts` — replace `Dex.species.get()` with `getSpecies()`. `resolveSpeciesName` was already moved to pokemon-data in Wave 2 — import from there. Replace `new Generations(Dex).get(9)` with `gen9` from pokemon-data.

Update `package.json` in each package: add `@nasty-plot/pokemon-data` dependency.

Run `pnpm test -- tests/recommendations/ tests/analysis/ tests/damage-calc/` to verify.

---

#### Agent 14: `service-deduper` (subagent_type: general-purpose)

**Scope:** Deduplicate service logic — dbSlotToDomain, direct prisma usage, format resolution (S1, S3, S6).

**Tasks:**

1. **`dbSlotToDomain` (S1):**
   - Read the canonical `dbSlotToDomain` in `packages/teams/src/team.service.ts:104-139`.
   - Export it from `packages/teams/src/index.ts` barrel.
   - In `packages/recommendations/src/composite-recommender.ts`: delete local `dbSlotToDomain` (lines 128-179). Import from `@nasty-plot/teams`.
   - In `packages/analysis/src/analysis.service.ts`: delete inline mapping (lines 32-75). Import `dbSlotToDomain` from `@nasty-plot/teams`.
   - In `packages/teams/src/version.service.ts`: replace inline mapping (lines 483-510) with call to `dbSlotToDomain` from `./team.service`.
   - Check that `@nasty-plot/teams` is a dependency of `recommendations` and `analysis` packages.

2. **Direct prisma.usageStats (S3):**
   - In `packages/analysis/src/analysis.service.ts:129`: replace `prisma.usageStats.findMany(...)` with `getUsageStats(formatId, { limit: 20 })` from `@nasty-plot/smogon-data`.
   - In `packages/analysis/src/threat.service.ts:23`: replace with `getUsageStats(formatId, { limit: 50 })`.
   - In `packages/recommendations/src/coverage-recommender.ts:28`: replace with `getUsageStats(formatId, { limit: 100 })`.
   - In `apps/web/src/app/api/damage-calc/matchup-matrix/route.ts:37`: replace with `getUsageStats(formatId, { limit: 10 })`.
   - Verify `getUsageStats` signature supports a `limit` option. If not, add it.

3. **Format resolution (S6):**
   - Read `packages/formats/src/resolver.ts` (canonical `resolveFormatId`).
   - Read `packages/smogon-data/src/set-inference.service.ts:70-108` (`buildFormatFallbacks`).
   - Extend `resolveFormatId` in `@nasty-plot/formats` to handle the cases `buildFormatFallbacks` covers (bo3/bo5 suffix stripping, VGC year fallbacks).
   - In `set-inference.service.ts`: delete `buildFormatFallbacks`. Import `resolveFormatId` from `@nasty-plot/formats`. Adapt the calling code.

4. Run `pnpm test` to verify.

---

#### Agent 15: `calc-boilerplate` (subagent_type: general-purpose)

**Scope:** Reduce `@smogon/calc` boilerplate in battle-engine AI files (S7).

**Tasks:**

1. Read the damage calc pattern in:
   - `packages/battle-engine/src/ai/greedy-ai.ts`
   - `packages/battle-engine/src/ai/heuristic-ai.ts`
   - `packages/battle-engine/src/ai/hint-engine.ts`
2. All three construct `new Pokemon(gen9, ...)` from `BattlePokemon` + `new Move(gen9, ...)` + `calculate(gen9, ...)`.
3. Add a helper to `packages/battle-engine/src/ai/shared.ts`:
   ```ts
   export function calculateBattleDamage(
     attacker: BattlePokemon,
     defender: BattlePokemon,
     moveName: string,
     field?: Partial<Field>,
   ): { damage: number[]; result: Result }
   ```
   This encapsulates the Pokemon/Move construction + calculate call. Use `gen9` from `@nasty-plot/pokemon-data` (after Wave 2 agent 9 added it).
4. Refactor all 3 AI files to use `calculateBattleDamage` instead of inline construction.
5. Run `pnpm test -- tests/battle-engine/` to verify — AI behavior must not change.

---

#### Agent 16: `frontend-cleanup` (subagent_type: general-purpose)

**Scope:** Remaining frontend cleanup (F4, F5-already done by constants-sweeper-web, F6, F7, F8).

**Tasks:**

1. **Sample teams from DB (F4):** In `apps/web/src/features/battle/components/BattleSetup.tsx` and `apps/web/src/app/battle/simulate/page.tsx`:
   - Delete hardcoded `SAMPLE_TEAM_1` and `SAMPLE_TEAM_2` paste strings.
   - Replace with a `useQuery` call to `GET /api/sample-teams?formatId=${formatId}&limit=2` (or similar).
   - Use the fetched sample teams as defaults. Handle loading state gracefully.

2. **`ARCHETYPE_OPTIONS` (F6):** In `apps/web/src/app/battle/sample-teams/page.tsx`:
   - Delete inline archetype array.
   - Import `ARCHETYPE_OPTIONS` from `@nasty-plot/core`.

3. **Shared query hooks (F7):** Create `apps/web/src/features/team-builder/hooks/use-pokemon-data.ts`:

   ```ts
   export function usePokemonQuery(pokemonId: string | null) { ... }
   export function useLearnsetQuery(pokemonId: string | null) { ... }
   ```

   Extract the shared fetch pattern from `slot-editor.tsx`, `simplified-set-editor.tsx`, and `page-context-provider.tsx`. Update all three to use the shared hooks.

4. **`SampleTeamCard` sprites (F8):** In `apps/web/src/features/battle/components/SampleTeamCard.tsx`:
   - Replace inline `Sprites.getPokemon()` + `<img>` with `<PokemonSprite>` from `@nasty-plot/ui`.

5. **`sample-teams/page.tsx` fetch pattern:** In `apps/web/src/app/battle/sample-teams/page.tsx`:
   - Replace `useEffect` + `fetch` with `useQuery` for consistency with the rest of the app.

6. Run `pnpm build` to verify.

---

### Post-Execution

After all 3 waves complete and tests pass:

1. Run full test suite: `pnpm test`
2. Run build: `pnpm build`
3. Verify no remaining `@pkmn/dex` imports outside `packages/pokemon-data/`: `grep -r "from ['\"]@pkmn/dex['\"]" packages/ --include="*.ts" | grep -v pokemon-data | grep -v node_modules`
4. Verify no remaining `@/lib/utils` imports: `grep -r "@/lib/utils" apps/web/`
5. Verify no remaining inline `{ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }` in production code (tests are OK if they use DEFAULT_EVS): `grep -r "hp: 0, atk: 0, def: 0" packages/ apps/web/src/`
6. Create Linear issues for any items that couldn't be completed
7. Write session summary to `sessions/`
