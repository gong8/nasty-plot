# Nasty Plot

## Project

Pokemon team building simplifier and competitive analysis teaching playground. Dual purpose: a usable tool for building and analyzing teams, and a learning platform for competitive Pokemon concepts.

**Stack:** Turborepo + pnpm monorepo, Next.js 16 (App Router + Turbopack), TypeScript 5, React 19, Prisma/SQLite, Vitest
**Scope:** Gen 9 (Scarlet/Violet), Smogon singles formats (OU, UU, etc.) + VGC doubles

## Architecture

```
tests/                      Vitest tests — one subdir per package (43 test files)

apps/
  web/                    Next.js 16 app — UI, API routes

packages/
  core/                   Domain types (TeamSlotData, PokemonSpecies), constants, type chart, stat calc, Showdown paste parser
  db/                     Prisma client singleton (prisma + SQLite adapter)
  pokemon-data/           @pkmn/dex wrapper — species, moves, abilities, items, learnsets
  formats/                Format definitions (OU, UU, VGC...) and legality checking
  smogon-data/            Fetch/cache usage stats, Smogon sets, teammate correlations from @pkmn/smogon
  data-pipeline/          Data seeding CLI (seed.ts) and staleness detection
  teams/                  Team CRUD, slot management, Showdown import/export, validation, sample teams
  analysis/               Type coverage analysis, threat identification, synergy scoring
  damage-calc/            @smogon/calc wrapper — damage calculation, matchup matrices
  recommendations/        Pokemon recommendations (coverage-based, usage-based, composite)
  llm/                    OpenAI/Claude chat service, MCP client, session management, context/battle context builders, CLI chat, stream parser
  battle-engine/          @pkmn/sim battle simulator, protocol parser, AI players (Random, Greedy, Heuristic, MCTS Expert), evaluator, hints, replay, batch sim
  ui/                     Shared React components (PokemonSprite, TypeBadge, StatBar, cn utility)
  mcp-server/             MCP server (24 tools, 5 resources) — Claude integration via express on port 3001
```

### Dependency Layers

```
Foundation:   core, db
Data:         pokemon-data, formats, smogon-data, data-pipeline
Domain:       teams, analysis, damage-calc, recommendations, battle-engine
Feature:      llm, mcp-server
Presentation: ui, web
```

### Package Conventions

- **Barrel exports** from `src/index.ts` in every package
- **Service pattern:** pure functions from `{name}.service.ts` — no class-based services (exception: AI players in battle-engine use classes)
- **Package scope:** `@nasty-plot/<name>`
- **Module type:** ESM everywhere (`"type": "module"`)
- **Exports field:** `"exports": { ".": "./src/index.ts" }` (source, transpiled by Turbopack/Next.js)
- **Tests:** top-level `tests/` directory mirroring package structure (e.g. `tests/core/`, `tests/battle-engine/`). Single root `vitest.config.ts`

## Key Domain Concepts

- **`pokemonId`** — camelCase Showdown ID (e.g. `"greatTusk"`, `"ironValiant"`). Used everywhere as the canonical identifier.
- **`name`** — display name (e.g. `"Great Tusk"`). Used for UI and `@smogon/calc` (which requires display names, not IDs).
- **`TeamSlotData`** — central domain type (`packages/core/src/types.ts`). Represents one Pokemon on a team: species, ability, item, nature, tera type, moves (4-tuple), EVs, IVs, level, position (1-6).
- **Species hydration** — `getSpecies(pokemonId)` from `packages/pokemon-data/src/dex.service.ts` converts a `pokemonId` to a full `PokemonSpecies` with base stats, types, abilities.
- **Showdown paste format** — standard Pokemon team text format. Parser/exporter at `packages/core/src/showdown-paste.ts`.
- **Stat abbreviations:** `hp`, `atk`, `def`, `spa`, `spd`, `spe` — used in `StatsTable` (`Record<StatName, number>`)
- **`@pkmn` ecosystem:** `dex` (data lookup), `data` (generation-aware data), `sim` (battle simulation), `img` (sprite URLs), `smogon` (usage statistics)
- **Gen 9 hardcoded:** `Dex.forGen(9)` used throughout. No multi-gen support currently.
- **`@pkmn/dex` damageTaken encoding:** `0` = neutral, `1` = super effective, `2` = resist, `3` = immune (counterintuitive!)
- **`@smogon/calc`** needs display names (`"Great Tusk"`), not IDs (`"greatTusk"`)
- **`@pkmn/sim` BattleStream protocol:** `|move|`, `|-damage|`, `|switch|`, `|turn|`, `|win|` — parsed in `packages/battle-engine/src/protocol-parser.ts`
- **`AIDifficulty`** — `"random"` | `"greedy"` | `"heuristic"` | `"expert"` — maps to AI player classes `RandomAI`, `GreedyAI`, `HeuristicAI`, `MCTSAI`
- **`BattleState`** — central battle type with `sides` (p1/p2), `field`, `turn`, `phase` ("setup"/"preview"/"battle"/"ended"), `winner`
- **`SampleTeam`** — example teams with archetype tags (HO, Balance, Stall, etc.), stored in DB, browsable in UI

