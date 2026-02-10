# Concept Map: Five Pillars of Competitive Pokemon in Nasty Plot

This document maps Aaron Traylor's five pillars of competitive Pokemon mastery to concrete features, packages, and files in the Nasty Plot codebase. Each pillar section is self-contained with a feature table, implementation notes, and status indicators.

**Status legend:**

| Status  | Meaning                               |
| ------- | ------------------------------------- |
| Exists  | Working in the codebase today         |
| Partial | Code exists but incomplete or limited |
| Planned | In roadmap or plan files              |
| Future  | Aspirational, not yet scoped          |

---

## Pillar 1: Long-term Planning

> Competitive Pokemon is not a series of isolated turns. Winning requires multi-turn strategies: hazard accumulation, sacrifice plays to preserve a sweeper, and tracking win conditions across the full arc of a game.

### Feature Map

| Concept                      | Feature                                                                         | Package / Key File                                                       | Status |
| ---------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------ | -------------------------------------------------- | ------ |
| Position evaluation          | Weighted evaluator scores HP, alive count, hazards, status, matchup, screens    | `packages/battle-engine/src/ai/evaluator.ts`                             | Exists |
| Hazard value weights         | SR: 200, Spikes: 150/layer, T-Spikes: 100/layer, Web: 120                       | `packages/battle-engine/src/ai/evaluator.ts` (lines 34-37)               | Exists |
| Screen & Tailwind value      | Reflect/Light Screen: 64, Aurora Veil: 80, Tailwind: 50                         | `packages/battle-engine/src/ai/evaluator.ts` (lines 38-41)               | Exists |
| Status condition value       | Burn/Toxic: 120, Paralysis: 100, Sleep: 110, Freeze: 110, Poison: 80            | `packages/battle-engine/src/ai/evaluator.ts` (lines 42-47)               | Exists |
| Win probability tracking     | Maps evaluator score to win % via S-curve: `50 + 50 _ sign(s) _                 | s                                                                        | ^0.85` | `packages/battle-engine/src/ai/win-probability.ts` | Exists |
| Critical turn detection      | Flags turns with >20% win probability swing                                     | `packages/battle-engine/src/ai/win-probability.ts:winProbabilityDelta()` | Exists |
| Win probability graph        | Visual win % over time in replay/live battle                                    | `apps/web/src/features/battle/components/WinProbabilityGraph.tsx`        | Exists |
| Eval bar (engine bar)        | Chess-style evaluation bar showing position advantage                           | `apps/web/src/features/battle/components/EvalBar.tsx`                    | Exists |
| Replay engine                | Reconstructs battle state from protocol log, builds per-turn frames             | `packages/battle-engine/src/replay/replay-engine.ts`                     | Exists |
| Replay controls              | Scrub through turns, step forward/back, auto-play                               | `apps/web/src/features/battle/components/ReplayControls.tsx`             | Exists |
| Battle log                   | Color-coded entries for moves, damage, status, faints, hazards                  | `apps/web/src/features/battle/components/BattleLog.tsx`                  | Exists |
| Setup move scoring           | Hint engine scores Swords Dance, Nasty Plot, Calm Mind based on HP and matchup  | `packages/battle-engine/src/ai/hint-engine.ts` (lines 169-172)           | Exists |
| Recovery move scoring        | Hint engine scores Roost, Recover etc. higher when HP is low                    | `packages/battle-engine/src/ai/hint-engine.ts` (lines 175-179)           | Exists |
| Hazard-aware switching       | Switch score penalized by own-side hazards (SR: -10, Spikes: -5/layer, Web: -5) | `packages/battle-engine/src/ai/hint-engine.ts` (lines 219-222)           | Exists |
| Sacrificial play teaching    | Explain why a sacrifice preserves a win condition                               | --                                                                       | Future |
| Win condition identification | Detect which Pokemon is the team's sweeper/breaker/wincon                       | --                                                                       | Future |
| Multi-turn plan display      | Show the AI's intended sequence of plays (not just next move)                   | --                                                                       | Future |

### Implementation Notes

The evaluator (`evaluator.ts`) produces a raw score that is normalized to [-1, +1] via `tanh(raw / 1400)`. The feature breakdown is exposed through `EvalResult.features`, enabling the UI to show exactly why a position is winning or losing. Each feature contributes a named, weighted component (e.g. "HP remaining: +0.15, weight 1024, contribution +153.6").

