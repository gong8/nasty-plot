# Nasty Plot: Current State Audit

**Date:** 2026-02-10
**Branch:** `main` (uncommitted changes in flight)

---

## 1. Executive Summary

Nasty Plot is a Pokemon competitive team building and analysis platform built as a Turborepo monorepo. It provides tools for constructing teams, analyzing competitive viability, simulating battles against AI opponents, and chatting with an LLM assistant.

| Metric | Count |
|--------|-------|
| Packages | 14 |
| Prisma models | 13 (Format, UsageStats, SmogonSet, TeammateCorr, CheckCounter, Team, TeamSlot, DataSyncLog, ChatSession, ChatMessage, Battle, BattleTurn, BatchSimulation, SampleTeam) |
| Format definitions | 12 (OU, UU, RU, NU, Ubers, LC, Monotype, National Dex, National Dex UU, VGC 2024, VGC 2025, BSS, BSD) |
| API routes | 33 |
| App pages | 15 |
| MCP tools | 24 (4 modules) |
| MCP resources | 5 |
| AI difficulty tiers | 4 (Random, Greedy, Heuristic, Expert/MCTS) |
| Test files | 29 |
| Feature modules (frontend) | 5 (battle, chat, team-builder, analysis, damage-calc, recommendations) |
| Shared UI components | 3 (PokemonSprite, TypeBadge, StatBar) + 25 shadcn/ui primitives |

**Stack:** Turborepo + pnpm, Next.js 16 (App Router + Turbopack), TypeScript 5, React 19, Prisma + SQLite, Vitest, Tailwind CSS, Radix UI

---

## 2. Package-by-Package Inventory

### 2.1 `core` -- Domain Types & Utilities

**Status:** Active
**What it does:** Defines the canonical domain types used across all packages: `TeamSlotData`, `PokemonSpecies`, `MoveData`, `FormatDefinition`, `DamageCalcInput`, `ChatMessage`, etc. Also provides the type effectiveness chart, stat calculation formulas, Showdown paste parser/exporter, and validation utilities.

**Key files:**
| File | Purpose |
|------|---------|
| `packages/core/src/types.ts` | All domain types (324 lines) |
| `packages/core/src/type-chart.ts` | 18x18 type effectiveness lookup |
| `packages/core/src/stat-calc.ts` | HP/stat formula calculations |
| `packages/core/src/showdown-paste.ts` | Parse and export Showdown paste format |
| `packages/core/src/constants.ts` | Shared constants |
| `packages/core/src/validation.ts` | Input validation utilities |

**Tests:** 3 test files [Exists]
- `type-chart.test.ts`, `stat-calc.test.ts`, `showdown-paste.test.ts`

**Known issues:** None significant. This package is stable and well-tested.

---

### 2.2 `db` -- Prisma Client Singleton

**Status:** Active
**What it does:** Exports a singleton Prisma client connected to a local SQLite database. Used by all server-side code that touches the database.

**Key files:**
| File | Purpose |
|------|---------|
| `packages/db/src/client.ts` | Prisma client singleton |
| `packages/db/src/index.ts` | Barrel export |
| `prisma/schema.prisma` | Schema definition (13 models, 252 lines) |
| `prisma/dev.db` | SQLite database file |

**Tests:** None [Missing] -- singleton client, not much to test independently.

**Known issues:** Turbopack caches the stale Prisma client after `prisma generate`; dev server must be restarted manually.

---

### 2.3 `pokemon-data` -- @pkmn/dex Wrapper

**Status:** Active
**What it does:** Wraps `@pkmn/dex` to provide typed access to species, moves, abilities, items, and learnsets. Handles the translation between `@pkmn/dex` internal formats and Nasty Plot's domain types. Supports mega evolution, Z-crystal, and National Dex lookups.

**Key files:**
| File | Purpose |
|------|---------|
| `packages/pokemon-data/src/dex.service.ts` | All dex lookup functions (19 exports) |
| `packages/pokemon-data/src/types.ts` | Package-specific types |

**Exports:** `getDex`, `getSpecies`, `getAllSpecies`, `getMove`, `getAllMoves`, `getAbility`, `getItem`, `getAllItems`, `searchItems`, `getLearnset`, `searchSpecies`, `getTypeChart`, `isMegaStone`, `getMegaStonesFor`, `getMegaForm`, `isZCrystal`, `getZCrystalType`, `getSignatureZCrystal`

