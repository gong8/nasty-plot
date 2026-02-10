# The Feedback Loop

How Nasty Plot turns team building from a one-shot guess into an iterative process.
The core product workflow is a cycle: build a team, test it, analyze the results, tweak
what isn't working, and repeat until the team is sharp.

---

## 1. The Loop

```
                          THE FEEDBACK LOOP

       BUILD ────────> TEST ────────> ANALYZE
         ^                               |
         |                               v
         |                             TWEAK
         |                            /     \
         |                           /       \
         +---- targeted fix --------+         +---- wholesale swap
         |                                    |
         +---- fork (new variant) -----------+

```

Every team starts rough. The loop is how it becomes competitive.

- **BUILD** -- assemble the team: guided or freeform, with analysis and LLM advice running in real time.
- **TEST** -- play it against AI opponents or batch-simulate hundreds of games.
- **ANALYZE** -- study the results at three levels: aggregate stats, turn-by-turn replay, and static team properties.
- **TWEAK** -- make targeted adjustments (EV spread, move swap, item change) or wholesale replacements (swap out an underperformer).

The fork point after TWEAK is where version management enters: create a variant of the team,
test both, compare results, keep the better one.

---

## 2. Stage 1: BUILD

The build stage produces a `TeamData` object containing up to 6 `TeamSlotData` entries --
the canonical representation of a team throughout the system.

**Source:** `packages/core/src/types.ts` -- `TeamSlotData` (lines 101-115), `TeamData` (lines 117-127)

### Two Builder Modes

**Guided Builder** (`/teams/[teamId]/guided`)

- Step-by-step slot filling with recommendations at each stage.
- `getRecommendations(teamId)` from `packages/recommendations/src/composite-recommender.ts` runs
  after each slot addition, combining usage-based and coverage-based signals.
- Validation warnings surface in real time via `validateTeam()` from `packages/teams/src/validation.service.ts`.
- The system suggests what to add next based on what the team is missing.

**Freeform Builder** (`/teams/[teamId]`)

- Showdown paste import via `importShowdownPaste()` from `packages/teams/src/import-export.service.ts`.
- Manual Pokemon search, move selection, EV/IV editing.
- Full control, no hand-holding.

Both modes write through the same service layer:

- `createTeam()`, `addSlot()`, `updateSlot()`, `removeSlot()` from `packages/teams/src/team.service.ts`
- Both produce identical `TeamSlotData` -- the difference is the UX journey, not the data.

### Real-Time Analysis During Build

As Pokemon are added, the analysis package evaluates the team in progress:

| Analysis                              | Function                           | File                                        |
| ------------------------------------- | ---------------------------------- | ------------------------------------------- |
| Type coverage (offensive + defensive) | `analyzeTypeCoverage(slots)`       | `packages/analysis/src/coverage.service.ts` |
| Threat identification vs meta         | `identifyThreats(slots, formatId)` | `packages/analysis/src/threat.service.ts`   |
| Synergy scoring (0-100)               | `calculateSynergy(slots)`          | `packages/analysis/src/synergy.service.ts`  |
| Full orchestrated analysis            | `analyzeTeam(teamId)`              | `packages/analysis/src/analysis.service.ts` |

**Coverage analysis** counts how many team members can hit each type super-effectively (offensive)
and how many resist each attacking type (defensive). It flags uncovered types and shared weaknesses
-- types where 2+ team members are vulnerable.

**Threat identification** queries the top 50 Pokemon by usage in the format from the database,
checks STAB type effectiveness against the team, and assigns threat levels (high/medium/low)
based on a weighted score of type coverage exploitation and usage percentage.

**Synergy scoring** is a 0-100 composite of four components:

- Defensive complementarity (35 pts max) -- do teammates cover each other's weaknesses?
- Offensive breadth (25 pts) -- how many of the 18 types can the team hit SE?
- Speed diversity (20 pts) -- a mix of fast and slow Pokemon, not all clumped.
- Physical/Special balance (20 pts) -- ratio of physical to special attackers.

### Recommendations

When a team has fewer than 6 Pokemon, the recommendation engine suggests what to add next.

`getRecommendations()` in `packages/recommendations/src/composite-recommender.ts` blends two signals:

1. **Usage-based** (`packages/recommendations/src/usage-recommender.ts`) -- teammate correlation
   data from Smogon. If your team has Garchomp, what do other Garchomp teams commonly pair with it?
   Weighted by correlation percentage from the `TeammateCorr` database table.