The win probability module maps this normalized score to a percentage, and `winProbabilityDelta()` compares consecutive states to flag critical moments. The replay engine stores win probability at each turn boundary in `ReplayFrame.winProbTeam1`, allowing the `WinProbabilityGraph` component to render the full arc.

---

## Pillar 2: Simultaneous Action Selection

> Both players choose their action at the same time every turn. This creates game theory dynamics: predicting the opponent's choice, hedging against multiple possibilities, and understanding the Nash equilibrium of move/switch matrices.

### Feature Map

| Concept                     | Feature                                                                                           | Package / Key File                                                    | Status |
| --------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------ |
| DUCT algorithm              | Decoupled UCT for simultaneous-move games; maintains independent per-player UCB1 statistics       | `packages/battle-engine/src/ai/mcts-ai.ts`                            | Exists |
| MCTS configuration          | 10K iterations, 5s time limit, 0.7 exploration, depth-4 rollouts (defaults)                       | `packages/battle-engine/src/ai/mcts-types.ts` (`DEFAULT_MCTS_CONFIG`) | Exists |
| DUCT tree structure         | `DUCTNode` with separate `p1Stats` / `p2Stats` maps + joint action statistics                     | `packages/battle-engine/src/ai/mcts-types.ts`                         | Exists |
| UCB1 selection              | Exploration-exploitation balance per player, unvisited actions prioritized                        | `packages/battle-engine/src/ai/mcts-ai.ts:selectUCB1()`               | Exists |
| Battle cloning              | Deep-clone `@pkmn/sim` Battle for MCTS rollouts                                                   | `packages/battle-engine/src/ai/battle-cloner.ts`                      | Exists |
| Hint engine                 | Ranks all legal moves by estimated value, shows best/good/neutral/inaccuracy/mistake/blunder      | `packages/battle-engine/src/ai/hint-engine.ts`                        | Exists |
| Move classification         | Gap-based: best (0), good (<=5), neutral (<=15), inaccuracy (<=30), mistake (<=60), blunder (>60) | `packages/battle-engine/src/ai/hint-engine.ts:classifyGap()`          | Exists |
| Hint panel UI               | Displays ranked moves with classification badges and explanations                                 | `apps/web/src/features/battle/components/HintPanel.tsx`               | Exists |
| Greedy AI                   | Always picks highest-damage move; baseline opponent                                               | `packages/battle-engine/src/ai/greedy-ai.ts`                          | Exists |
| Heuristic AI                | Type matchup awareness, situational status/hazard/recovery moves, switching logic                 | `packages/battle-engine/src/ai/heuristic-ai.ts`                       | Exists |
| Random AI                   | Uniform random move selection; floor opponent                                                     | `packages/battle-engine/src/ai/random-ai.ts`                          | Exists |
| Move selector UI            | Shows available moves with type badges, PP, disabled state                                        | `apps/web/src/features/battle/components/MoveSelector.tsx`            | Exists |
| Switch menu UI              | Shows bench Pokemon with HP, status, and type info for switch decisions                           | `apps/web/src/features/battle/components/SwitchMenu.tsx`              | Exists |
| Game theory matrix display  | Visual payoff matrix showing outcomes for each move pair                                          | --                                                                    | Future |
| Nash equilibrium calculator | Compute mixed strategy Nash equilibria for simplified move matrices                               | --                                                                    | Future |
| Prediction reasoning        | Show why the AI expects a particular opponent action                                              | --                                                                    | Future |

### Implementation Notes

The MCTS implementation uses the DUCT (Decoupled UCT) variant specifically because Pokemon is a simultaneous-move game. Standard UCT assumes alternating play and would model the game incorrectly. DUCT maintains separate statistics for each player's actions and combines them only during rollouts.

The hint engine takes a different approach: rather than tree search, it uses static evaluation (damage calc + heuristic scoring) to rank moves. This is fast enough for real-time hints during human play. The six classification tiers (best through blunder) mirror chess engine conventions, giving players intuitive feedback on move quality.

The four AI difficulty levels form a progression: Random (uniform) -> Greedy (max damage) -> Heuristic (type-aware + switching) -> Expert (MCTS). Each level adds a new dimension of strategic reasoning, making them useful as training opponents at different skill levels.

---