**Tests:** 1 test file [Exists]
- `dex.service.test.ts`

**Known issues:** Hardcoded to `Dex.forGen(9)`. No multi-generation support.

---

### 2.4 `formats` -- Format Definitions & Legality

**Status:** Active
**What it does:** Defines the 12 competitive format definitions (Smogon singles tiers, VGC, Battle Stadium) with banlists, rules, and dex scope. Provides legality checking to determine if a Pokemon, move, item, or ability is legal in a given format.

**Key files:**
| File | Purpose |
|------|---------|
| `packages/formats/src/data/format-definitions.ts` | 12 format definitions with banlists |
| `packages/formats/src/format.service.ts` | Legality checking, format lookups |
| `packages/formats/src/types.ts` | Format-specific types |

**Exports:** `FORMAT_DEFINITIONS`, `getFormat`, `getAllFormats`, `getActiveFormats`, `getFormatPokemon`, `isLegalInFormat`, `getFormatItems`, `getFormatMoves`, `getFormatLearnset`

**Tests:** 2 test files [Exists]
- `format-definitions.test.ts`, `format.service.test.ts`

**Format inventory:**

| ID | Name | Game Type | Dex Scope | Active |
|----|------|-----------|-----------|--------|
| `gen9ou` | OU | singles | sv | yes |
| `gen9uu` | UU | singles | sv | yes |
| `gen9ru` | RU | singles | sv | yes |
| `gen9nu` | NU | singles | sv | yes |
| `gen9ubers` | Ubers | singles | sv | yes |
| `gen9lc` | LC | singles | sv | yes |
| `gen9monotype` | Monotype | singles | sv | yes |
| `gen9nationaldex` | National Dex | singles | natdex | yes |
| `gen9nationaldexuu` | National Dex UU | singles | natdex | yes |
| `gen9vgc2024` | VGC 2024 | doubles | sv | no |
| `gen9vgc2025` | VGC 2025 | doubles | sv | yes |
| `gen9battlestadiumsingles` | BSS | singles | sv | yes |
| `gen9battlestadiumdoubles` | BSD | doubles | sv | yes |

**Known issues:** Tier-based bans (e.g. UU banning "OU" and "UUBL") are string references, not dynamically resolved from usage data. Banlists are manually maintained.

---

### 2.5 `smogon-data` -- Usage Stats & Sets

**Status:** Active
**What it does:** Fetches and caches Smogon usage statistics and recommended movesets from `@pkmn/smogon`. Provides teammate correlation data for synergy analysis.

**Key files:**
| File | Purpose |
|------|---------|
| `packages/smogon-data/src/usage-stats.service.ts` | Fetch/query usage percentages and teammates |
| `packages/smogon-data/src/smogon-sets.service.ts` | Fetch/query recommended sets |

**Exports:** `fetchUsageStats`, `getUsageStats`, `getUsageStatsCount`, `getTopPokemon`, `getTeammates`, `fetchSmogonSets`, `getSetsForPokemon`, `getAllSetsForFormat`

**Tests:** 2 test files [Exists]
- `usage-stats.service.test.ts`, `smogon-sets.service.test.ts`

**Known issues:** None significant.

---

### 2.6 `data-pipeline` -- Seeding CLI

**Status:** Active
**What it does:** Provides a CLI command (`pnpm seed`) that fetches Smogon usage data and sets, then seeds the SQLite database. Includes staleness detection to avoid re-fetching fresh data.

**Key files:**
| File | Purpose |
|------|---------|
| `packages/data-pipeline/src/cli/seed.ts` | Main seed script |
| `packages/data-pipeline/src/staleness.service.ts` | Data freshness checks |

**Exports:** `isStale`, `getDataStatus`

**Tests:** 1 test file [Exists]
- `staleness.service.test.ts`

**Known issues:** Seed process is sequential across formats. No incremental/delta sync -- it's a full re-fetch when stale.

---

### 2.7 `teams` -- Team CRUD & Sample Teams