2. **Coverage-based** (`packages/recommendations/src/coverage-recommender.ts`) -- what types does
   the team currently struggle against, and which Pokemon fill those gaps?

Default blend: 60% usage, 40% coverage. Each recommendation includes a composite score (0-100)
and an array of `RecommendationReason` entries explaining why it was suggested.

### LLM Participation

The chat system (`packages/llm/`) integrates into the build stage via context injection:

- `buildTeamContext(teamData)` in `packages/llm/src/context-builder.ts` serializes the current
  team state -- species, types, abilities, items, natures, EVs, moves, base stats -- into a
  structured prompt section that gets prepended to every LLM message.

- `buildMetaContext(formatId, topPokemon)` adds the top Pokemon by usage so the LLM understands
  the competitive landscape.

- `buildPageContextPrompt(context)` injects page-specific context depending on where the user
  is in the app (team editor, Pokemon detail, damage calc, etc.).

Typical build-stage LLM interactions:

- "What should my 6th Pokemon be?"
- "Is running Scarf Garchomp worth it in this team?"
- "What EV spread should I use for defensive Corviknight?"

The LLM can also invoke MCP tools (24 tools across `packages/mcp-server/src/tools/`) to answer
with data: `get_pokemon`, `get_smogon_sets`, `suggest_teammates`, `analyze_team_coverage`,
`calculate_damage`, etc.

### Sample Teams

Pre-built sample teams (`packages/teams/src/sample-team.service.ts`) provide starting points:

- `listSampleTeams({ formatId, archetype, search })` filters by format and archetype (Rain, Sun, HO, Balance, etc.)
- `createSampleTeam()` / `importSampleTeamsFromPastes()` for bulk import from Showdown pastes.
- Users can load a sample team, then fork and customize it.

### Key Packages: BUILD

```
teams              Team CRUD, slot management, import/export, validation, sample teams
recommendations    Composite, usage-based, and coverage-based recommendations
analysis           Type coverage, threats, synergy scoring
llm                Chat service, context builder, MCP client
mcp-server         24 tools for LLM data access (data-query, analysis, team-crud, meta-recs)
core               TeamSlotData, PokemonSpecies, type chart, stat calculations
```

---

## 3. Stage 2: TEST

Testing means putting the team into battles and observing what happens. Two modes.

### Play Mode (Manual)

The user plays against an AI opponent in a live battle at `/battle/live`.

**Battle Manager** (`packages/battle-engine/src/battle-manager.ts`)

- `BattleManager` class orchestrates everything via `@pkmn/sim`'s `BattleStream`.
- Handles team preview, lead selection, turn-by-turn move/switch submission.
- Maintains a normalized `BattleState` (`packages/battle-engine/src/types.ts`, lines 95-116) that
  tracks both sides, field conditions, and a structured log.
- `getProtocolLog()` captures the raw `@pkmn/sim` protocol for replay.

**AI Opponents** -- four difficulty tiers:

| Tier      | Class         | Strategy                                                                  |
| --------- | ------------- | ------------------------------------------------------------------------- |
| Random    | `RandomAI`    | Legal random moves. Baseline noise.                                       |
| Greedy    | `GreedyAI`    | Picks the move that deals the most immediate damage. No switching.        |
| Heuristic | `HeuristicAI` | Type matchups, switching logic, status awareness, hazard play.            |
| Expert    | `MCTSAI`      | Monte Carlo Tree Search with DUCT (Decoupled UCT) for simultaneous moves. |

All implement the `AIPlayer` interface (`packages/battle-engine/src/types.ts`, lines 218-225):

```typescript
interface AIPlayer {
  readonly difficulty: AIDifficulty
  chooseAction(state: BattleState, actions: BattleActionSet): Promise<BattleAction>
  chooseLeads(teamSize: number, gameType: BattleFormat): number[]
}
```

**MCTS Expert AI** (`packages/battle-engine/src/ai/mcts-ai.ts`)

- Uses `Battle.fromJSON()` to clone the actual `@pkmn/sim` battle state.
- Runs UCB1 selection independently for each player (DUCT handles simultaneous moves).
- Random rollouts up to configurable depth, then static evaluation via `evaluatePosition()`.
- Falls back to `HeuristicAI` if no battle state is available for cloning.
- Default config: 10000 iterations, 5000ms time limit, exploration constant 0.7, rollout depth 4.