## Pillar 3: Imperfect Information

> You don't know the opponent's full team until Pokemon are revealed. Even then, you don't know their exact sets (EVs, moves, items, abilities) until observed in battle. Skilled players use Team Preview, usage statistics, and in-battle observations to narrow possibilities.

### Feature Map

| Concept                       | Feature                                                                        | Package / Key File                                                       | Status  |
| ----------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------ | ------- | ----- | ---- | -------- | ---------------------------------- | ----------------------------------------------- | ------ |
| Set predictor                 | Bayesian belief tracking: initializes from Smogon sets with uniform prior      | `packages/battle-engine/src/ai/set-predictor.ts`                         | Exists  |
| Move observation updates      | Observing a move multiplies non-matching set probabilities by 0.01 (near-zero) | `packages/battle-engine/src/ai/set-predictor.ts:updateFromObservation()` | Exists  |
| Item observation updates      | Revealed item eliminates sets with different items                             | `packages/battle-engine/src/ai/set-predictor.ts:updateFromObservation()` | Exists  |
| Ability observation updates   | Revealed ability eliminates sets with different abilities                      | `packages/battle-engine/src/ai/set-predictor.ts:updateFromObservation()` | Exists  |
| Probability re-normalization  | After each observation, probabilities re-normalized to sum to 1                | `packages/battle-engine/src/ai/set-predictor.ts` (lines 86-88)           | Exists  |
| Set sampling                  | Weighted random sampling from posterior distribution for MCTS determinization  | `packages/battle-engine/src/ai/set-predictor.ts:sampleSet()`             | Exists  |
| Smogon sets database          | Per-format recommended movesets stored in DB, fetched via API                  | `SmogonSet` model, `GET /api/pokemon/[id]/sets`                          | Exists  |
| Team Preview UI               | Shows opponent's 6 Pokemon before battle, player selects lead order            | `apps/web/src/features/battle/components/TeamPreview.tsx`                | Exists  |
| Usage statistics              | Monthly usage percentages per format, stored and queryable                     | `UsageStats` model, `packages/smogon-data/`                              | Exists  |
| Teammate correlations         | Pair-wise correlation data: "If X is on a team, Y appears N% of the time"      | `TeammateCorr` model, `packages/smogon-data/`                            | Exists  |
| Protocol parser (info reveal) | Parses `                                                                       | move                                                                     | `, `    | -item | `, ` | -ability | ` protocol lines to detect reveals | `packages/battle-engine/src/protocol-parser.ts` | Exists |
| Opponent set display          | Show predicted remaining sets for opponent Pokemon based on observations       | --                                                                       | Planned |
| Deduction walkthrough         | Step-by-step display: "They used X, so it's probably Y set because..."         | --                                                                       | Future  |
| Team Preview puzzle mode      | Practice deducing opponent strategy from 6-Pokemon preview alone               | --                                                                       | Future  |

### Implementation Notes

The `SetPredictor` class implements a lightweight Bayesian filter. At initialization, all known Smogon sets for a Pokemon are assigned equal probability (`1/N`). Each observation (move, item, ability) acts as evidence: sets incompatible with the observation have their probability multiplied by 0.01 (not zeroed, to handle edge cases like non-standard sets). After every update, probabilities are re-normalized.

This feeds into MCTS through `sampleSet()`: when the search needs to evaluate a position, it samples opponent sets from the posterior distribution, creating multiple "determinizations" (possible worlds consistent with observations). The `MCTSConfig.determinizations` parameter (default: 4) controls how many worlds are sampled per iteration.

The data pipeline (`packages/smogon-data/`) seeds the database with Smogon usage statistics, sets, and teammate correlations, providing the statistical foundation for all prediction features.

---

## Pillar 4: Probability Management

> Pokemon has inherent randomness: damage rolls (16 values, 85-100% of calculated damage), move accuracy (Stone Edge: 80%, Focus Blast: 70%), critical hits (1/24 = 4.17%), and secondary effects (Scald: 30% burn). Expert players calculate expected value and manage risk.

### Feature Map