**Status:** Active
**What it does:** Full CRUD for teams and team slots via Prisma. Handles Showdown paste import/export, team validation, and sample team management. Slot reordering, position management, and team clearing are all supported.

**Key files:**
| File | Purpose |
|------|---------|
| `packages/teams/src/team.service.ts` | Team CRUD (create, get, list, update, delete, addSlot, updateSlot, removeSlot, clearSlots, reorderSlots) |
| `packages/teams/src/import-export.service.ts` | Showdown paste import/export |
| `packages/teams/src/validation.service.ts` | Team validation against format rules |
| `packages/teams/src/sample-team.service.ts` | Sample team CRUD and import |

**Exports:** 16 functions + 1 type

**Tests:** 3 test files [Exists]
- `team.service.test.ts`, `import-export.service.test.ts`, `validation.service.test.ts`

**Known issues:** No sample-team.service test file [Missing]. No team versioning or forking.

---

### 2.8 `analysis` -- Type Coverage, Threats, Synergy

**Status:** Active
**What it does:** Analyzes teams for type coverage (offensive and defensive), identifies meta threats based on usage data, calculates synergy scores between team members, and produces aggregate team analysis reports.

**Key files:**
| File | Purpose |
|------|---------|
| `packages/analysis/src/coverage.service.ts` | Offensive/defensive type coverage |
| `packages/analysis/src/threat.service.ts` | Threat identification from usage data |
| `packages/analysis/src/synergy.service.ts` | Teammate synergy scoring |
| `packages/analysis/src/analysis.service.ts` | Aggregate team analysis |

**Exports:** `analyzeTypeCoverage`, `identifyThreats`, `calculateSynergy`, `analyzeTeam`

**Tests:** 4 test files [Exists]
- `coverage.service.test.ts`, `threat.service.test.ts`, `synergy.service.test.ts`, `analysis.service.test.ts`

**Known issues:** None significant. Well-tested.

---

### 2.9 `damage-calc` -- @smogon/calc Wrapper

**Status:** Active
**What it does:** Wraps `@smogon/calc` to provide damage calculation and matchup matrix generation. Translates between Nasty Plot's domain types and the calc library's expected inputs (which require display names, not IDs).

**Key files:**
| File | Purpose |
|------|---------|
| `packages/damage-calc/src/calc.service.ts` | `calculateDamage`, `calculateMatchupMatrix` |

**Tests:** 1 test file [Exists]
- `calc.service.test.ts`

**Known issues:** `@smogon/calc` requires display names (`"Great Tusk"`), not pokemonIds (`"greatTusk"`). Translation happens in this package.

---

### 2.10 `recommendations` -- Pokemon Suggestions

**Status:** Active
**What it does:** Generates Pokemon recommendations for incomplete teams using three strategies: coverage-based (fill type gaps), usage-based (popular teammates from Smogon data), and a composite scorer that blends both signals.

**Key files:**
| File | Purpose |
|------|---------|
| `packages/recommendations/src/coverage-recommender.ts` | Coverage-gap-based recommendations |
| `packages/recommendations/src/usage-recommender.ts` | Usage-correlation-based recommendations |
| `packages/recommendations/src/composite-recommender.ts` | Blended scoring |

**Exports:** `getRecommendations`, `getCoverageBasedRecommendations`, `getUsageBasedRecommendations`

**Tests:** 3 test files [Exists]
- `coverage-recommender.test.ts`, `usage-recommender.test.ts`, `composite-recommender.test.ts`

**Known issues:** No role-based recommendations (e.g. "you need a physical wall"). Recommendations don't account for team archetype (stall, offense, balance).

---

### 2.11 `battle-engine` -- Battle Simulator & AI

**Status:** Active (large, complex package)
**What it does:** Wraps `@pkmn/sim` to run full Pokemon battles. Provides a `BattleManager` that handles the sim lifecycle, a protocol parser for `@pkmn/sim`'s text protocol, and four AI difficulty tiers. Also includes position evaluation, win probability estimation, move hint generation, battle replay, and batch simulation.

**Key files:**