**Battle Flow:**

1. `BattleManager.start()` -- writes format, player teams to `BattleStream`.
2. Team Preview phase -- user picks lead order, AI picks via `chooseLeads()`.
3. Battle phase -- each turn: user submits action, AI responds, `processOutput()` updates state.
4. `BattleManager.onUpdate(handler)` fires on every state change for the UI.
5. Game ends on `|win|` protocol line. Protocol log is stored for replay.

### Simulate Mode (Batch AI-vs-AI)

At `/battle/simulate`, run N games automatically between two teams.

**Automated Battle Manager** (`packages/battle-engine/src/simulation/automated-battle-manager.ts`)

- `runAutomatedBattle(config)` runs a single game with two AI players, no delays, no UI callbacks.
- Returns `SingleBattleResult`: winner, turn count, protocol log, final state snapshot, per-turn actions.

**Batch Simulator** (`packages/battle-engine/src/simulation/batch-simulator.ts`)

- `runBatchSimulation(config, onProgress)` runs `totalGames` games with a configurable concurrency limit (default: 4).
- Each game gets fresh AI instances via `createAI(difficulty)`.
- Progress callback fires after each game with `BatchSimProgress`: completed/total, wins for each side, draws.

**`BatchSimConfig`:**

```typescript
interface BatchSimConfig {
  formatId: string
  gameType: BattleFormat // "singles" | "doubles"
  team1Paste: string // Showdown paste format
  team2Paste: string
  team1Name?: string
  team2Name?: string
  aiDifficulty: AIDifficulty // Both sides use the same AI tier
  totalGames: number
  concurrency?: number // Default: 4
}
```

**`BatchAnalytics`** output:

- `team1WinRate`, `team2WinRate`, `drawRate` -- percentages.
- `avgTurnCount`, `minTurnCount`, `maxTurnCount` -- game length distribution.
- `pokemonStats: PokemonStats[]` -- per-Pokemon KO counts, faint counts, appearances.
- `turnDistribution: Record<number, number>` -- bucketed by 5 turns for charting.

### Target Meta Integration (Planned)

Not yet implemented, but the intended extension:

- Define a "target meta" -- either from usage data or a custom list of threats.
- Auto-generate representative opponent teams from the meta.
- Simulate your team against the meta, not just a single opponent.
- Win rate becomes "win rate against the field."

### Key Packages: TEST

```
battle-engine      BattleManager, AI players, automated battle, batch simulator
                   Submodules: ai/, simulation/, replay/
```

---

## 4. Stage 3: ANALYZE

Analysis operates at three levels. Each answers different questions.

### 4a. Aggregate Analysis (from Batch Simulation)

After running a batch simulation, `BatchAnalytics` gives the big picture:

- **Win rate** -- the headline number. 50% is break-even, 55%+ is good, 60%+ is strong.
  A team winning less than 45% has structural problems.
- **Per-Pokemon stats** (`PokemonStats`) -- which Pokemon accumulate KOs vs which faint often.
  A Pokemon that faints frequently without contributing KOs is dead weight.
- **Turn count distribution** -- short games (< 15 turns) suggest sweeps or blowouts.
  Long games (> 50 turns) suggest stall matchups or lack of offensive pressure.
- **Draw rate** -- high draw rates (> 10%) indicate timeout issues or infinite loops
  (e.g., both sides PP stalling).

### 4b. Detailed Analysis (from Individual Battles)

For individual battles, the replay and evaluation engines provide turn-level insight.

**Replay Engine** (`packages/battle-engine/src/replay/replay-engine.ts`)

- `ReplayEngine` takes a raw `@pkmn/sim` protocol log and reconstructs `ReplayFrame`s.
- Each frame captures: turn number, deep-cloned `BattleState`, log entries for that turn,
  and win probability for team 1.
- Navigation: `getFrame(index)`, `getFrameByTurn(turn)`, `nextFrame()`, `prevFrame()`.
- `getAllFrames()` returns the full sequence for graphing.

```typescript
interface ReplayFrame {
  turnNumber: number
  state: BattleState // Deep clone at this turn boundary
  entries: BattleLogEntry[] // Events during this turn
  winProbTeam1: number | null // Win probability for p1, 0-100
}
```

**Position Evaluator** (`packages/battle-engine/src/ai/evaluator.ts`)