| Concept                    | Feature                                                                               | Package / Key File                                                      | Status                          |
| -------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------- | ----------------------------------------------- | ------ |
| Damage calculator          | `@smogon/calc` wrapper with full EV/IV/nature/item/ability/field support              | `packages/damage-calc/src/calc.service.ts`                              | Exists                          |
| 16 damage rolls            | `flattenDamage()` preserves all 16 roll values from `@smogon/calc` output             | `packages/damage-calc/src/calc.service.ts:flattenDamage()`              | Exists                          |
| KO chance strings          | "guaranteed OHKO", "possible 2HKO", "5+ hits to KO" from min/max damage rolls         | `packages/damage-calc/src/calc.service.ts:deriveKoChance()`             | Exists                          |
| Damage description         | Full calc string: "252 Atk Great Tusk Headlong Rush vs 0/4 Iron Valiant: 85.2-100.3%" | `packages/damage-calc/src/calc.service.ts` (via `result.desc()`)        | Exists                          |
| Matchup matrix             | Team-vs-threats grid: best move + max damage % + KO chance for every pair             | `packages/damage-calc/src/calc.service.ts:calculateMatchupMatrix()`     | Exists                          |
| Damage calc page           | Interactive UI for running calcs with EV/move/field selectors                         | `apps/web/src/app/damage-calc/page.tsx`                                 | Planned                         |
| Win probability estimation | Evaluator score mapped to win % through S-curve (not pure expected value)             | `packages/battle-engine/src/ai/win-probability.ts:scoreToProbability()` | Exists                          |
| Hint engine KO bonuses     | Guaranteed KO: +80 score, partial KO: +40 + (chance \* 40)                            | `packages/battle-engine/src/ai/hint-engine.ts` (lines 88-98)            | Exists                          |
| Priority move bonus        | +20 score when opponent <30% HP and move has positive priority                        | `packages/battle-engine/src/ai/hint-engine.ts` (lines 101-104)          | Exists                          |
| Accuracy in move data      | Move accuracy stored in `MoveData` type, available throughout the stack               | `packages/core/src/types.ts`                                            | Exists                          |
| Field conditions           | Weather, terrain, screens, Trick Room affect damage calculations                      | `packages/damage-calc/src/calc.service.ts:buildField()`                 | Exists                          |
| Status effect on calc      | Burn halves attack, paralysis quarters speed, etc. integrated into calc               | `packages/damage-calc/src/calc.service.ts:toCalcStatus()`               | Exists                          |
| Crit detection in battle   | Protocol parser flags `                                                               | -crit                                                                   | ` events for log and commentary | `packages/battle-engine/src/protocol-parser.ts` | Exists |
| Super effective detection  | Protocol parser flags `                                                               | -supereffective                                                         | ` events                        | `packages/battle-engine/src/protocol-parser.ts` | Exists |
| EV optimization teaching   | Explain why specific EV spreads hit benchmarks (survive X, outspeed Y)                | --                                                                      | Future                          |
| Risk/reward analysis       | Show expected value of risky plays (Focus Blast vs Thunderbolt)                       | --                                                                      | Future                          |
| Damage roll visualization  | Show the 16-value distribution as a histogram, highlight KO threshold                 | --                                                                      | Future                          |

### Implementation Notes

The damage calculator (`calc.service.ts`) wraps `@smogon/calc` with a clean API. A key detail: `@smogon/calc` requires display names ("Great Tusk"), not Showdown IDs ("greatTusk"), so `resolveSpeciesName()` handles the translation via `@pkmn/dex` lookup.

The 16 damage rolls represent the game's random factor: each attack deals between 85% and 100% of its calculated damage, in 16 discrete steps. `deriveKoChance()` checks all rolls against the defender's HP to determine guaranteed vs. possible KOs across 1-4 hits.

The matchup matrix (`calculateMatchupMatrix()`) is particularly useful for team analysis: given a team of 6 and a list of threats, it produces a grid showing the best move and KO chance for every attacker-defender pair. This reveals which threats the team cannot handle.

---

## Pillar 5: Team Building (Meta-Pillar)

> Team building is the meta-pillar: it encompasses all others. A well-built team accounts for long-term planning (hazard support), simultaneous action (flexible move options), imperfect information (unpredictable sets), and probability (EV benchmarks). The build-test-analyze loop is iterative and data-driven.

### Feature Map