| File | Purpose |
|------|---------|
| `packages/battle-engine/src/battle-manager.ts` | BattleManager -- lifecycle, state extraction, action dispatch |
| `packages/battle-engine/src/protocol-parser.ts` | Parse `@pkmn/sim` protocol lines into structured `BattleLogEntry` |
| `packages/battle-engine/src/team-packer.ts` | Convert `TeamSlotData` to `@pkmn/sim` packed team format |
| `packages/battle-engine/src/types.ts` | BattleState, BattlePokemon, BattleAction, etc. (226 lines) |
| `packages/battle-engine/src/ai/random-ai.ts` | Random move/switch selection |
| `packages/battle-engine/src/ai/greedy-ai.ts` | Pick highest-damage move |
| `packages/battle-engine/src/ai/heuristic-ai.ts` | Multi-factor evaluation (type, speed, status, etc.) |
| `packages/battle-engine/src/ai/mcts-ai.ts` | Monte Carlo Tree Search AI |
| `packages/battle-engine/src/ai/mcts-types.ts` | MCTS configuration types |
| `packages/battle-engine/src/ai/evaluator.ts` | Position evaluation (HP, status, hazards, field) |
| `packages/battle-engine/src/ai/win-probability.ts` | Win probability estimation from position eval |
| `packages/battle-engine/src/ai/hint-engine.ts` | Move classification and hints for the player |
| `packages/battle-engine/src/ai/set-predictor.ts` | Predict opponent sets from Smogon data |
| `packages/battle-engine/src/ai/battle-cloner.ts` | Clone battle state for MCTS rollouts |
| `packages/battle-engine/src/ai/shared.ts` | Shared AI utilities |
| `packages/battle-engine/src/replay/replay-engine.ts` | Replay playback engine |
| `packages/battle-engine/src/simulation/automated-battle-manager.ts` | Run full automated battles (AI vs AI) |
| `packages/battle-engine/src/simulation/batch-simulator.ts` | Run N battles and aggregate statistics |

**Exports:** 18 named exports + types

**Tests:** 4 test files [Exists]
- `protocol-parser.test.ts`, `team-packer.test.ts`, `ai.test.ts`, `evaluator-hints.test.ts`

**Known issues:**
- MCTS runs on the main thread -- no Web Worker offloading [Missing]
- Doubles battle support is defined in types but undertested [Partial]
- No difficulty auto-scaling based on player performance [Missing]

---

### 2.12 `llm` -- Chat Service & MCP Client

**Status:** Active
**What it does:** Provides the LLM chat pipeline: session management (Prisma-backed), context building (team data, meta data, page-aware prompts, battle commentary), OpenAI API integration, SSE streaming to the frontend, and MCP tool execution via `@modelcontextprotocol/sdk`. Also includes a CLI chat mode.

**Key files:**

| File | Purpose |
|------|---------|
| `packages/llm/src/chat.service.ts` | `streamChat` -- main chat entry point |
| `packages/llm/src/chat-session.service.ts` | Session CRUD, message persistence |
| `packages/llm/src/context-builder.ts` | Team/meta/Pokemon/page context prompts |
| `packages/llm/src/battle-context-builder.ts` | Battle commentary/analysis context |
| `packages/llm/src/openai-client.ts` | OpenAI client singleton + model config |
| `packages/llm/src/mcp-client.ts` | MCP client -- tool discovery, execution, resource reading |
| `packages/llm/src/cli-chat.ts` | Terminal-based chat mode |
| `packages/llm/src/stream-parser.ts` | Parse OpenAI streaming responses |
| `packages/llm/src/sse-events.ts` | SSE event type definitions |
| `packages/llm/src/tool-labels.ts` | Human-readable labels for MCP tools |
| `packages/llm/src/tool-context.ts` | Page-aware tool filtering |

**Exports:** 17 functions + 5 types

**Tests:** 4 test files [Exists]
- `chat.service.test.ts`, `chat-session.service.test.ts`, `context-builder.test.ts`, `mcp-client.test.ts`, `openai-client.test.ts`

**Known issues:** No conversation branching or message editing. No multi-model support (hardcoded to one OpenAI model).

---

### 2.13 `mcp-server` -- MCP Tool Server

**Status:** Active
**What it does:** Express-based MCP server (port 3001) implementing the Streamable HTTP transport from `@modelcontextprotocol/sdk`. Exposes 24 tools across 4 modules and 5 resources. Tools proxy to the Next.js API via an HTTP client.