## Development Commands

```bash
pnpm dev              # Next.js + MCP server + dev proxy (all concurrently)
pnpm dev:mcp          # MCP server only (port 3001)
pnpm dev:proxy        # Dev proxy only (claude-max-api-proxy on port 3456)
pnpm test             # Vitest run (CI mode)
pnpm test:watch       # Vitest watch mode
pnpm test:coverage    # Vitest with V8 coverage
pnpm build            # Next.js build
pnpm seed             # Seed DB with Smogon usage data
pnpm db:generate      # Regenerate Prisma client + fix ESM package.json
pnpm db:migrate       # Run pending migrations (prisma migrate dev)
pnpm db:push          # Push schema changes without migration (prisma db push)
```

**Gotcha:** After `prisma generate`, restart the dev server. Turbopack caches the stale Prisma client and won't pick up schema changes until restarted.

## Database

**Prisma + SQLite** — schema at `prisma/schema.prisma`, database at `prisma/dev.db`
**Client output:** `generated/prisma` (ESM-compatible via `db:generate` script)
**Client:** singleton from `@nasty-plot/db` (`import { prisma } from "@nasty-plot/db"`)

**Models (14):**

| Model             | Purpose                        | Key Fields                                                                                                                                 |
| ----------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `Format`          | Competitive format definitions | `id` (string PK), `name`, `generation`, `gameType`, `isActive`                                                                             |
| `UsageStats`      | Monthly usage percentages      | `formatId`, `pokemonId`, `usagePercent`, `rank`, `year`, `month`                                                                           |
| `SmogonSet`       | Recommended movesets           | `formatId`, `pokemonId`, `setName`, `moves` (JSON), `evs` (JSON), `ivs` (JSON)                                                             |
| `TeammateCorr`    | Pokemon pair synergy data      | `formatId`, `pokemonAId`, `pokemonBId`, `correlationPercent`                                                                               |
| `CheckCounter`    | What beats what                | `formatId`, `targetId`, `counterId`, `koPercent`, `switchPercent`                                                                          |
| `Team`            | User teams                     | `id` (uuid), `name`, `formatId`, `mode` ("freeform"/"guided"), `notes`                                                                     |
| `TeamSlot`        | Pokemon on a team (1-6)        | `pokemonId`, `position`, `ability`, `item`, `nature`, `move1-4`, `evHp/Atk/Def/SpA/SpD/Spe`, `ivHp/Atk/Def/SpA/SpD/Spe`                    |
| `DataSyncLog`     | Seed job tracking              | `source`, `formatId`, `lastSynced`, `status`, `message`                                                                                    |
| `ChatSession`     | LLM chat sessions              | `id` (uuid), `teamId`, `title`                                                                                                             |
| `ChatMessage`     | Chat messages                  | `sessionId`, `role`, `content`, `toolCalls` (JSON)                                                                                         |
| `Battle`          | Simulated/played battles       | `id` (uuid), `formatId`, `gameType`, `mode`, `aiDifficulty`, `team1Paste`, `team2Paste`, `winnerId`, `turnCount`, `protocolLog`, `batchId` |
| `BattleTurn`      | Individual turn data           | `battleId`, `turnNumber`, `team1Action` (JSON), `team2Action` (JSON), `stateSnapshot` (JSON), `winProbTeam1`                               |
| `BatchSimulation` | Bulk battle runner             | `id` (uuid), `formatId`, `totalGames`, `completedGames`, `team1Wins`, `team2Wins`, `draws`, `status`, `analytics` (JSON)                   |
| `SampleTeam`      | Example teams for UI           | `id` (uuid), `name`, `formatId`, `archetype`, `source`, `sourceUrl`, `paste`, `pokemonIds`, `isActive`                                     |