| Concept                        | Feature                                                                   | Package / Key File                                                           | Status  |
| ------------------------------ | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------- |
| Team CRUD                      | Create, read, update, delete teams with full slot management              | `packages/teams/`, API: `GET/POST /api/teams`                                | Exists  |
| Team slot management           | Add, update, remove Pokemon in positions 1-6 with full set data           | `packages/teams/`, API: `GET/POST/PUT/DELETE /api/teams/[teamId]/slots`      | Exists  |
| Showdown paste import          | Parse standard Showdown format into `TeamSlotData[]`                      | `packages/core/src/showdown-paste.ts`                                        | Exists  |
| Showdown paste export          | Convert team to standard Showdown paste text                              | `packages/core/src/showdown-paste.ts`, API: `GET /api/teams/[teamId]/export` | Exists  |
| Type coverage analysis         | Team-level defensive and offensive type coverage grids                    | `packages/analysis/src/coverage.service.ts`                                  | Exists  |
| Threat identification          | Identify meta threats the team struggles against                          | `packages/analysis/src/threat.service.ts`                                    | Exists  |
| Synergy scoring                | Evaluate type synergy and role complementarity between teammates          | `packages/analysis/src/synergy.service.ts`                                   | Exists  |
| Composite analysis             | Full team analysis combining coverage, threats, and synergy               | `packages/analysis/src/analysis.service.ts`                                  | Exists  |
| Coverage-based recommendations | Suggest Pokemon that patch type coverage gaps                             | `packages/recommendations/src/coverage-recommender.ts`                       | Exists  |
| Usage-based recommendations    | Suggest Pokemon based on Smogon usage and teammate correlations           | `packages/recommendations/src/usage-recommender.ts`                          | Exists  |
| Composite recommendations      | Blend coverage + usage scores for weighted recommendations                | `packages/recommendations/src/composite-recommender.ts`                      | Exists  |
| Teammate correlations          | "Pokemon X appears on Y% of teams with Pokemon Z" from usage data         | `TeammateCorr` model, `packages/smogon-data/`                                | Exists  |
| Format definitions             | OU, UU, RU, NU, PU, Ubers, VGC — with rule sets and banlists              | `packages/formats/src/format.service.ts`                                     | Exists  |
| Legality checking              | Validate Pokemon, moves, abilities, items against format rules            | `packages/formats/src/format.service.ts`                                     | Exists  |
| Team validation                | Full validation: format legality, clause compliance, move legality        | `packages/teams/src/validation.service.ts`                                   | Exists  |
| Batch simulation               | Run N games between two teams with concurrency and analytics              | `packages/battle-engine/src/simulation/batch-simulator.ts`                   | Exists  |
| Per-Pokemon batch stats        | Track KOs, faints, appearances across batch simulations                   | `packages/battle-engine/src/simulation/batch-simulator.ts:PokemonStats`      | Exists  |
| Turn distribution              | Histogram of game lengths from batch simulation                           | `packages/battle-engine/src/simulation/batch-simulator.ts:BatchAnalytics`    | Exists  |
| Sample teams                   | Pre-built reference teams with archetype tags (HO, Balance, Stall, etc.)  | `packages/teams/src/sample-team.service.ts`                                  | Exists  |
| Sample team browser            | Browse, search, and copy sample teams by format/archetype                 | `apps/web/src/app/battle/sample-teams/page.tsx`                              | Exists  |
| Guided builder mode            | Step-by-step team building with recommendations at each step              | Team `mode: "guided"`, `apps/web/src/app/teams/[teamId]/guided`              | Exists  |
| Pokemon browser                | Search, filter, and explore all Pokemon with stats and types              | `apps/web/src/app/pokemon/page.tsx`                                          | Exists  |
| Pokemon detail page            | Full species info: stats, abilities, type matchups, learnset, Smogon sets | `apps/web/src/app/pokemon/[id]/page.tsx`                                     | Exists  |
| Item combobox                  | Searchable item selector in slot editor                                   | `apps/web/src/features/team-builder/components/item-combobox.tsx`            | Exists  |
| Simulate page                  | Batch simulation setup: pick teams, AI difficulty, game count             | `apps/web/src/app/battle/simulate/page.tsx`                                  | Exists  |
| Team versioning                | Branch/fork teams to compare variants (A/B testing)                       | --                                                                           | Planned |
| Meta profile snapshots         | Capture meta state at a point in time to track meta shifts                | --                                                                           | Future  |
| Build constraints              | "Build me a team that beats these 5 Pokemon" as a constraint solver       | --                                                                           | Future  |

### Implementation Notes