**Key files:**

| File | Purpose |
|------|---------|
| `packages/mcp-server/src/index.ts` | Express server, transport management, health endpoint |
| `packages/mcp-server/src/tools/index.ts` | Tool registration orchestrator |
| `packages/mcp-server/src/tools/data-query.ts` | 7 tools: species/move/ability lookup, type matchups, sets |
| `packages/mcp-server/src/tools/analysis.ts` | 6 tools: coverage, weaknesses, speed tiers, damage, counters, cores |
| `packages/mcp-server/src/tools/team-crud.ts` | 6 tools: team/slot CRUD |
| `packages/mcp-server/src/tools/meta-recs.ts` | 5 tools: meta trends, viability, usage, teammates, set suggestions |
| `packages/mcp-server/src/resources/index.ts` | 5 resources: type chart, formats, natures, stat formulas, viability |
| `packages/mcp-server/src/api-client.ts` | HTTP client to Next.js API (localhost:3000) |
| `packages/mcp-server/src/tool-helpers.ts` | Shared tool registration helpers |

**Tests:** None [Missing] -- tools are integration-level and proxy to the API.

**MCP Tool Inventory:**

| Module | Tools | Count |
|--------|-------|-------|
| `data-query` | `get_pokemon`, `search_pokemon`, `get_moves_by_criteria`, `get_abilities`, `compare_pokemon`, `get_type_matchups`, `get_smogon_sets` | 7 |
| `analysis` | `analyze_team_coverage`, `find_team_weaknesses`, `get_speed_tiers`, `calculate_damage`, `suggest_counters`, `get_common_cores` | 6 |
| `team-crud` | `create_team`, `get_team`, `list_teams`, `add_pokemon_to_team`, `update_pokemon_set`, `remove_pokemon_from_team` | 6 |
| `meta-recs` | `get_meta_trends`, `get_format_viability`, `get_usage_stats`, `suggest_teammates`, `suggest_sets` | 5 |

**MCP Resource Inventory:**

| URI | Content |
|-----|---------|
| `pokemon://type-chart` | Full 18x18 type effectiveness chart (JSON) |
| `pokemon://formats` | Format list with IDs, names, game types (JSON) |
| `pokemon://natures` | All 25 natures with stat modifiers (JSON) |
| `pokemon://stat-formulas` | HP/stat calculation formulas (Markdown) |
| `pokemon://viability/{formatId}` | Top 50 Pokemon by usage for a format (JSON, dynamic) |

---

### 2.14 `ui` -- Shared React Components

**Status:** Functional (small)
**What it does:** Provides three shared React components and a `cn()` utility (clsx + tailwind-merge) used across the web app.

**Key files:**
| File | Purpose |
|------|---------|
| `packages/ui/src/pokemon-sprite.tsx` | Pokemon sprite display component |
| `packages/ui/src/type-badge.tsx` | Colored type badge (Fire, Water, etc.) |
| `packages/ui/src/stat-bar.tsx` | Stat bar visualization |
| `packages/ui/src/utils.ts` | `cn()` utility |

**Tests:** None [Missing] -- visual components, could use snapshot tests.

**Known issues:** Only 3 components. Most UI components live in `apps/web/src/components/` and `apps/web/src/features/` rather than the shared package.

---

## 3. API Surface

33 API routes in `apps/web/src/app/api/`:

### Teams (8 routes)

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/teams` | List all teams |
| `POST` | `/api/teams` | Create a team |
| `GET` | `/api/teams/[teamId]` | Get team details |
| `PUT` | `/api/teams/[teamId]` | Update team |
| `DELETE` | `/api/teams/[teamId]` | Delete team |
| `GET` | `/api/teams/[teamId]/analysis` | Full team analysis |
| `GET` | `/api/teams/[teamId]/export` | Export as Showdown paste |
| `POST` | `/api/teams/[teamId]/import` | Import from Showdown paste |

### Team Slots (2 routes)

| Method | Route | Description |
|--------|-------|-------------|
| `GET/POST` | `/api/teams/[teamId]/slots` | List / add slot |
| `PUT/DELETE` | `/api/teams/[teamId]/slots/[position]` | Update / remove slot |

### Pokemon (5 routes)

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/pokemon` | Search/list with pagination |
| `GET` | `/api/pokemon/[id]` | Species details |
| `GET` | `/api/pokemon/[id]/learnset` | Full learnset |
| `GET` | `/api/pokemon/[id]/sets` | Smogon recommended sets |
| `GET` | `/api/pokemon/[id]/mega-form` | Mega evolution form data |