**Note:** `TeamSlot` stores EVs/IVs as individual columns (`evHp`, `evAtk`, etc.) and moves as `move1`-`move4` (not arrays).

## API Routes

All routes in `apps/web/src/app/api/`. Convention: routes import service functions from packages, handle HTTP concerns only.

**Teams**

- `GET/POST /api/teams` — list / create
- `GET/PUT/DELETE /api/teams/[teamId]` — read / update / delete
- `GET /api/teams/[teamId]/analysis` — full team analysis
- `GET /api/teams/[teamId]/export` — Showdown paste export
- `POST /api/teams/[teamId]/import` — Showdown paste import
- `GET/POST /api/teams/[teamId]/slots` — list / add slot
- `PUT/DELETE /api/teams/[teamId]/slots/[position]` — update / remove slot

**Pokemon**

- `GET /api/pokemon` — search/list with pagination
- `GET /api/pokemon/[id]` — species details
- `GET /api/pokemon/[id]/learnset` — full learnset
- `GET /api/pokemon/[id]/sets` — Smogon sets
- `GET /api/pokemon/[id]/mega-form` — mega form data

**Formats & Usage**

- `GET /api/formats` — all formats
- `GET /api/formats/[id]/pokemon` — legal Pokemon for format
- `GET /api/formats/[id]/usage` — usage statistics

**Damage Calc**

- `POST /api/damage-calc` — single calculation
- `POST /api/damage-calc/matchup-matrix` — team vs team matrix

**Battles**

- `GET/POST /api/battles` — list / create battles
- `GET/DELETE /api/battles/[battleId]` — get / delete battle
- `GET /api/battles/[battleId]/replay` — replay data
- `POST /api/battles/batch` — batch simulation
- `GET/DELETE /api/battles/batch/[batchId]` — get / delete batch
- `POST /api/battles/commentary` — battle commentary stream

**Sample Teams**

- `GET/POST /api/sample-teams` — list / create sample teams
- `GET/DELETE /api/sample-teams/[id]` — get / delete sample team
- `POST /api/sample-teams/import` — import sample team

**Chat**

- `POST /api/chat` — streaming chat response
- `GET/POST /api/chat/sessions` — list / create sessions
- `GET/PUT/DELETE /api/chat/sessions/[id]` — get / update / delete session

**Other**

- `GET /api/items` — list items
- `POST /api/recommend` — Pokemon recommendations for team
- `POST /api/data/seed` — trigger data seeding
- `GET /api/data/status` — data freshness check

## App Pages

| Route                       | Page                     |
| --------------------------- | ------------------------ |
| `/`                         | Home                     |
| `/teams`                    | Teams list               |
| `/teams/new`                | Create team              |
| `/teams/[teamId]`           | Team editor              |
| `/teams/[teamId]/guided`    | Guided team builder      |
| `/pokemon`                  | Pokemon browser          |
| `/pokemon/[id]`             | Pokemon detail           |
| `/damage-calc`              | Damage calculator        |
| `/chat`                     | LLM chat interface       |
| `/battle`                   | Battle hub               |
| `/battle/new`               | Battle setup             |
| `/battle/live`              | Active battle (live sim) |
| `/battle/simulate`          | Battle simulator         |
| `/battle/sample-teams`      | Sample teams browser     |
| `/battle/replay/[battleId]` | Battle replay viewer     |

## Coding Conventions