Team building is powered by the interplay of multiple packages:

- **`teams`** handles persistence and CRUD
- **`analysis`** evaluates what the team has and lacks
- **`recommendations`** suggests what to add
- **`formats`** enforces legality
- **`damage-calc`** tests offensive/defensive benchmarks
- **`battle-engine`** validates through simulation

The batch simulator (`batch-simulator.ts`) runs up to `concurrency` games (default: 4) in parallel using cooperative async scheduling. Each game gets fresh AI instances. Results include per-Pokemon KO/faint stats and turn count distribution, providing quantitative feedback on team performance. The four AI difficulty levels (random, greedy, heuristic, expert) let users test against progressively smarter opponents.

Sample teams (`sample-team.service.ts`) serve as starting points and reference builds. They are stored with archetype tags (HO, Balance, Stall, etc.) and can be imported directly into the team builder.

---

## Cross-Cutting: The LLM Assistant (Pecharunt)

The LLM assistant bridges all five pillars through natural language interaction. It can answer questions about any pillar, execute tool calls to analyze teams or look up data, and maintain conversational context across a session.

### Feature Map

| Concept                   | Feature                                                                                  | Package / Key File                                                        | Status  |
| ------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------- |
| Chat service              | OpenAI-powered conversational assistant with streaming responses                         | `packages/llm/src/chat.service.ts`                                        | Exists  |
| Chat session management   | Persistent sessions with message history, tied to teams                                  | `packages/llm/src/chat-session.service.ts`                                | Exists  |
| Team context injection    | Automatically injects current team details into system prompt                            | `packages/llm/src/context-builder.ts:buildTeamContext()`                  | Exists  |
| Meta context injection    | Injects top-N usage stats for the team's format into prompt                              | `packages/llm/src/context-builder.ts:buildMetaContext()`                  | Exists  |
| Pokemon context injection | Injects species details when user is viewing a Pokemon page                              | `packages/llm/src/context-builder.ts:buildPokemonContext()`               | Exists  |
| Page-aware context        | Determines context from current page route (team editor, battle, etc.)                   | `packages/llm/src/context-builder.ts:buildPageContextPrompt()`            | Exists  |
| Battle context builder    | Generates turn-by-turn commentary prompts from battle state                              | `packages/llm/src/battle-context-builder.ts:buildTurnCommentaryContext()` | Exists  |
| Post-battle analysis      | Summarizes key moments, KOs, turning points after battle ends                            | `packages/llm/src/battle-context-builder.ts:buildPostBattleContext()`     | Exists  |
| Turn-specific analysis    | Deep analysis of a specific turn: was the play optimal? alternatives?                    | `packages/llm/src/battle-context-builder.ts:buildTurnAnalysisContext()`   | Exists  |
| Plan mode                 | LLM generates step-by-step plans for complex tasks, tracks step completion               | `packages/llm/src/context-builder.ts:buildPlanModePrompt()`               | Exists  |
| Stream parser             | Detects `<plan>`, `<step>`, `<step_update>` XML tags in streaming content                | `packages/llm/src/stream-parser.ts:StreamParser`                          | Exists  |
| SSE events                | Typed event system: content, tool_start/end, plan_start/step_update, errors              | `packages/llm/src/sse-events.ts`                                          | Exists  |
| Tool context filtering    | Restricts available MCP tools based on current page (team editor vs battle)              | `packages/llm/src/tool-context.ts`                                        | Exists  |
| MCP server                | 24 tools across 4 categories: data query (7), analysis (6), team CRUD (6), meta recs (5) | `packages/mcp-server/`                                                    | Exists  |
| MCP resources             | 5 static resources: type chart, formats, natures, stat formulas, viability               | `packages/mcp-server/src/resources/`                                      | Exists  |
| Chat UI components        | Message display, input, tool call visualization, plan display, session list              | `apps/web/src/features/chat/components/`                                  | Exists  |
| Chat FAB                  | Floating action button for quick access to chat from any page                            | `apps/web/src/components/chat-fab.tsx`                                    | Exists  |
| Chat sidebar              | Resizable sidebar chat panel integrated into app shell                                   | `apps/web/src/components/chat-sidebar.tsx`                                | Exists  |
| Live battle commentary    | AI-generated commentary during live battles                                              | `packages/llm/src/battle-context-builder.ts`, `CommentaryPanel.tsx`       | Exists  |
| Coaching sessions         | Multi-turn coaching: "Why did I lose?" with battle replay context                        | --                                                                        | Planned |
| Proactive suggestions     | LLM notices team weaknesses and suggests fixes without being asked                       | --                                                                        | Future  |