### Formats & Usage (3 routes)

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/formats` | All format definitions |
| `GET` | `/api/formats/[id]/pokemon` | Legal Pokemon for format |
| `GET` | `/api/formats/[id]/usage` | Usage statistics |

### Battles (5 routes)

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/battles` | Start a new battle |
| `GET` | `/api/battles/[battleId]` | Get battle details |
| `GET` | `/api/battles/[battleId]/replay` | Get replay data |
| `POST` | `/api/battles/batch` | Start batch simulation |
| `GET` | `/api/battles/batch/[batchId]` | Get batch simulation results |

### Chat (4 routes)

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/chat` | Streaming chat response (SSE) |
| `GET/POST` | `/api/chat/sessions` | List / create sessions |
| `GET/DELETE` | `/api/chat/sessions/[id]` | Get / delete session |
| `POST` | `/api/battles/commentary` | Battle turn commentary |

### Sample Teams (3 routes)

| Method | Route | Description |
|--------|-------|-------------|
| `GET/POST` | `/api/sample-teams` | List / create sample teams |
| `GET/DELETE` | `/api/sample-teams/[id]` | Get / delete sample team |
| `POST` | `/api/sample-teams/import` | Bulk import from pastes |

### Other (3 routes)

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/damage-calc` | Single damage calculation |
| `POST` | `/api/damage-calc/matchup-matrix` | Team vs team matrix |
| `POST` | `/api/recommend` | Pokemon recommendations |
| `GET` | `/api/items` | List items |
| `POST` | `/api/data/seed` | Trigger data seeding |
| `GET` | `/api/data/status` | Data freshness check |

---

## 4. App Pages

15 pages in `apps/web/src/app/`:

| Route | Page | Status |
|-------|------|--------|
| `/` | Home / landing | [Exists] |
| `/teams` | Teams list | [Exists] |
| `/teams/new` | Create team | [Exists] |
| `/teams/[teamId]` | Team editor (freeform) | [Exists] |
| `/teams/[teamId]/guided` | Guided team builder | [Exists] |
| `/pokemon` | Pokemon browser | [Exists] |
| `/pokemon/[id]` | Pokemon detail | [Exists] |
| `/damage-calc` | Damage calculator | [Exists] |
| `/chat` | LLM chat interface | [Exists] |
| `/battle` | Battle hub | [Exists] |
| `/battle/new` | Battle setup | [Exists] |
| `/battle/live` | Active battle (live sim) | [Exists] |
| `/battle/simulate` | Batch simulation | [Exists] |
| `/battle/sample-teams` | Sample team browser | [Exists] |
| `/battle/replay/[battleId]` | Battle replay viewer | [Exists] |

### Frontend Feature Modules

| Module | Components | Hooks |
|--------|-----------|-------|
| `battle` | BattleView, BattleSetup, BattleField, BattleLog, MoveSelector, SwitchMenu, TeamPreview, FieldStatus, PokemonSprite, HealthBar, CommentaryPanel, EvalBar, HintPanel, ReplayControls, SampleTeamCard, WinProbabilityGraph | `use-battle`, `use-battle-hints`, `use-replay` |
| `chat` | chat-panel, chat-message, chat-input, chat-tool-call, chat-action-notify, chat-plan-display, chat-session-list | `use-chat-stream`, `use-chat-sessions` |
| `team-builder` | team-grid, team-header, slot-editor, pokemon-search-panel, item-combobox, guided-builder, core-picker, role-selector | `use-team-builder`, `use-guided-builder` |
| `analysis` | coverage-chart, weakness-heatmap, threat-list, speed-tiers | -- |
| `damage-calc` | damage-calculator, matchup-matrix | `use-damage-calc` |
| `recommendations` | recommendation-panel | -- |

### App Shell Components

