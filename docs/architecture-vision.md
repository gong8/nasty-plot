# Architecture Vision

How the Nasty Plot codebase evolves: package structure, growth patterns, performance strategy, and the rules that keep it coherent.

---

## 1. Current Architecture

### Package Map

14 packages across 5 dependency layers (Foundation, Data, Domain, Feature, Presentation). Data flows downward; no package ever imports from a higher layer.

```
                         +-----------+
                         |    web    |  Next.js 16, App Router, Turbopack
                         +-----+-----+
                               |
               +---------------+---------------+
               |               |               |
          +----+----+    +-----+-----+    +----+----+
          |   llm   |    | mcp-server|    |   ui    |
          +---------+    +-----+-----+    +---------+
               |               |               |
    +----------+----------+----+----+----------+
    |          |           |        |           |
+---+--+ +----+---+ +-----+----+ +-+------+ +-+---------+
| teams| |analysis| |damage-calc| |battle- | |recommen-  |
|      | |        | |           | |engine  | |dations    |
+--+---+ +---+----+ +-----+----+ +---+----+ +-----+-----+
   |         |             |          |            |
   +----+----+----+--------+----+-----+----+-------+
        |         |             |          |
   +----+---+ +---+----+ +-----+----+ +---+------+
   |pokemon-| |smogon- | |  formats | |   data-  |
   |data    | |data    | |          | |  pipeline|
   +---+----+ +---+----+ +----+----+  +----+-----+
       |          |            |            |
       +-----+---+----+-------+------+-----+
             |         |              |
          +--+--+   +--+--+
          | core|   |  db |
          +-----+   +-----+
```

### Actual Dependency Graph (from `package.json`)

| Package | Workspace Dependencies | External Dependencies |
|---------|----------------------|----------------------|
| `core` | *(none)* | *(none)* |
| `db` | *(none)* | `@prisma/client`, `@prisma/adapter-better-sqlite3` |
| `pokemon-data` | `core` | `@pkmn/dex`, `@pkmn/data` |
| `smogon-data` | `core`, `db` | `@pkmn/smogon` |
| `formats` | `core`, `pokemon-data` | *(none)* |
| `data-pipeline` | `db`, `formats`, `smogon-data` | *(none)* |
| `teams` | `core`, `db`, `pokemon-data` | *(none)* |
| `analysis` | `core`, `db` | `@pkmn/dex` |
| `damage-calc` | `core` | `@smogon/calc`, `@pkmn/dex`, `@pkmn/data` |
| `battle-engine` | `core` | `@pkmn/sim`, `@pkmn/dex`, `@pkmn/data`, `@smogon/calc` |
| `recommendations` | `core`, `db`, `analysis` | `@pkmn/dex` |
| `llm` | `core`, `db`, `battle-engine` | `openai`, `@modelcontextprotocol/sdk` |
| `mcp-server` | *(none -- calls web API)* | `@modelcontextprotocol/sdk`, `express`, `zod` |
| `ui` | `core` | `react`, `clsx`, `tailwind-merge`, `class-variance-authority` |
| `web` | *all 13 workspace packages* | `next`, `react`, `radix-ui`, `recharts`, etc. |

Key observations:

- `core` is a zero-dependency leaf. Every workspace package can depend on it.
- `db` is also a leaf -- it wraps Prisma and exposes a singleton client.
- `mcp-server` has zero workspace dependencies. It calls the Next.js API over HTTP (`localhost:3000`), not through package imports. This is intentional: it can run in a separate process and doesn't couple to internal service code.
- `battle-engine` depends only on `core` plus external `@pkmn` packages. It has no database access.
- `web` is the aggregation point. It imports everything through Turbopack source transpilation.

### Package Conventions

Every package follows the same structure:

```
packages/<name>/
  package.json          # "type": "module", "exports": { ".": "./src/index.ts" }
  src/
    index.ts            # barrel exports
    <name>.service.ts   # primary service (pure functions)
```