- **Strict TypeScript** — `strict: true` in tsconfig, composite project references
- **ESM modules** — `"type": "module"` in all packages
- **Service pattern** — pure functions from `{name}.service.ts`, no classes (except AI players)
- **React** — functional components, named exports, Radix UI primitives + Tailwind CSS + `cn()` utility from `@nasty-plot/ui`
- **Tests** — Vitest with `globals: true`, all tests in top-level `tests/` directory. Import module under test via `@nasty-plot/<pkg>` barrel, mock sibling modules via `#<pkg>/<module>` alias (e.g. `vi.mock("#analysis/coverage.service", ...)`). `@testing-library/react` for component tests
- **API errors** — `NextResponse.json({ error: "message" }, { status: 4xx })` pattern
- **Zod validation** — used in MCP server tool schemas for input validation
- **Barrel exports** — every package re-exports through `src/index.ts`
- **No default exports** — named exports everywhere

## MCP Server

**Location:** `packages/mcp-server/`, runs on port 3001 (env: `MCP_PORT`)
**Protocol:** Streamable HTTP via `@modelcontextprotocol/sdk`, express server

**Tool Modules** (24 tools total, in `src/tools/`):

| Module              | Tools                                                                                                                                | Purpose              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------- |
| `data-query.ts` (7) | `get_pokemon`, `search_pokemon`, `get_moves_by_criteria`, `get_abilities`, `compare_pokemon`, `get_type_matchups`, `get_smogon_sets` | Pokemon data lookup  |
| `analysis.ts` (6)   | `analyze_team_coverage`, `find_team_weaknesses`, `get_speed_tiers`, `calculate_damage`, `suggest_counters`, `get_common_cores`       | Team analysis        |
| `team-crud.ts` (6)  | `create_team`, `get_team`, `list_teams`, `add_pokemon_to_team`, `update_pokemon_set`, `remove_pokemon_from_team`                     | Team management      |
| `meta-recs.ts` (5)  | `get_meta_trends`, `get_format_viability`, `get_usage_stats`, `suggest_teammates`, `suggest_sets`                                    | Meta recommendations |

**Resources** (5, in `src/resources/`): `pokemon://type-chart`, `pokemon://formats`, `pokemon://natures`, `pokemon://stat-formulas`, `pokemon://viability/{formatId}`

**Pattern:** Each module exports `register*Tools(server)`, called from `src/tools/index.ts`. Tools call Next.js API via `api-client.ts` (`http://localhost:3000`).

## Linear Integration

**Workspace:** sentinel-dev | **Team:** nasty-plot | **Prefix:** NAS
**Statuses:** Backlog → Todo → In Progress → In Review → Done (also: Canceled, Duplicate)
**Labels:** Bug, Feature, Improvement, Test, Chore, Consideration, GTM, Misc

**Tool loading:** Linear MCP tools are deferred. Load them via `ToolSearch` with query `"+linear"` before first use each session.

### Session Start

1. Load Linear tools via `ToolSearch` (query: `"+linear list issues"`)
2. Run `mcp__plugin_linear_linear__list_issues` with `team: "nasty-plot"` and `state: "started"` to see in-progress work
3. If the user has a specific task, check if a Linear issue already exists before creating a new one

### Working on a Task

1. **Find or create the issue** — search existing issues first. If none exists, create one with `mcp__plugin_linear_linear__create_issue` using `team: "nasty-plot"`
2. **Move to In Progress** — update the issue with `state: "In Progress"` when you begin
3. **Move to Done** — update the issue with `state: "Done"` when complete

### Discoveries Mid-Task

When you discover bugs, TODOs, or follow-up work while working on something else:

1. **Create a new issue immediately** — don't ask, just create it. Use appropriate labels:
   - `Bug` — something broken
   - `Feature` — new functionality
   - `Improvement` — enhancement to existing code
   - `Chore` — maintenance, refactoring, config
   - `Test` — missing or needed tests
2. Set priority: `1`=Urgent, `2`=High, `3`=Normal (default), `4`=Low
3. Add a description with file paths, reproduction steps, and what you observed
4. Continue working on the original task — don't get sidetracked

### Issue Conventions

- **Titles:** short, imperative. e.g. "Fix type error in battle damage calc", "Add Pokemon search by ability"
- **Descriptions:** include file paths, code references, and enough context for a future session to pick it up
- **Labels:** always apply at least one
- **Priority:** default to `3` (Normal) unless clearly urgent or low-priority