| File | Purpose |
|------|---------|
| `apps/web/src/components/app-shell.tsx` | Main layout wrapper |
| `apps/web/src/components/site-header.tsx` | Navigation header |
| `apps/web/src/components/chat-sidebar.tsx` | Collapsible chat sidebar |
| `apps/web/src/components/chat-sidebar-resize-handle.tsx` | Drag-to-resize handle |
| `apps/web/src/components/chat-fab.tsx` | Floating action button for chat |
| `apps/web/src/components/theme-toggle.tsx` | Dark/light mode toggle |
| `apps/web/src/components/providers.tsx` | React context providers |

---

## 5. What Works End-to-End

These are user-facing workflows that function today:

1. **Team creation and management** -- Create a team, pick a format, add/remove/reorder Pokemon slots, set moves/EVs/IVs/ability/item/nature/tera type, save to database.

2. **Showdown paste import/export** -- Paste a Showdown team, import it into a new or existing team. Export any team back to Showdown paste format.

3. **Pokemon browsing** -- Search species by name with pagination, view full species details (base stats, types, abilities, weight, tier).

4. **Learnset lookup** -- View the full Gen 9 learnset for any Pokemon, filtered by learn method.

5. **Smogon set browsing** -- View recommended Smogon sets for any Pokemon in any seeded format (moves, EVs, items, abilities).

6. **Type coverage analysis** -- Analyze a team's offensive and defensive type coverage, see uncovered types and shared weaknesses.

7. **Threat identification** -- Identify meta threats to a team based on usage data, ranked by threat level.

8. **Damage calculation** -- Calculate damage between two Pokemon with full EV/IV/item/ability/nature/field customization. See KO chances and damage rolls.

9. **Matchup matrix** -- Generate a full team-vs-team damage matrix showing best moves and KO chances.

10. **Pokemon recommendations** -- Get Pokemon suggestions for an incomplete team based on coverage gaps and usage correlations.

11. **Battle vs AI** -- Start a battle against an AI opponent, complete team preview, make move/switch choices turn by turn, see battle log and results.

12. **AI difficulty tiers** -- Play against Random (picks randomly), Greedy (best immediate damage), Heuristic (multi-factor evaluation), or Expert (MCTS lookahead).

13. **LLM chat with tool use** -- Chat with an OpenAI-backed assistant that has access to 24 MCP tools for Pokemon data lookup, team analysis, and team modification.

14. **Chat session management** -- Create, list, and delete chat sessions. Sessions persist messages in the database.

15. **Battle replay** -- View a completed battle turn-by-turn with replay controls.

16. **Batch simulation** -- Run N automated battles between two teams to get win rate statistics and per-Pokemon performance.

17. **Sample team browsing** -- Browse and import pre-built sample teams by format and archetype.

18. **Data seeding** -- Seed the database with usage stats and Smogon sets via CLI or API.

19. **Guided team building** -- Step-by-step team builder with core picker and role suggestions.

20. **Battle position evaluation** -- Real-time eval bar and win probability during live battles.

21. **Move hints** -- AI-powered move classification and suggestions during live battles.

22. **Battle commentary** -- LLM-generated commentary for battle turns.

---

## 6. Database Schema

13 Prisma models in `prisma/schema.prisma`:

| Model | Row Estimate | Purpose |
|-------|-------------|---------|
| `Format` | 12 | Format definitions seeded from code |
| `UsageStats` | ~thousands | Monthly usage percentages per format |
| `SmogonSet` | ~thousands | Recommended movesets per format |
| `TeammateCorr` | ~thousands | Pokemon pair synergy data |
| `CheckCounter` | ~thousands | Counter/check relationships |
| `Team` | user-created | User teams |
| `TeamSlot` | user-created | Pokemon on teams (1-6 per team) |
| `DataSyncLog` | ~24 | Seed job tracking (2 sources x 12 formats) |
| `ChatSession` | user-created | LLM chat sessions |
| `ChatMessage` | user-created | Chat messages |
| `Battle` | user-created | Battle records with full protocol logs |
| `BattleTurn` | user-created | Per-turn state snapshots and actions |
| `BatchSimulation` | user-created | Batch simulation configurations and results |
| `SampleTeam` | imported | Pre-built sample teams |

---

## 7. Test Coverage