Tests live in the top-level `tests/` directory, mirroring package structure (e.g. `tests/core/`, `tests/battle-engine/`). A single root `vitest.config.ts` covers all packages.

- **ESM everywhere.** `"type": "module"` in every `package.json`.
- **Source exports.** Packages export raw TypeScript (`"./src/index.ts"`). No build step per package -- Turbopack and Vitest handle transpilation.
- **Service pattern.** Business logic lives in `*.service.ts` files as pure exported functions. No class-based services (exception: AI players in `battle-engine`, which carry state across turns).
- **Barrel exports.** Every package re-exports its public API from `src/index.ts`.

---

## 2. New Packages

Three new packages are planned. Each solves a specific concern that doesn't belong in existing packages.

### `packages/version` (Milestone 2)

Team versioning: fork, compare, merge, lineage tracking.

```typescript
// packages/version/src/types.ts

interface SlotChange {
  position: number;
  field: string;        // "pokemonId" | "ability" | "move1" | "evHp" | ...
  before: string | number | null;
  after: string | number | null;
}

interface TeamDiff {
  sourceId: string;
  targetId: string;
  changes: SlotChange[];
  addedSlots: number[];    // positions added
  removedSlots: number[];  // positions removed
}

interface MergeDecision {
  position: number;
  field: string;
  choice: "source" | "target" | "manual";
  value: string | number | null;
}

interface LineageNode {
  teamId: string;
  teamName: string;
  parentId: string | null;
  branchName: string | null;
  createdAt: string;
  children: LineageNode[];
}
```

**Layer:** Domain (depends on: `core`, `db`, `teams`)

**Why separate from `teams`?** The `teams` package handles CRUD -- creating, reading, updating, deleting teams and slots. Version operations (diffing two teams, forking with a branch name, three-way merge resolution, lineage tree construction) are algorithmically complex and independently testable. Mixing them into `teams` would double its surface area with unrelated logic.

**Service API sketch:**

```typescript
// packages/version/src/version.service.ts
export function forkTeam(teamId: string, branchName: string): Promise<TeamData>
export function compareTeams(sourceId: string, targetId: string): Promise<TeamDiff>
export function mergeTeams(sourceId: string, targetId: string, decisions: MergeDecision[]): Promise<TeamData>
export function getLineage(teamId: string): Promise<LineageNode>
```

### `packages/meta` (Milestone 2)

Meta profile definition, storage, and simulation. A "meta profile" is a named snapshot of a competitive metagame: the top N Pokemon with their usage rates, common sets, and team archetypes.

**Layer:** Domain (depends on: `core`, `db`, `smogon-data`, `formats`)

**Use cases:**
- Define a target meta from live usage data or manual curation
- Score a team against a meta profile (coverage, threat exposure, speed tier distribution)
- Track meta shifts over time by comparing profiles across months

### `packages/training` (Milestone 3)

Battle puzzles, pattern drilling, post-game review.

**Layer:** Domain (depends on: `core`, `db`, `battle-engine`)

**Key types:**
- `Puzzle` -- a frozen battle position with a best action and explanation
- `LearningPath` -- an ordered sequence of concepts (type matchups, switch timing, hazard control) with associated puzzles
- `ReviewReport` -- post-game analysis of a completed battle (mistake identification, win probability timeline)

---

## 3. Package Growth and Splitting

### When to Split a Package

Three triggers, any one sufficient:

1. **File count exceeds ~30 source files.** The package is doing too much.
2. **Two independent concerns share a package.** If you can describe the package with "X and Y" instead of "X," consider splitting at the conjunction.
3. **Different deployment targets.** If part of a package must run in a Web Worker and part needs Node APIs, split.

### `battle-engine`: The Splitting Case Study

`battle-engine` is the largest package today with 19 source files:

```
src/
  battle-manager.ts        # BattleStream orchestration
  protocol-parser.ts       # |move|, |switch|, |-damage| parsing
  team-packer.ts           # paste <-> packed format conversion
  types.ts                 # BattleState, BattleAction, AIPlayer, etc.
  index.ts                 # barrel

  ai/
    shared.ts              # type effectiveness helpers
    random-ai.ts           # random action selection (Random tier)
    greedy-ai.ts           # best immediate move (Greedy tier)
    heuristic-ai.ts        # weighted feature evaluation (Heuristic tier)
    mcts-ai.ts             # Monte Carlo tree search, Decoupled UCT (MCTS Expert tier)
    mcts-types.ts          # MCTS configuration and node types
    evaluator.ts           # position evaluation [-1, +1] scoring
    win-probability.ts     # eval score -> win% conversion
    hint-engine.ts         # move classification and hint generation
    battle-cloner.ts       # battle state serialization/cloning
    set-predictor.ts       # opponent set inference from observations

  simulation/
    automated-battle-manager.ts   # AI-vs-AI battle runner
    batch-simulator.ts            # multi-game batch simulation

  replay/
    replay-engine.ts       # protocol log playback
```

Tests are in the top-level `tests/battle-engine/` directory (11 test files).

Three distinct concerns are visible:

| Concern | Files | Purpose |
|---------|-------|---------|
| **Core simulation** | `battle-manager.ts`, `protocol-parser.ts`, `team-packer.ts`, `types.ts`, `replay/` | Running and observing battles |
| **AI players** | `ai/*` (11 files) | 4 AI tiers (Random, Greedy, Heuristic, MCTS Expert), plus evaluator, win-probability, hints, set-predictor, battle-cloner |
| **Batch simulation** | `simulation/*` (2 files) | Running many battles and computing analytics |

**Planned split at Milestone 3:**

```
packages/
  battle-engine/     # Core sim: BattleManager, protocol parser, team packer, replay
  battle-ai/         # AI players, evaluator, hints, set predictor, MCTS
  battle-sim/        # Batch simulation, analytics, automated battle runner
```

The trigger is M3's training features: `packages/training` needs AI evaluation and hint generation (from `battle-ai`) but not batch simulation. Without the split, `training` would pull in the entire batch simulation system as a transitive dependency.

Dependency chain after split:

```
battle-sim  -->  battle-ai  -->  battle-engine  -->  core
                                                -->  @pkmn/sim
training  ------>  battle-ai
```

### Splitting Mechanics

When splitting a package:

1. Create the new `packages/<name>/` with the standard structure.
2. Move files, updating import paths.
3. Re-export from the original package for backward compatibility during the transition. Remove the re-exports in the next milestone.
4. Update `package.json` dependencies in all consumers.
5. Run `pnpm install` to update the lockfile.
6. Run tests across all affected packages.

---

## 4. Performance Roadmap

### Current: Single-Thread, Cooperative Scheduling

All battle simulation runs on the main Node.js thread:

```
                     Node.js Main Thread
  ┌──────────────────────────────────────────────────┐
  │                                                  │
  │  BattleManager         MCTS AI                   │
  │  ┌─────────────┐      ┌──────────────────┐       │
  │  │ BattleStream │ <--> │ 10,000 iterations│       │
  │  │ (async iter) │      │ (blocks thread)  │       │
  │  └─────────────┘      └──────────────────┘       │
  │                                                  │
  │  Batch Simulator                                 │
  │  ┌──────────────────────────────────────────┐    │
  │  │ 100 games x async concurrency (default 4)│    │
  │  │ (cooperative scheduling, not parallel)    │    │
  │  └──────────────────────────────────────────┘    │
  │                                                  │
  └──────────────────────────────────────────────────┘
```

- `@pkmn/sim` uses `BattleStream` (async iterable). Non-blocking at the I/O level.
- MCTS search is CPU-bound. 10,000 iterations with a 5-second timeout blocks the event loop.
- Batch simulation uses `Promise.all` with concurrency limiting. Battles run cooperatively (not in parallel), so throughput is limited by single-core speed.
- For the current use case (local dev, single user), this is fine.