### Completing Work

1. Update all issues you touched to their correct state (Done, In Review, etc.)
2. If work is incomplete, leave the issue In Progress with a comment describing current state and next steps using `mcp__plugin_linear_linear__create_comment`
3. Write session notes (see Session Management below)

## "What Should I Do Next?" Workflow

When the user asks what to work on, follow this decision tree:

1. **Check Linear** — query Todo + In Progress issues (`mcp__plugin_linear_linear__list_issues` with `team: "nasty-plot"`). Present high-priority items first.
2. **Check plans/** — read plan files in `plans/` (active plans) and `plans/archived/` (completed plans) for roadmap phases and incomplete work.
3. **Check sessions/** — read recent session summaries in `sessions/` for "Known issues & next steps" sections.
4. **Synthesize** — present a prioritized list combining all sources. Recommend the most impactful next step, considering:
   - Urgency (bugs > features > improvements)
   - Dependencies (unblock other work first)
   - Plan phases (complete current phase before starting next)
   - User momentum (what they were working on recently)

## Session Management

- **Session summaries** go in `sessions/YYYY-MM-DD/{slug}.md` (date subdirectory, then slug filename)
- Use `/summary` command at end of sessions to generate one
- **Template sections:** Accomplishments, Key Decisions, Bugs Found, Pitfalls Encountered, Files Changed, Known Issues & Next Steps, Technical Notes
- At session start, read recent session files in `sessions/` for context on what happened last
- When work is incomplete: update Linear issue comments AND write session notes

## Execution Strategy: Parallel Agents & Teams

**Always maximize parallelism.** Token budget is not a constraint — speed and thoroughness are. Follow these rules:

- **Default to parallel agents.** When a task involves multiple independent subtasks (research, exploration, implementation across packages, running tests), spawn parallel agents via the `Task` tool. Do not serialize work that can run concurrently.
- **Use agent teams for multi-package or multi-concern work.** For features, refactors, or investigations spanning 2+ packages, create a team with `TeamCreate` and assign teammates to work in parallel. Examples:
  - Feature touching `core` + `teams` + `web` → 3 teammates, one per package
  - Bug investigation → one agent exploring logs/errors, another reading relevant code, another checking tests
  - New API endpoint → one agent on the route + service, another on tests, another on types/validation
- **Explore agents are cheap — use them liberally.** When investigating unfamiliar code, spawn multiple `Explore` agents in parallel to search different areas of the codebase simultaneously rather than searching sequentially.
- **Research in parallel.** When you need to understand multiple packages, files, or concepts, launch parallel `Task` calls with `subagent_type=Explore` or `subagent_type=general-purpose` for each area.
- **Run background agents.** For long-running tasks (builds, test suites, complex searches), use `run_in_background: true` and continue working on other things while they execute.
- **Batch independent tool calls.** Always group independent `Glob`, `Grep`, `Read`, and `Bash` calls into a single message. Never make sequential calls when parallel calls would work.
- **Don't duplicate agent work.** If you delegate research to a subagent, don't also do the same search yourself. Trust agent results.

**Rule of thumb:** If you're about to do 3+ sequential operations that don't depend on each other, stop and parallelize them instead.

## Technical Gotchas

- **`@pkmn/dex` damageTaken encoding:** `0`=neutral, `1`=super effective, `2`=resist, `3`=immune — this is counterintuitive and easy to get wrong
- **`@smogon/calc` display names:** requires `"Great Tusk"` not `"greatTusk"` — use `species.name` not `pokemonId`
- **`@pkmn/sim` BattleStream:** protocol lines like `|move|p1a: Great Tusk|Headlong Rush|p2a: Iron Valiant` — parser at `packages/battle-engine/src/protocol-parser.ts`
- **Prisma + Turbopack cache:** after `prisma generate`, the dev server serves stale client until restarted
- **TeamSlot storage:** EVs/IVs are individual columns (`evHp`, `evAtk`...), moves are `move1`-`move4` — requires manual mapping to/from `StatsTable` and arrays
- **Gen 9 only:** everything is hardcoded to `Dex.forGen(9)`. No multi-generation support exists.