- `evaluatePosition(state, perspective)` returns a score in [-1, +1].
- Seven weighted features:
  1. HP remaining differential (weight: 1024)
  2. Pokemon alive differential (512)
  3. Fast Pokemon alive (512)
  4. Hazards differential (Stealth Rock: 200, Spikes/layer: 150, T-Spikes/layer: 100, Web: 120)
  5. Screens/Tailwind differential (Reflect: 64, Light Screen: 64, Aurora Veil: 80, Tailwind: 50)
  6. Status conditions differential (Burn: 120, Paralysis: 100, Sleep: 110, Toxic: 120)
  7. Active matchup (SE coverage: 200, STAB advantage: 100, speed: 50, boosts: 30/stage, Substitute: 150)
- Normalized via `tanh(rawScore / 1400)` to keep the score in [-1, +1].
- Returns `EvalResult` with score, raw score, and feature breakdown for UI display.

**Win Probability** (`packages/battle-engine/src/ai/win-probability.ts`)

- `estimateWinProbability(state)` maps the evaluator's [-1, +1] score through an S-curve:
  `50 + 50 * sign(s) * |s|^0.85` to produce a [0, 100] win percentage.
- `winProbabilityDelta(before, after)` calculates the swing between two states and flags
  turns with > 20% swing as "critical."

**Hint Engine** (`packages/battle-engine/src/ai/hint-engine.ts`)

- `generateHints(state, actions, perspective)` scores all legal actions at the current position.
- Damaging moves scored via `@smogon/calc` -- actual damage percentages, KO chances, priority bonuses.
- Status moves scored by heuristic: hazards (30-40 pts), status infliction (25-45 pts),
  setup moves (10-35 pts depending on HP), recovery (2-40 pts depending on current HP).
- Switch options scored by defensive matchup (resist opponent STAB), offensive coverage,
  health, and hazard entry cost.
- Each action classified relative to the best option:

| Gap from Best | Classification |
| ------------- | -------------- |
| 0             | best           |
| 1-5           | good           |
| 6-15          | neutral        |
| 16-30         | inaccuracy     |
| 31-60         | mistake        |
| 61+           | blunder        |

This classification is inspired by chess engine annotations (Stockfish-style).

**LLM Commentary** (`packages/llm/src/battle-context-builder.ts`)

- `buildTurnCommentaryContext(state, entries, team1Name, team2Name)` generates a prompt
  for turn-by-turn AI commentary: battle state summary, this turn's events, request for
  2-3 sentence analysis.
- `buildPostBattleContext(allEntries, team1Name, team2Name, winner, totalTurns)` generates
  a post-game summary prompt: key moments (faints, crits, SE hits, terastallizations),
  asking for 3-4 sentence analysis of turning points.
- `buildTurnAnalysisContext(state, turnEntries, prevTurnEntries)` for deep single-turn analysis.

### 4c. Static Analysis (from Team Data Alone)

No battles needed -- pure team composition analysis:

| Dimension             | What It Answers                                 | Function                                                 |
| --------------------- | ----------------------------------------------- | -------------------------------------------------------- |
| Offensive coverage    | Which types can we hit SE? Which are uncovered? | `analyzeTypeCoverage(slots)`                             |
| Defensive coverage    | Which types do we resist? Where are the holes?  | `analyzeTypeCoverage(slots)`                             |
| Shared weaknesses     | Are 2+ Pokemon weak to the same type?           | `analyzeTypeCoverage(slots)`                             |
| Threat identification | Which meta Pokemon exploit our weaknesses?      | `identifyThreats(slots, formatId)`                       |
| Speed tiers           | What outspeeds what?                            | `calculateSpeedTiers(slots)` in `analysis.service.ts`    |
| Synergy score         | How well do the Pokemon complement each other?  | `calculateSynergy(slots)`                                |
| Damage matchups       | Exact damage calcs against specific threats     | `calculateMatchupMatrix(teamSlots, threatIds, formatId)` |
| Suggestions           | Plain-English advice from analysis results      | `generateSuggestions()` in `analysis.service.ts`         |

The `analyzeTeam(teamId)` orchestrator in `packages/analysis/src/analysis.service.ts` runs all
of these and returns a unified `TeamAnalysis` object.

### Key Packages: ANALYZE

```
battle-engine      evaluator, win-probability, hint-engine, replay-engine
analysis           coverage, threats, synergy, orchestrated analysis
damage-calc        @smogon/calc wrapper, single calcs, matchup matrices
llm                battle-context-builder for AI commentary
```