### Milestone 3: Web Workers for MCTS

Move the MCTS computation into a dedicated Web Worker:

```
  Main Thread                    Worker Thread
  ┌──────────────────┐          ┌──────────────────────┐
  │                  │          │                      │
  │  BattleManager   │  post    │  MCTS Search         │
  │  ┌────────────┐  │ Message  │  ┌────────────────┐  │
  │  │ serialize  ├──┼─────────>│  │ iterate()      │  │
  │  │ battle     │  │          │  │ UCB1 select     │  │
  │  └────────────┘  │          │  │ rollout         │  │
  │                  │  progress│  │ backpropagate   │  │
  │  UI responsive   │<─────────┤  │                 │  │
  │  during search   │          │  └────────┬───────┘  │
  │                  │  result  │           │          │
  │  ┌────────────┐  │<─────────┤  MCTSResult         │
  │  │ apply best │  │          │                      │
  │  │ action     │  │          └──────────────────────┘
  │  └────────────┘  │
  │                  │
  └──────────────────┘
```

The worker message protocol already exists in the codebase (`packages/battle-engine/src/ai/mcts-types.ts`):

```typescript
interface MCTSWorkerRequest {
  type: "search";
  battleJson: unknown;        // serialized via Battle.toJSON()
  perspective: "p1" | "p2";
  config: MCTSConfig;
  formatId: string;
}

interface MCTSWorkerProgress {
  type: "progress";
  iterations: number;
  bestAction: string;
  winProbability: number;
}

interface MCTSWorkerResult {
  type: "result";
  result: MCTSResult;
}
```

**Challenge:** `@pkmn/sim` uses some Node.js APIs internally (`BattleStream` extends Node streams). The MCTS worker doesn't use `BattleStream` -- it operates on `Battle` objects directly (cloned via `battle-cloner.ts`). But `Battle` still imports modules that reference Node globals. The worker will need to either:
- Bundle `@pkmn/sim` with polyfills for `stream`, `events`, etc.
- Use a shim that stubs out unused stream code.

**Fallback:** If Web Workers are unavailable (SSR, testing), use `requestIdleCallback` chunking on the main thread with a reduced iteration budget.

### Milestone 3+: Worker Pool for Batch Simulation

```
  Main Thread                    Worker Pool (N = hardwareConcurrency)
  ┌──────────────────┐          ┌─────────────────────────────────┐
  │                  │          │  Worker 1: Battle #1, #5, #9... │
  │  BatchScheduler  ├─────────>│  Worker 2: Battle #2, #6, #10..│
  │  ┌────────────┐  │          │  Worker 3: Battle #3, #7, #11..│
  │  │ distribute │  │          │  Worker 4: Battle #4, #8, #12..│
  │  │ battles    │  │          └──────────────┬──────────────────┘
  │  └────────────┘  │                         │
  │                  │  results                │
  │  ┌────────────┐  │<────────────────────────┘
  │  │ aggregate  │  │
  │  │ analytics  │  │
  │  └────────────┘  │
  └──────────────────┘
```

- Pool size: `navigator.hardwareConcurrency` (typically 4-8 on modern machines).
- Each worker runs one battle at a time. When it finishes, the scheduler assigns the next.
- Main thread aggregates results and updates progress.
- Same `@pkmn/sim` polyfill challenge applies to every worker.

---

## 5. API Route Evolution

### Current Routes (35 route files)