29 test files across 10 packages:

| Package | Test Files | Files |
|---------|-----------|-------|
| `core` | 3 | type-chart, stat-calc, showdown-paste |
| `pokemon-data` | 1 | dex.service |
| `formats` | 2 | format-definitions, format.service |
| `smogon-data` | 2 | usage-stats.service, smogon-sets.service |
| `data-pipeline` | 1 | staleness.service |
| `teams` | 3 | team.service, import-export.service, validation.service |
| `analysis` | 4 | coverage.service, threat.service, synergy.service, analysis.service |
| `damage-calc` | 1 | calc.service |
| `recommendations` | 3 | coverage-recommender, usage-recommender, composite-recommender |
| `battle-engine` | 4 | protocol-parser, team-packer, ai, evaluator-hints |
| `llm` | 5 | chat.service, chat-session.service, context-builder, mcp-client, openai-client |
| `db` | 0 | -- |
| `mcp-server` | 0 | -- |
| `ui` | 0 | -- |

**Packages with no tests:** `db`, `mcp-server`, `ui`

---

## 8. Known Gaps

### Critical

| Gap | Details | Where |
|-----|---------|-------|
| VGC doubles team preview | The `Bring 4` rule (pick 4 of 6, choose 2 leads) is defined in format rules but the UI has no 4-pick/2-lead selection flow | `apps/web/src/features/battle/components/TeamPreview.tsx` |
| Doubles battle testing | Doubles game type is in the types and format definitions but is not well-tested in the battle engine or UI | `packages/battle-engine/` |
| Damage preview on move hover | No hover tooltip showing damage estimates before selecting a move | `apps/web/src/features/battle/components/MoveSelector.tsx` |

### Important

| Gap | Details | Where |
|-----|---------|-------|
| MCTS Web Worker | Expert AI runs MCTS on the main thread, blocking the UI | `packages/battle-engine/src/ai/mcts-ai.ts` |
| Team versioning/forking | No version history or ability to fork a team | `packages/teams/` |
| Post-game review UI | Battle data is stored but no dedicated review/analysis page | `apps/web/src/app/battle/` |
| MCP server tests | 24 tools with zero test coverage | `packages/mcp-server/` |
| Sample team tests | `sample-team.service.ts` has no tests | `packages/teams/src/sample-team.service.ts` |
| Role-based recommendations | Recommendations don't consider team roles (wall, sweeper, pivot) | `packages/recommendations/` |
| Multi-model LLM support | Hardcoded to a single OpenAI model | `packages/llm/src/openai-client.ts` |

### Nice-to-Have

| Gap | Details |
|-----|---------|
| Move animations | No visual feedback for moves in battle |
| Sound effects | Silent battle experience |
| Mobile responsive battle UI | Battle layout is desktop-oriented |
| Tournament mode | No bracket/Swiss tournament system |
| Team archetype detection | No automatic classification of team archetype (rain, stall, etc.) |
| Multi-generation support | Everything hardcoded to Gen 9 |
| Conversation branching | Chat sessions are linear, no message editing or branching |
| Meta profiles | No saved meta snapshots for comparing across months |
| UI component tests | Shared `ui` package has no tests |
| Incremental data sync | Full re-fetch on every seed, no delta updates |

---

## 9. Dependency Graph

```
Layer 0 (Foundation):    core, db
Layer 1 (Data):          pokemon-data, formats, smogon-data, data-pipeline
Layer 2 (Domain):        teams, analysis, damage-calc, recommendations, battle-engine
Layer 3 (Feature):       llm, mcp-server
Layer 4 (Presentation):  ui, web
```

Key dependency chains:
- `web` -> `llm` -> `mcp-server` (via MCP client) -> `web` (via API client) -- circular at runtime
- `battle-engine` -> `core` + `pokemon-data` (for AI evaluation)
- `analysis` -> `core` + `pokemon-data` + `smogon-data` (for threat identification)
- `recommendations` -> `analysis` + `smogon-data` (for composite scoring)
- `teams` -> `core` + `db` (for CRUD and validation)

Note: The `mcp-server` -> `web` API dependency creates a runtime circular dependency. The MCP server proxies tool calls to the Next.js API routes. Both must be running for the chat system to work.