---

## 5. Stage 4: TWEAK

Analysis reveals problems. Tweak fixes them. Two approaches.

### Targeted Adjustments

Small, precise changes to address specific weaknesses identified in analysis:

- **Move swap** -- replace a move that isn't pulling its weight. If Garchomp's Fire Fang
  rarely connects meaningfully, try Stone Edge for Flying coverage.
- **EV spread change** -- shift EVs to hit a specific speed tier or survive a particular
  attack. All done via `updateSlot()` from `packages/teams/src/team.service.ts`.
- **Item change** -- switch from Choice Band to Life Orb for flexibility, or add
  Heavy-Duty Boots to avoid hazard damage.
- **Nature change** -- Jolly over Adamant to outspeed a specific threat.
- **Tera type** -- change Tera type to shore up a defensive weakness or add unexpected
  offensive coverage.

The damage calculator (`packages/damage-calc/src/calc.service.ts`) validates these changes:

- `calculateDamage(input)` for specific attacker/defender/move combinations.
- `calculateMatchupMatrix(teamSlots, threatIds, formatId)` to see how the change ripples
  across the threat landscape.

### Wholesale Replacement

When a Pokemon is the problem, not its set:

- Identify the underperformer from batch sim `PokemonStats` (high faint count, low KO count).
- Use `getRecommendations(teamId)` to find replacements that fill the same role or cover
  the gap the removed Pokemon leaves.
- Swap via `removeSlot()` + `addSlot()`.

### Version Management (Planned)

The intended system for tracking team evolution:

**Fork:** Before making changes, create a variant of the team. The original stays untouched.
Think git branches for teams.

**Compare:** Run both variants through the same batch simulation (same opponent, same AI tier,
same number of games). Side-by-side win rates, per-Pokemon stats, and detailed diffs.

**"Simulate Both":** A single action that batch-simulates the original and the variant
against the same conditions, then presents a comparison dashboard.

**Merge:** When the variant outperforms the original, promote it to the main version.
The original becomes part of the lineage history.

**Lineage Tree:** A visual history of how the team evolved -- which Pokemon were swapped,
which EV spreads were tried, which variant won out at each fork point.

This is the missing piece that closes the loop cleanly. Without it, users overwrite
their previous team and lose the ability to compare or roll back.

### Key Packages: TWEAK

```
teams              addSlot, updateSlot, removeSlot for modifications
recommendations    Replacement suggestions when swapping a Pokemon
damage-calc        Validate changes with specific calcs
analysis           Re-run analysis after changes to confirm improvement
```

---

## 6. Full Walkthrough: Rain Team Through 2 Iterations

A concrete example of the loop in action.

### Iteration 1: Initial Build

**Goal:** Build a Rain team for Gen 9 OU.

**BUILD stage:**

Start with the rain core:

1. **Pelipper** -- Drizzle ability sets rain. Utility support (U-turn, Defog, Roost).
2. **Barraskewda** -- Swift Swim sweeper. Liquidation, Flip Turn, Close Combat, Aqua Jet.

At this point, `analyzeTypeCoverage()` flags:

- Uncovered types: Ground, Dragon (no SE coverage against them)
- Shared weakness: Electric (both are weak)

`getRecommendations(teamId)` suggests teammates. We pick: 3. **Ferrothorn** -- resists Electric, sets Stealth Rock, Leech Seed staller. 4. **Zapdos** -- immune to Ground, checks Fighting types, Volt Switch momentum. 5. **Excadrill** -- Rapid Spin hazard removal, Steel-type coverage. 6. **Toxapex** -- Defensive anchor, Regenerator, Haze for setup sweepers.

`calculateSynergy(slots)` returns 62/100. Decent but not great -- Excadrill doesn't benefit
from rain and overlaps in role with Ferrothorn.

`identifyThreats(slots, "gen9ou")` flags:

- **Rillaboom** (high) -- Grass STAB hits Pelipper, Barraskewda, Toxapex SE. Grassy Surge
  weakens rain-boosted Water moves.
- **Amoonguss** (medium) -- Grass/Poison resists Water, Spore shuts down sweepers.

**TEST stage:**

Run 100 games vs gen9ou meta AI at Heuristic difficulty:

```
runBatchSimulation({
  formatId: "gen9ou",
  gameType: "singles",
  team1Paste: rainTeamPaste,
  team2Paste: opponentPaste,
  aiDifficulty: "heuristic",
  totalGames: 100,
  concurrency: 4,
})
```