```
Teams (12 routes)
  GET    /api/teams                           list teams
  POST   /api/teams                           create team
  GET    /api/teams/[teamId]                  get team
  PUT    /api/teams/[teamId]                  update team
  DELETE /api/teams/[teamId]                  delete team
  GET    /api/teams/[teamId]/analysis         full team analysis
  GET    /api/teams/[teamId]/export           Showdown paste export
  POST   /api/teams/[teamId]/import           Showdown paste import
  POST   /api/teams/[teamId]/slots            add slot
  PUT    /api/teams/[teamId]/slots/[position] update slot
  DELETE /api/teams/[teamId]/slots/[position] remove slot

Pokemon (5 routes)
  GET    /api/pokemon                         search/list
  GET    /api/pokemon/[id]                    species details
  GET    /api/pokemon/[id]/learnset           full learnset
  GET    /api/pokemon/[id]/sets               Smogon sets
  GET    /api/pokemon/[id]/mega-form          mega evolution data

Formats & Usage (3 routes)
  GET    /api/formats                         all formats
  GET    /api/formats/[id]/pokemon            legal Pokemon for format
  GET    /api/formats/[id]/usage              usage statistics

Battles (6 routes)
  GET    /api/battles                         list battles
  POST   /api/battles                         create battle
  GET    /api/battles/[battleId]              get battle
  DELETE /api/battles/[battleId]              delete battle
  GET    /api/battles/[battleId]/replay       replay data
  POST   /api/battles/batch                   start batch simulation
  GET    /api/battles/batch/[batchId]         batch status/results
  DELETE /api/battles/batch/[batchId]         cancel batch
  POST   /api/battles/commentary              AI commentary

Sample Teams (4 routes)
  GET    /api/sample-teams                    list sample teams
  POST   /api/sample-teams                    create sample team
  GET    /api/sample-teams/[id]               get sample team
  DELETE /api/sample-teams/[id]               delete sample team
  POST   /api/sample-teams/import             import sample team

Chat (5 routes)
  POST   /api/chat                            streaming chat
  GET    /api/chat/sessions                   list sessions
  POST   /api/chat/sessions                   create session
  GET    /api/chat/sessions/[id]              get session
  PUT    /api/chat/sessions/[id]              update session
  DELETE /api/chat/sessions/[id]              delete session

Other (5 routes)
  GET    /api/items                           list items
  POST   /api/recommend                       Pokemon recommendations
  POST   /api/data/seed                       trigger seeding
  GET    /api/data/status                     data freshness
  POST   /api/damage-calc                     single calculation
  POST   /api/damage-calc/matchup-matrix      team vs team matrix
```

### Milestone 2 Additions

```
Teams (versioning)
  POST   /api/teams/[teamId]/fork             fork a team
  GET    /api/teams/compare?a=X&b=Y           compare two teams
  POST   /api/teams/merge                     merge teams
  GET    /api/teams/[teamId]/lineage           lineage tree

Meta
  GET    /api/meta/profiles                   list meta profiles
  POST   /api/meta/profiles                   create meta profile
  GET    /api/meta/profiles/[id]              get meta profile
  POST   /api/meta/profiles/[id]/simulate     simulate team against meta
```

### Milestone 3 Additions

```
Training
  GET    /api/training/puzzles                list puzzles
  POST   /api/training/puzzles/[id]/submit    submit puzzle answer
  GET    /api/training/paths                  learning paths
  GET    /api/battles/[id]/review             post-game review data
```

### Milestone 4 Additions

```
Coaching
  POST   /api/chat/commentary                battle commentary
  GET    /api/meta/briefings                  meta briefing reports
  POST   /api/chat/coaching                   coaching session
```

### Route Conventions

All routes follow the same pattern: import service functions from packages, handle HTTP concerns only.

```typescript
// apps/web/src/app/api/teams/[teamId]/route.ts
import { getTeam, updateTeam, deleteTeam } from "@nasty-plot/teams";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;
  const team = await getTeam(teamId);
  if (!team) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(team);
}
```

No business logic in route handlers. Routes are thin wrappers.

---

## 6. MCP Server Growth

### Current: 24 Tools, 4 Modules

The MCP server (`packages/mcp-server/`) runs as a separate Express process on port 3001. It exposes tools to Claude via the Model Context Protocol.