### Implementation Notes

The LLM stack uses a layered context approach:

1. **Static context**: System prompt with Pokemon competitive knowledge
2. **Page context**: Injected based on the current route (team details, Pokemon info, battle state)
3. **Tool context**: MCP tools filtered to what's relevant for the current page type
4. **Session context**: Previous messages in the conversation

The `StreamParser` class handles a unique challenge: the LLM's response may contain XML plan tags mixed with regular content. The parser strips these tags and converts them to separate SSE events, so the UI can display plan progress indicators alongside the chat response.

The battle context builder (`battle-context-builder.ts`) generates three types of prompts: per-turn commentary, post-battle summary, and deep turn analysis. Each describes the battle state in natural language that the LLM can reason about without needing raw protocol data.

---

## End-to-End Loop

The five pillars converge in the build-test-analyze loop. Here is how a team flows through the system:

```
                    +-----------+
                    |   BUILD   |
                    +-----------+
                    | teams/    |
                    | analysis/ |
                    | recs/     |
                    | formats/  |
                    +-----+-----+
                          |
                          v
                    +-----------+
                    |   TEST    |
                    +-----------+
                    | battle-   |
                    | engine/   |
                    | sim/      |
                    | batch-    |
                    | simulator |
                    +-----+-----+
                          |
                          v
                    +-----------+
                    |  ANALYZE  |
                    +-----------+
                    | evaluator |
                    | win-prob  |
                    | hint-eng  |
                    | replay    |
                    | damage-   |
                    | calc/     |
                    +-----+-----+
                          |
                          v
                    +-----------+
                    |   TWEAK   |
                    +-----------+
                    | slot-     |
                    | editor    |
                    | item-     |
                    | combobox  |
                    | context-  |
                    | builder   |
                    +-----+-----+
                          |
                          v
                    +-----------+
                    |   FORK    | (Planned)
                    +-----------+
                    | team      |
                    | version-  |
                    | ing       |
                    +-----+-----+
                          |
                          |
              +-----------+-----------+
              |                       |
              v                       v
        +----------+          +-----------+
        | COMPARE  |          |   LOOP    |
        +----------+          +-----------+
        | batch-   |          | Back to   |
        | sim diff |          | TEST      |
        +----------+          +-----------+
```

### Package Responsibilities by Stage

| Stage       | Packages                                                                                            | What Happens                                                                 |
| ----------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **BUILD**   | `teams`, `analysis`, `recommendations`, `formats`, `pokemon-data`, `smogon-data`                    | Create team, add Pokemon, get recommendations, validate legality             |
| **TEST**    | `battle-engine` (sim, AI players, batch-simulator)                                                  | Battle against AI opponents, run batch simulations for statistical results   |
| **ANALYZE** | `battle-engine` (evaluator, win-probability, hint-engine, replay-engine), `damage-calc`, `analysis` | Review battle replay, study critical turns, run damage calcs, check coverage |
| **TWEAK**   | `teams`, `damage-calc`, `llm`                                                                       | Adjust EVs/moves/items based on analysis, ask the LLM for advice             |
| **FORK**    | `teams` (planned: versioning)                                                                       | Branch the team to test a variant without losing the original                |
| **COMPARE** | `battle-engine` (batch-simulator)                                                                   | Run both variants against the same opponents, compare win rates              |

---

## Walkthrough: "I Want to Build an OU Team"

1. **Create team**: `POST /api/teams` with `formatId: "gen9ou"`, `mode: "guided"`. The guided builder opens at `/teams/[teamId]/guided`.

2. **Pick a lead**: Browse Pokemon at `/pokemon` filtered by OU. The composite recommender (`packages/recommendations/`) suggests top picks weighted by usage data and format viability.

3. **Add the lead**: `POST /api/teams/[teamId]/slots` with the chosen Pokemon. The slot editor (`apps/web/src/features/team-builder/components/slot-editor.tsx`) shows Smogon sets to pre-fill moves/EVs/item.