**Results:** `BatchAnalytics` shows:

- Win rate: 48% (below break-even)
- Excadrill: 89 games appeared, 54 faints, 12 KOs. Worst performer.
- Barraskewda: 89 games appeared, 31 faints, 47 KOs. Star performer.
- Average turn count: 28.

**ANALYZE stage:**

Replay critical losses with `ReplayEngine`. Pattern emerges:

- Grass-types (Rillaboom, Amoonguss) consistently wall the team.
- Excadrill doesn't synergize with rain (Sand Rush is useless in rain).
- Win probability graphs show sharp drops when Rillaboom enters.

`generateHints()` on replayed turns shows Excadrill's moves classified as "inaccuracy"
or "mistake" in most Grass-type matchups -- no SE coverage against them.

### Iteration 2: Refinement

**TWEAK stage:**

Problem identified: Excadrill doesn't belong on this team.

_Fork the team_ (planned -- currently done manually by creating a new team).

Changes:

1. **Replace Excadrill with Iron Bundle** -- Ice/Water typing. Benefits from rain (Water moves
   boosted). Ice coverage handles Grass-types (Rillaboom, Amoonguss). Freeze-Dry for Water/Ground types.
2. **Swap Toxapex's Scald for Ice Beam** -- extra Grass coverage from the defensive slot.

Re-run analysis:

- `analyzeTypeCoverage()` -- Grass is no longer an uncovered offensive type.
- `calculateSynergy(slots)` jumps to 71/100.
- `calculateDamage()` confirms: Iron Bundle Freeze-Dry OHKOs standard Rillaboom (252 SpA, Life Orb).

**TEST stage (again):**

Run another 100 games, same conditions.

**Results:**

- Win rate: 57% (up from 48%).
- Iron Bundle: 91 games appeared, 29 faints, 43 KOs. Massive improvement over Excadrill.
- Against Rillaboom specifically: Iron Bundle KOs Rillaboom 89% of the time.
- Average turn count: 24 (games resolving faster -- more offensive pressure).

**ANALYZE stage (again):**

Replay the wins. Win probability graphs show smoother climbs -- fewer volatile swings.
The Grass-type matchup is solved. New remaining threats are Electric-types (Zapdos-Galar,
Iron Hands) but at manageable levels.

**Decision:** The variant (Iron Bundle) outperforms the original (Excadrill). Promote the
variant to the main team. Continue iterating on the Electric matchup in the next cycle.

### Iteration Summary

```
Original (v1):  Pelipper / Barraskewda / Ferrothorn / Zapdos / Excadrill / Toxapex
                Win rate: 48%  |  Synergy: 62  |  Grass problem: unresolved

Variant  (v2):  Pelipper / Barraskewda / Ferrothorn / Zapdos / Iron Bundle / Toxapex
                Win rate: 57%  |  Synergy: 71  |  Grass problem: solved
```

Two iterations, measurable improvement. The loop works.

---

## 7. Data Flow Architecture

How data moves between packages during one full cycle of the loop.

### Build Phase Data Flow

```
                        +-----------+
    User Input -------->|   teams   |-------> TeamSlotData[]
    (UI / Paste)        +-----------+              |
                                          +--------+--------+
                                          |        |        |
                                          v        v        v
                                     analysis  damage-  recommenda-
                                               calc     tions
                                          |        |        |
                                          v        v        v
                                    TypeCoverage  Damage  Recommen-
                                    ThreatEntry[] CalcR.  dation[]
                                    SynergyScore
                                          |        |        |
                                          +--------+--------+
                                                   |
                                                   v
                                           llm (context-builder)
                                                   |
                                                   v
                                           buildTeamContext()
                                           buildMetaContext()
                                                   |
                                                   v
                                              LLM prompt
                                           + MCP tool calls
                                                   |
                                                   v
                                           User-facing advice
```

### Test Phase Data Flow

```
                  +-------------+
   TeamSlotData -->| team-packer |---> Packed team string
                  +-------------+         |
                                          v
                               +-----------------+
                               | BattleManager   |  (or AutomatedBattleManager)
                               | (@pkmn/sim      |
                               |  BattleStream)  |
                               +-----------------+
                                    |         |
                                    v         v
                              BattleState  Protocol Log
                                    |         |
                         +----------+         |
                         |                    v
                         v           +----------------+
                  AI Player          | Batch Simulator |
                  (chooseAction)     | (N games)       |
                         |           +----------------+
                         v                    |
                  BattleAction                v
                  (move/switch)        BatchAnalytics
                                       - win rates
                                       - per-pokemon stats
                                       - turn distribution
```