```
mcp-server/src/tools/
  data-query.ts   (7 tools)  get_pokemon, search_pokemon, get_moves_by_criteria,
                              get_abilities, compare_pokemon, get_type_matchups,
                              get_smogon_sets

  analysis.ts     (6 tools)  analyze_team_coverage, find_team_weaknesses,
                              get_speed_tiers, calculate_damage, suggest_counters,
                              get_common_cores

  team-crud.ts    (6 tools)  create_team, get_team, list_teams,
                              add_pokemon_to_team, update_pokemon_set,
                              remove_pokemon_from_team

  meta-recs.ts    (5 tools)  get_meta_trends, get_format_viability,
                              get_usage_stats, suggest_teammates, suggest_sets
```

Each module exports a `register*Tools(server)` function. Tools call the Next.js API via an HTTP client (`api-client.ts`), keeping the MCP server decoupled from internal services.

### Growth Plan

| Milestone | New Module | New Tools | Running Total |
|-----------|-----------|-----------|---------------|
| M2 | `version.ts` | `fork_team`, `compare_teams`, `merge_teams`, `get_lineage`, `get_meta_profile`, `simulate_against_meta` | ~30 |
| M3 | `battle.ts` | `run_battle`, `get_battle_replay`, `get_battle_analysis`, `get_puzzle`, `submit_puzzle_answer`, `get_training_path` | ~36 |
| M4 | `coaching.ts` | `start_coaching_session`, `get_meta_briefing`, `explain_turn`, `get_learning_progress` | ~40 |

### Module Organization Rule

A tool module should contain 5-8 tools around a single theme. If a module exceeds 10 tools, split it. The split should follow the same naming convention as package splits: find the two concerns and name them.

---

## 7. Database Evolution

### Current Schema: 14 Models

```
Foundation      Format, DataSyncLog
Usage Data      UsageStats, SmogonSet, TeammateCorr, CheckCounter
Teams           Team, TeamSlot
Chat            ChatSession, ChatMessage
Battles         Battle, BattleTurn, BatchSimulation, SampleTeam
```

### Milestone 2 Additions

**Schema changes to existing models:**

```prisma
model Team {
  // existing fields...
  parentId    String?      // FK to parent team (for forks)
  branchName  String?      // e.g. "rain-variant", "anti-stall"
  isArchived  Boolean      @default(false)

  parent   Team?  @relation("TeamForks", fields: [parentId], references: [id])
  children Team[] @relation("TeamForks")
}
```

**New model:**

```prisma
model MetaProfile {
  id         String   @id @default(uuid())
  name       String
  formatId   String
  pokemonList String  // JSON: [{ pokemonId, usagePercent, commonSets }]
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([formatId])
}
```

### Milestone 3 Additions

```prisma
model Puzzle {
  id             String   @id @default(uuid())
  name           String
  category       String   // "type-matchup" | "switch-timing" | "hazard-control" | ...
  difficulty     Int      // 1-5
  positionState  String   // JSON: serialized BattleState
  bestAction     String   // JSON: BattleAction
  explanation    String
  createdAt      DateTime @default(now())

  attempts PuzzleAttempt[]
  @@index([category, difficulty])
}

model PuzzleAttempt {
  id        Int      @id @default(autoincrement())
  puzzleId  String
  action    String   // JSON: BattleAction submitted
  isCorrect Boolean
  createdAt DateTime @default(now())

  puzzle Puzzle @relation(fields: [puzzleId], references: [id], onDelete: Cascade)
  @@index([puzzleId])
}

model LearningPath {
  id    String @id @default(uuid())
  name  String
  steps String // JSON: [{ conceptId, puzzleIds, description }]
}
```

### Milestone 4 Additions

```prisma
model CoachingSession {
  id            String   @id @default(uuid())
  chatSessionId String
  pathId        String?
  progress      String   // JSON: { currentStep, completedPuzzles, scores }
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model MetaBriefing {
  id          String   @id @default(uuid())
  formatId    String
  content     String   // JSON: { topThreats, risingPokemon, teamArchetypes, ... }
  generatedAt DateTime @default(now())

  @@index([formatId])
}
```

### Milestone 5 Additions (Multi-User)