4. **Get recommendations for slot 2**: The recommender considers the lead's typing, suggests teammates that cover weaknesses. Teammate correlations from `TeammateCorr` data inform the suggestions.

5. **Repeat for slots 3-6**: Each addition re-runs analysis. Type coverage gaps (`packages/analysis/src/coverage.service.ts`) and threat identification (`threat.service.ts`) update with each slot.

6. **Validate**: Team validation (`packages/teams/src/validation.service.ts`) checks format legality, species clause, item clause, move legality.

7. **Test**: Navigate to `/battle/new`, select the team, choose an AI difficulty. Battle plays out at `/battle/live` with real-time hints, eval bar, and win probability graph.

8. **Review**: After the battle, the replay engine builds frames. Watch the replay at `/battle/replay/[battleId]`, scrubbing to critical turns flagged by `winProbabilityDelta()`.

9. **Adjust**: Based on battle results, return to the team editor. The LLM assistant (accessible via chat sidebar) can answer "Why did I lose to Heatran?" with context about your team's weaknesses.

---

## Walkthrough: "My Team Keeps Losing to Heatran"

1. **Check coverage**: Run team analysis at `GET /api/teams/[teamId]/analysis`. The `threat.service.ts` identifies Heatran as a threat based on your team's type coverage gaps.

2. **Run damage calcs**: Use the matchup matrix (`calculateMatchupMatrix()`) to see which of your Pokemon can damage Heatran and by how much. If no one has a guaranteed 2HKO, you have a problem.

3. **Ask the LLM**: Open chat with the team context injected. "How do I handle Heatran?" The LLM sees your team composition and suggests: add a Ground-type move, swap in a Pokemon that resists Fire/Steel, or adjust EVs on your Earthquake user to guarantee the KO.

4. **Get recommendations**: `POST /api/recommend` with the team. The coverage recommender may suggest Garchomp (Ground STAB, resists Fire) or Great Tusk (Ground STAB, Rapid Spin for hazard removal).

5. **Test the fix**: Swap in the recommended Pokemon, run a batch simulation (`runBatchSimulation()`) with 50-100 games. Compare win rates before and after the swap.

6. **Verify with calcs**: Run `calculateDamage()` to confirm your new Pokemon's Earthquake guarantees the 2HKO on Heatran with your EV spread.

---

## Walkthrough: "Is My EV Spread Optimal?"

1. **Identify the benchmark**: What do you need to survive? Run damage calcs against top threats: "252 Atk Garchomp Earthquake vs my Heatran". What do you need to outspeed? Check speed tiers for the format.

2. **Damage calc exploration**: Use `POST /api/damage-calc` with different EV spreads. Try 252 HP / 252 SpD vs 252 HP / 128 Def / 128 SpD. Compare survival against physical and special threats.

3. **Batch simulate**: Run 100 games with each EV spread variant. Compare win rates. The per-Pokemon stats (`PokemonStats`) show whether the target Pokemon faints more or less often with each spread.

4. **Ask the LLM**: "Should I run max SpD or split defenses on Heatran?" The LLM can reference the meta context (what threats are most common in OU) and suggest an EV spread that hits relevant benchmarks.

5. **Fine-tune**: Adjust EVs in the slot editor, re-run batch simulations. The difference between a well-benchmarked spread and a naive one can be several percentage points of win rate.

---

## Summary: Pillar Coverage at a Glance

| Pillar                    | Exists      | Partial | Planned | Future |
| ------------------------- | ----------- | ------- | ------- | ------ |
| 1. Long-term Planning     | 14 features | 0       | 0       | 3      |
| 2. Simultaneous Action    | 13 features | 0       | 0       | 3      |
| 3. Imperfect Information  | 11 features | 0       | 1       | 2      |
| 4. Probability Management | 13 features | 0       | 1       | 3      |
| 5. Team Building (Meta)   | 25 features | 0       | 1       | 2      |
| Cross-Cutting (LLM)       | 19 features | 0       | 1       | 1      |
| **Total**                 | **95**      | **0**   | **4**   | **14** |

The codebase has substantial coverage across all five pillars. The strongest areas are team building infrastructure (Pillar 5) and probability management tools (Pillar 4). The primary gaps are in teaching and explanation: the system can evaluate and recommend, but does not yet explain the underlying competitive concepts to the user in a structured educational format. The planned coaching sessions and the future game theory / deduction teaching features would close this gap.