### Analyze Phase Data Flow

```
   Protocol Log ------> ReplayEngine.parse()
                              |
                              v
                        ReplayFrame[]
                         (per turn)
                              |
                    +---------+---------+
                    |         |         |
                    v         v         v
              BattleState  LogEntries  evaluatePosition()
              (snapshot)               estimateWinProbability()
                    |                        |
                    v                        v
              generateHints()          WinProbability
              (action ranking)         (0-100, S-curve)
                    |                        |
                    v                        v
              MoveHint[]               winProbabilityDelta()
              (classifications:         (critical turn
               best/good/neutral/       detection: >20%
               inaccuracy/mistake/      swing)
               blunder)
                    |                        |
                    +------------+-----------+
                                 |
                                 v
                    battle-context-builder
                    (LLM commentary prompts)
                                 |
                                 v
                    buildTurnCommentaryContext()
                    buildPostBattleContext()
                                 |
                                 v
                    AI-generated explanations
```

### Full Cycle

```
   +---------+    TeamSlotData    +---------+    BattleState     +-----------+
   |  BUILD  | -----------------> |  TEST   | -----------------> |  ANALYZE  |
   |         |                    |         |    Protocol Log     |           |
   | teams   |                    | battle- |    BatchAnalytics   | evaluator |
   | analysis|                    | engine  |                     | hints     |
   | recs    |                    |         |                     | replay    |
   | llm     |                    | ai/     |                     | win-prob  |
   +---------+                    | sim/    |                     | damage-c  |
       ^                          +---------+                     +-----------+
       |                                                               |
       |         +--------+                                            |
       +---------| TWEAK  |<------------------------------------------+
                 |        |    Analysis results inform changes
                 | teams  |    (updateSlot, removeSlot, addSlot)
                 | recs   |
                 | dmg-c  |
                 +--------+
```

---

## 8. Connecting the Loop to the UI

Each stage of the loop maps to specific pages and components:

| Stage            | Primary Page                | Key Components                                     |
| ---------------- | --------------------------- | -------------------------------------------------- |
| BUILD (guided)   | `/teams/[teamId]/guided`    | `PokemonSearchPanel`, `SlotEditor`, `ItemCombobox` |
| BUILD (freeform) | `/teams/[teamId]`           | `SlotEditor`, Showdown paste import                |
| TEST (play)      | `/battle/live`              | `BattleView`, `MoveSelector`, `TeamPreview`        |
| TEST (simulate)  | `/battle/simulate`          | Batch config form, progress bar                    |
| ANALYZE (replay) | `/battle/replay/[battleId]` | `ReplayControls`, `WinProbabilityGraph`, `EvalBar` |
| ANALYZE (hints)  | `/battle/live`              | `HintPanel`, `CommentaryPanel`                     |
| ANALYZE (static) | `/teams/[teamId]`           | Coverage matrix, threat list, synergy gauge        |
| TWEAK            | `/teams/[teamId]`           | `SlotEditor`, recommendations panel                |

The chat sidebar (`ChatSidebar`, `ChatPanel`) is available on every page, providing
LLM assistance at any point in the loop.

---

## 9. What Closes the Loop

The loop is only as good as the weakest link. Here's where each connection is today:

| Connection       | Status           | Mechanism                                        |
| ---------------- | ---------------- | ------------------------------------------------ |
| BUILD -> TEST    | Working          | Export team paste, configure battle, start sim   |
| TEST -> ANALYZE  | Working          | Protocol log -> ReplayEngine, BatchAnalytics     |
| ANALYZE -> TWEAK | Partially manual | User reads analysis, makes changes by hand       |
| TWEAK -> BUILD   | Working          | `updateSlot()` / `addSlot()` -- same team editor |
| Fork/Compare     | Planned          | Team versioning, side-by-side sim comparison     |
| LLM integration  | Working          | Chat available at all stages, context-aware      |

The planned team versioning system is the piece that makes TWEAK -> BUILD seamless:
fork before changing, compare variants quantitatively, merge the winner. Without it,
the user has to mentally track "what changed and did it help?" -- which works but
doesn't scale as the team evolves through many iterations.