```prisma
model User {
  id          String   @id @default(uuid())
  displayName String
  createdAt   DateTime @default(now())

  teams          Team[]
  preferences    UserPreference[]
  sharedTeams    SharedTeam[]
  matches        Match[]
}

model SharedTeam {
  id        String   @id @default(uuid())
  teamId    String
  userId    String
  isPublic  Boolean  @default(false)
  shareCode String?  @unique
  createdAt DateTime @default(now())

  team Team @relation(fields: [teamId], references: [id])
  user User @relation(fields: [userId], references: [id])
}
```

### Migration Discipline

- One migration per logical change. Don't batch unrelated schema changes.
- Migrations are additive where possible: new columns with defaults, new tables. Avoid dropping columns in production.
- After `prisma migrate dev`, always restart the dev server (Turbopack caches the stale Prisma client).
- Test migrations locally before committing: `pnpm exec prisma migrate dev --name <description>`.

---

## 8. Testing Architecture

### Current State

| Tool | Purpose |
|------|---------|
| Vitest | Test runner with `globals: true` |
| `jsdom` | Browser environment for component tests |
| `@testing-library/react` | Component interaction testing |
| `@vitest/coverage-v8` | V8-based code coverage |

43 test files live in the top-level `tests/` directory, organized into 11 subdirectories mirroring package structure (e.g. `tests/core/`, `tests/battle-engine/`, `tests/llm/`). A single root `vitest.config.ts` covers all packages.

### Testing by Package Type

**Foundation packages (`core`, `db`):**
Pure type definitions and a Prisma singleton. Minimal testing needed -- types are validated at compile time, Prisma client is tested implicitly by every package that uses it.

**Data packages (`pokemon-data`, `smogon-data`, `formats`):**
Unit tests for service functions. Mock `@pkmn/dex` data where needed. Formats package tests legality checking against known legal/illegal sets.

**Domain packages (`teams`, `analysis`, `damage-calc`, `battle-engine`, `recommendations`):**
The most heavily tested layer. Each service function gets unit tests with edge cases. `battle-engine` AI tests validate action selection against known positions.

```typescript
// tests/battle-engine/ai.test.ts (pattern)
describe("HeuristicAI", () => {
  it("prefers super-effective moves", async () => {
    const ai = new HeuristicAI();
    const state = createMockBattleState(/* water vs fire */);
    const actions = createMockActions(["Thunderbolt", "Tackle"]);
    const choice = await ai.chooseAction(state, actions);
    expect(choice).toEqual({ type: "move", moveIndex: 1 }); // Thunderbolt
  });
});
```

**Feature packages (`llm`, `mcp-server`):**
LLM tests mock the OpenAI client and verify context building, tool call routing, and session management. MCP server tests (when added) should test tool registration and API client calls.

**Presentation (`web`):**
Component tests with `@testing-library/react`. Test user interactions, not implementation details.

### Evolution

| Milestone | Testing Addition |
|-----------|-----------------|
| M1 | Target 80% unit test coverage across domain packages |
| M2 | Integration tests for multi-package workflows (fork -> compare -> merge) |
| M3 | E2E tests with Playwright for critical flows (battle start-to-finish, team build-to-export) |
| M4 | LLM response testing with mocked OpenAI (verify context building produces correct prompts) |
| M5 | Load testing for multiplayer scenarios |

### Integration Test Pattern

Integration tests live in the consuming package and test the contract between packages:

```typescript
// tests/version/integration.test.ts
import { createTeam, addSlotToTeam } from "@nasty-plot/teams";
import { forkTeam, compareTeams, mergeTeams } from "../version.service";

describe("team versioning workflow", () => {
  it("fork -> modify -> compare -> merge", async () => {
    const original = await createTeam({ name: "Rain", formatId: "gen9ou" });
    await addSlotToTeam(original.id, { pokemonId: "pelipper", ... });

    const fork = await forkTeam(original.id, "anti-stall");
    // ... modify fork ...

    const diff = await compareTeams(original.id, fork.id);
    expect(diff.changes).toHaveLength(1);

    const merged = await mergeTeams(original.id, fork.id, [
      { position: 1, field: "item", choice: "target", value: "Heavy-Duty Boots" },
    ]);
    expect(merged.slots[0].item).toBe("Heavy-Duty Boots");
  });
});
```

---

## 9. Architectural Invariants

Seven rules that must never be violated. If a change would break any of these, the change is wrong.

### 1. Foundation Has No Upward Dependencies

`core` and `db` never import from higher layers. `core` has zero dependencies (not even `db`). `db` has only Prisma.

**Test:** `grep -r "from \"@nasty-plot/" packages/core/src/` and `packages/db/src/` should return nothing (or only `core` for `db`).

### 2. Types Live in `core`

All shared domain types -- `TeamSlotData`, `PokemonSpecies`, `FormatDefinition`, `StatsTable`, `ChatMessage`, etc. -- are defined in `packages/core/src/types.ts`. Package-specific types (like `BattleState`, `MCTSConfig`) live in their own package's `types.ts` but reference core types.

**Why:** Prevents circular dependencies. If `teams` defines `TeamSlotData` and `analysis` needs it, `analysis` would depend on `teams`. With types in `core`, both depend downward.

### 3. MCP Is the Canonical Tool Interface

Any capability exposed to the LLM goes through MCP tools registered in `packages/mcp-server/`. No direct prompt injection of API URLs or ad-hoc function calling. Claude interacts with the system exclusively through the MCP protocol.

**Consequence:** Adding a new LLM-accessible feature means adding an MCP tool, an API route, and a service function. All three.

### 4. Services Are Pure Functions

Business logic is exposed as exported functions, not class instances:

```typescript
// YES
export function analyzeTeamCoverage(slots: TeamSlotData[]): TypeCoverage { ... }

// NO
export class AnalysisService {
  analyzeTeamCoverage(slots: TeamSlotData[]): TypeCoverage { ... }
}
```

**Exception:** AI players in `battle-engine` use classes because they carry state across turns (accumulated observations, MCTS tree). The 4 AI tiers -- `RandomAI`, `GreedyAI`, `HeuristicAI`, `MCTSAI` (Expert) -- all implement the `AIPlayer` interface.

### 5. Packages Are Independently Testable

Every package can run `vitest run` in isolation. Tests must not depend on external services (database seeding, running dev server, network access). Use mocks for database access and HTTP calls.

**Verification:** `pnpm test` from the repo root should pass without any other process running.

### 6. ESM Everywhere

All packages use `"type": "module"`. No CommonJS `require()`, no `module.exports`. Import paths use ESM syntax.

```typescript
// YES
import { getSpecies } from "@nasty-plot/pokemon-data";

// NO
const { getSpecies } = require("@nasty-plot/pokemon-data");
```

### 7. Data Flows Down, Never Up

Dependency direction is strictly layered:

```
Presentation  -->  Feature  -->  Domain  -->  Data  -->  Foundation
```

A Domain package never imports from Feature or Presentation. A Data package never imports from Domain.

**Detection:** If you need a Domain package to call something in Feature, the dependency is inverted. Extract the shared logic into a Domain (or Data) package, or use dependency injection.

**Example of a violation:** If `battle-engine` needed to call `llm` for commentary during a battle, that would be an upward dependency (Domain -> Feature). Instead, the commentary feature lives in `llm` and calls down into `battle-engine` to get the battle state it needs to comment on.

---

## Summary

The architecture is designed around isolation and directional data flow. Packages are small, independently testable, and follow consistent conventions. Growth happens by adding new packages at appropriate layers, not by expanding existing ones beyond their scope. Splitting triggers are quantitative (file count) and qualitative (multiple concerns). Performance improvements (Web Workers) are planned but deferred until the single-thread model becomes a bottleneck. The seven invariants are the guardrails: if a proposed change violates one, find another approach.
