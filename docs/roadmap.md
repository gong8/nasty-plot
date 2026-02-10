# Nasty Plot — Product Roadmap

## Overview

Nasty Plot is a Pokemon competitive team building, analysis, and training platform. This roadmap defines five milestones that take the project from a functional prototype to a community-ready platform.

**Current State:** 14 packages, 30+ API routes, 10 Prisma models, 4 AI tiers, 24 MCP tools, LLM chat with streaming, battle engine with replay/simulation, team CRUD with guided and freeform modes.

---

## Milestone Summary

| Milestone | Name | Theme | Status | Dependencies |
|-----------|------|-------|--------|--------------|
| M1 | Solid Foundation | Make everything that exists robust and complete | In Progress | None |
| M2 | The Feedback Loop | Team versioning + batch simulation + meta profiles | Not Started | M1 |
| M3 | Battle Training | Learn from battles, not just play them | Not Started | M1, M2 |
| M4 | The Intelligent Assistant | Pecharunt becomes a real coach | Not Started | M2, M3 |
| M5 | Community & Scale | From personal tool to platform | Not Started | M1-M4 |

## Dependency Graph

```
M1: Solid Foundation
 |
 ├──► M2: The Feedback Loop
 |     |
 |     ├──► M3: Battle Training
 |     |     |
 |     |     └──► M4: The Intelligent Assistant
 |     |           |
 |     └───────────┘
 |
 └──────────────────► M5: Community & Scale
                        (depends on M1-M4)
```

```
Timeline (sequential, with overlap where dependencies allow):

  M1 ████████████
  M2          ████████████
  M3               ████████████
  M4                     ████████████
  M5                               ████████████
```

---

## Milestone 1: Solid Foundation

**Theme:** Make everything that exists robust and complete.
**Status:** In Progress

The platform has broad feature coverage but gaps in format support, validation, and edge cases. This milestone closes those gaps so that every feature works reliably across all supported formats before building new product loops on top.

### Deliverables

#### National Dex Support
- Extend `@pkmn/dex` usage beyond Gen 9 SV-native Pokemon to include "Past" Pokemon required for NatDex formats
- Update `packages/pokemon-data/src/dex.service.ts` to support NatDex-aware species lookup
- Ensure NatDex OU, NatDex UU, and NatDex Monotype format definitions include the full legal Pokemon pool
- Update learnset lookups to return NatDex-legal moves (moves from prior generations that are legal in NatDex)

#### Complete Format Filtering
- Format-aware legality checks throughout the stack: Pokemon, moves, abilities, items
- `packages/formats/src/format.service.ts` must expose a unified `isLegal(pokemonId, formatId)` API
- UI components (Pokemon search, move selector, ability picker, item combobox) filter options by selected format
- API routes accept an optional `formatId` parameter and return only legal results when provided

#### Validation Completeness
- Implement all standard Smogon clauses in `packages/teams/src/validation.service.ts`:

| Clause | Description | Current Status |
|--------|-------------|----------------|
| Species Clause | No duplicate species on a team | Implemented |
| Sleep Clause | Only one opponent Pokemon may be put to sleep at a time | Not implemented |
| Evasion Clause | Moves that boost evasion are banned | Not implemented |
| OHKO Clause | One-hit KO moves (Fissure, Sheer Cold, etc.) are banned | Not implemented |
| Moody Clause | Pokemon with the Moody ability are banned | Not implemented |
| Shadow Tag Clause | Pokemon with Shadow Tag are banned (except Gothitelle line in some formats) | Not implemented |
| Baton Pass Clause | Baton Pass is banned or restricted depending on format | Not implemented |
| Endless Battle Clause | Prevent infinite loops (Recycle + Leppa Berry + Heal Pulse) | Not implemented |

#### VGC Doubles Support
- 4-pick-2-lead Team Preview UI for VGC format battles
- Doubles battle field rendering (2v2 active Pokemon per side)
- Targeting system in move selection (choose which opponent to target)
- Spread move mechanics in damage calc (75% damage modifier in doubles)
- Doubles-specific analysis: speed control, redirection, Fake Out pressure

#### Damage Preview
- Show damage range on move hover during live battles
- Integrate `@smogon/calc` inline with the battle UI
- Display as percentage HP range (e.g., "42-50%") overlaid on the target Pokemon

#### Test Coverage
- Target: 80% line coverage across all packages
- Priority packages for coverage improvement:

| Package | Current Estimate | Target | Priority |
|---------|-----------------|--------|----------|
| `core` | ~60% | 80% | Medium |
| `teams` | ~50% | 80% | High |
| `formats` | ~40% | 80% | High |
| `battle-engine` | ~45% | 80% | High |
| `analysis` | ~55% | 80% | Medium |
| `damage-calc` | ~50% | 80% | Medium |
| `pokemon-data` | ~65% | 80% | Low |
| `recommendations` | ~40% | 80% | Medium |
| `llm` | ~35% | 80% | Medium |

#### Error Handling Audit
- Standardize API error responses across all 30+ routes
- Define error response schema: `{ error: string, code?: string, details?: unknown }`
- Add error boundaries in React for all page-level components
- Graceful degradation when data is missing (unseeded formats, network failures)

#### Data Pipeline Resilience
- Retry logic for `@pkmn/smogon` data fetches in `packages/data-pipeline/src/cli/seed.ts`
- Partial failure handling: if one format fails to seed, continue with others
- Staleness detection improvements: warn when data is older than 30 days
- Seed progress reporting (currently silent, should log progress per format)

### Success Criteria

1. All 8 format definitions have working legality checks that filter Pokemon, moves, abilities, and items
2. A user can build a legal NatDex OU team end-to-end without encountering illegal options
3. Doubles battles render correctly with 2v2 active fields and targeting UI
4. No dead-end UI states — every action either succeeds or shows a clear, actionable error
5. Validation service covers all standard Smogon clauses for every format
6. Test coverage reaches 80% across all packages
7. Data pipeline can recover from partial failures and report progress

### Dependencies

None. This milestone is purely foundational and can begin immediately.

### Key New Files/Packages

| File/Path | Purpose |
|-----------|---------|
| `packages/formats/src/clauses/` | Directory for individual clause implementations |
| `packages/formats/src/clauses/sleep-clause.ts` | Sleep Clause validation |
| `packages/formats/src/clauses/evasion-clause.ts` | Evasion Clause validation |
| `packages/formats/src/clauses/ohko-clause.ts` | OHKO Clause validation |
| `packages/formats/src/clauses/baton-pass-clause.ts` | Baton Pass Clause validation |
| `packages/battle-engine/src/doubles/` | Doubles battle mechanics |
| `apps/web/src/components/error-boundary.tsx` | Reusable React error boundary |

---

## Milestone 2: The Feedback Loop

**Theme:** Team versioning + batch simulation + meta profiles = the core product loop.
**Status:** Not Started

This is the milestone that transforms Nasty Plot from a team editor into a team optimization tool. The core loop becomes: **Build a team -> Test it against the meta -> Analyze results -> Tweak and repeat.** Team versioning makes the iteration trackable, batch simulation provides data, and meta profiles define what "the meta" means.

### Deliverables

#### Team Versioning (Git-Style)

A lightweight version control system for teams that lets users fork, compare, and merge team variants.

**Data model additions:**
- `Team.parentId` — nullable foreign key to `Team.id`, creates a fork lineage tree
- New Prisma model or JSON column for tracking the diff between parent and child

**New types** (in `packages/core/src/types.ts` or `packages/teams/src/version.types.ts`):

| Type | Purpose |
|------|---------|
| `TeamDiff` | Describes differences between two team versions |
| `SlotChange` | Per-slot change record (added, removed, modified with field-level diffs) |
| `MergeDecision` | Per-slot choice during manual merge (pick left, right, or custom) |
| `LineageNode` | Tree node for lineage visualization (id, name, parentId, children, createdAt) |

**Operations:**
- **Fork:** Deep copy a team with `parentId` pointing to the original. All slots are duplicated.
- **Compare:** Given two team IDs, produce a `TeamDiff` by matching slots on `pokemonId` and diffing field-by-field (EV spreads, moves, items, abilities, natures, tera types).
- **Merge:** UI-driven per-slot merge. For each slot that differs, the user picks which version to keep or manually edits.
- **Lineage tree:** Recursive query to build the full fork tree from any node.

**New service:** `packages/teams/src/version.service.ts`
- `forkTeam(teamId: string): Promise<Team>`
- `compareTeams(teamIdA: string, teamIdB: string): Promise<TeamDiff>`
- `mergeTeams(baseId: string, decisions: MergeDecision[]): Promise<Team>`
- `getLineageTree(teamId: string): Promise<LineageNode>`

**UI:**
- Fork button on team editor page
- Side-by-side comparison view (two team grids with diffs highlighted)
- Merge wizard (step through each differing slot)
- Lineage tree visualization (compact tree diagram showing fork history)

#### Batch Simulation Integration

The batch simulator exists in `packages/battle-engine/src/simulation/batch-simulator.ts` but has no web UI.

**Web UI (`/battle/simulate`):**
- Format and team selection
- Opponent configuration: select a specific team, AI opponent, or meta profile
- Number of games slider (10 / 50 / 100 / 250 / 500 / 1000)
- AI tier selection for both sides
- Start/cancel controls

**Progress tracking:**
- SSE (Server-Sent Events) stream from `POST /api/battles/batch`
- Real-time progress bar (games completed / total)
- Estimated time remaining

**Results dashboard:**
- Overall win rate with confidence interval
- Per-Pokemon performance table:

| Pokemon | Games | KOs | Deaths | Avg Turns Alive | Win Contribution |
|---------|-------|-----|--------|-----------------|------------------|

- Turn distribution histogram (how long do games last?)
- Most common loss patterns (which opposing Pokemon cause the most trouble?)

**Variant comparison:**
- "Simulate both variants" button when viewing a team comparison (from versioning)
- Side-by-side results: Team A win rate vs Team B win rate against the same opponent
- Statistical significance indicator (is the difference meaningful or noise?)

#### Meta Profiles

A meta profile defines the expected opponent field — what Pokemon and sets you expect to face.

**Data model:**
- New model or configuration: `MetaProfile`
  - `id`, `name`, `formatId`
  - `entries`: array of `{ pokemonId, weight, setName? }`
  - Can be auto-generated from usage stats (top N Pokemon) or manually curated

**Auto-generation:**
- "Generate from usage stats" — pull top 20/30/50 Pokemon from `UsageStats` for a format
- Weights derived from usage percentages
- Sets pulled from `SmogonSet` table

**Integration points:**
- Batch simulator accepts a meta profile as opponent configuration
- Analysis endpoints accept a meta profile to scope threat analysis
- Recommendations consider meta profile when suggesting teammates
- UI: meta profile selector appears wherever opponent selection is needed

#### Optimization Suggestions

LLM-powered and algorithmic suggestions based on simulation results.

- **Post-simulation LLM analysis:** Feed batch sim results to Pecharunt, ask for actionable suggestions
- **EV optimization:** Identify specific damage calc thresholds ("252+ Atk Great Tusk Headlong Rush always 2HKOs Heatran at 252 HP / 0 Def, but you only need 220 Atk EVs to guarantee the 2HKO")
- **Replacement suggestions:** When a Pokemon underperforms in sims, suggest alternatives from the format's viable Pokemon list
- **Move changes:** "X move was never used in 500 games — consider replacing with Y"

### Success Criteria

1. A user can fork a team, make changes, simulate both variants against a meta profile, and see which wins more
2. Meta profiles are selectable and auto-generated from usage data
3. The Build -> Test -> Analyze -> Tweak loop is completable without leaving the app
4. Team comparison shows meaningful field-level diffs with highlighted changes
5. Batch simulation results include per-Pokemon stats and turn distribution
6. Lineage tree correctly displays the full fork history of any team

### Dependencies

- M1 for validation completeness (teams must be valid before simulating)
- M1 for format filtering (meta profiles need correct format-scoped Pokemon pools)

### Key New Files/Packages

| File/Path | Purpose |
|-----------|---------|
| `packages/teams/src/version.service.ts` | Fork, compare, merge, lineage operations |
| `packages/teams/src/version.types.ts` | TeamDiff, SlotChange, MergeDecision, LineageNode types |
| `packages/teams/src/meta-profile.service.ts` | Meta profile CRUD and auto-generation |
| `apps/web/src/app/battle/simulate/results/page.tsx` | Simulation results dashboard |
| `apps/web/src/app/teams/[teamId]/compare/page.tsx` | Side-by-side team comparison |
| `apps/web/src/app/teams/[teamId]/lineage/page.tsx` | Fork lineage tree view |
| `apps/web/src/features/battle/components/SimulationProgress.tsx` | Real-time progress tracking |
| `apps/web/src/features/battle/components/SimulationResults.tsx` | Results dashboard component |
| `apps/web/src/features/team-builder/components/TeamDiffView.tsx` | Visual diff between two teams |
| `apps/web/src/features/team-builder/components/MergeWizard.tsx` | Step-by-step merge UI |
| `prisma/migrations/YYYYMMDD_add_team_versioning/migration.sql` | parentId column, meta profile table |

---

## Milestone 3: Battle Training

**Theme:** Learn from battles, not just play them.
**Status:** Not Started

Playing battles is fun but not efficient for improvement. This milestone adds structured learning tools: post-game review that tells you what you did wrong, puzzles that test specific skills, and pattern drilling that builds intuition through repetition.

### Deliverables

#### Post-Game Review

A replay analysis system that grades every move and highlights critical decisions.

**Replay viewer enhancements:**
- Turn-by-turn navigation with forward/back controls (replay engine exists at `packages/battle-engine/src/replay/replay-engine.ts`)
- Full battle state visible at each turn (HP bars, status conditions, field conditions, stat boosts)
- Player's move highlighted with the engine's recommended move shown alongside

**Win probability overlay:**
- Win probability graph rendered above the replay (component exists at `apps/web/src/features/battle/components/WinProbabilityGraph.tsx`)
- Synchronized with turn navigation — current turn highlighted on graph
- Critical turn markers: turns where win probability swung by more than 20% in either direction

**Move grading system:**
- Each player move is classified by comparing it to the engine's evaluation:

| Grade | Definition | Win Prob Impact |
|-------|-----------|-----------------|
| Best | Matches engine's top choice | +/- 0% |
| Good | Within 5% of optimal | -0% to -5% |
| Inaccuracy | Suboptimal but not losing | -5% to -15% |
| Mistake | Significantly hurts position | -15% to -30% |
| Blunder | Potentially game-losing | > -30% |

- Summary statistics: accuracy percentage, blunder count, average centipawn-equivalent loss
- "What would the engine have done?" — show the engine's preferred move and its reasoning at any turn

**Post-game summary:**
- Key turning points listed with explanations
- Best and worst moves highlighted
- Overall game quality rating

#### Battle Puzzles

Curated positions where the user must find the best move.

**Puzzle structure:**
- A battle state (positions, HP, status, field conditions, known opponent sets)
- One correct answer (or a small set of acceptable answers)
- Difficulty level: Easy (1), Medium (2), Hard (3)
- Category tag

**Categories:**

| Category | Description | Example |
|----------|-------------|---------|
| Offensive | Find the KO or the setup opportunity | "Which move KOs Toxapex after Stealth Rock?" |
| Defensive | Find the correct switch or protect | "Your opponent will Earthquake — what do you switch to?" |
| Setup | Identify when to boost or set hazards | "Is it safe to Swords Dance here?" |
| Prediction | Predict the opponent's action and punish | "They will switch to Heatran — what do you do?" |
| Endgame | Win a simplified late-game position | "You have Dragapult vs Garchomp + Toxapex at 30% — find the win" |

**Target:** At least 20 curated puzzles at launch, covering all 5 categories.

**Puzzle flow:**
1. Present the position with full context
2. User selects a move (and target in doubles)
3. Reveal whether correct, show explanation
4. Track accuracy per category over time

**Puzzle creation tooling:**
- Extract interesting positions from saved replays automatically (turns with high win prob swings)
- Manual puzzle editor for curated positions
- Engine validation: verify that the "correct" answer is actually optimal

#### Pattern Drilling

Repetitive practice of specific battle scenarios to build intuition.

**Scenario types:**
- "Practice against [Pokemon]" — face a specific threat repeatedly with different teams
- "Practice managing [condition]" — weather, terrain, Trick Room, entry hazards
- "Practice [archetype] vs [archetype]" — hyper offense vs stall, rain vs sun

**Drill mechanics:**
- Scenario sets up a specific game state and opponent behavior
- User plays through the scenario multiple times
- Performance tracked: win rate, average turns to win, consistency

**Improvement tracking:**
- Per-category accuracy over time (line chart)
- Streak tracking (consecutive correct puzzle answers)
- Weak areas identified ("You struggle with defensive puzzles — practice switching")

#### MCTS Web Worker

Move the computationally expensive MCTS search out of the main thread.

- Create a Web Worker that runs the MCTS search (`packages/battle-engine/src/ai/mcts-ai.ts`)
- Communication protocol: main thread sends battle state, worker returns best move + evaluation
- Configurable search parameters: time limit (1s, 3s, 5s, 10s), simulation count
- Progress indicator in battle UI ("Engine thinking... 1,247 / 5,000 simulations")
- Graceful fallback: if Web Worker is unavailable, run on main thread with reduced depth

### Success Criteria

1. A user can review any saved battle with turn-by-turn navigation and move grading
2. Win probability graph is synchronized with replay navigation and highlights critical turns
3. At least 20 curated puzzles are available covering all 5 categories
4. Puzzle accuracy is tracked per category with historical trends
5. Pattern drills are repeatable with performance tracking
6. MCTS runs in a Web Worker without blocking the UI
7. Engine thinking time is configurable and progress is displayed

### Dependencies

- M1 for battle engine robustness (battles must run correctly before analyzing them)
- M2 for saved battle history (batch simulation provides replay data for analysis)
- M2 for meta profiles (pattern drills use meta-relevant opponents)

### Key New Files/Packages

| File/Path | Purpose |
|-----------|---------|
| `packages/battle-engine/src/review/` | Post-game review engine directory |
| `packages/battle-engine/src/review/move-grader.ts` | Move classification (best/good/inaccuracy/mistake/blunder) |
| `packages/battle-engine/src/review/critical-turns.ts` | Detect high-swing turns from win probability data |
| `packages/battle-engine/src/review/game-summary.ts` | Generate post-game summary statistics |
| `packages/battle-engine/src/puzzles/` | Puzzle engine directory |
| `packages/battle-engine/src/puzzles/puzzle.types.ts` | Puzzle data types |
| `packages/battle-engine/src/puzzles/puzzle.service.ts` | Puzzle validation and scoring |
| `packages/battle-engine/src/puzzles/puzzle-extractor.ts` | Extract puzzle candidates from replays |
| `packages/battle-engine/src/drills/` | Pattern drilling engine |
| `packages/battle-engine/src/drills/drill.service.ts` | Scenario setup and performance tracking |
| `apps/web/src/workers/mcts.worker.ts` | MCTS Web Worker |
| `apps/web/src/app/battle/review/[battleId]/page.tsx` | Post-game review page |
| `apps/web/src/app/battle/puzzles/page.tsx` | Puzzle browser |
| `apps/web/src/app/battle/puzzles/[puzzleId]/page.tsx` | Individual puzzle page |
| `apps/web/src/app/battle/drills/page.tsx` | Pattern drilling page |
| `apps/web/src/features/battle/components/MoveGrade.tsx` | Move grade badge component |
| `apps/web/src/features/battle/components/PostGameSummary.tsx` | Post-game summary panel |
| `apps/web/src/features/battle/components/PuzzleBoard.tsx` | Puzzle position display and interaction |
| `prisma/migrations/YYYYMMDD_add_puzzles/migration.sql` | Puzzle and drill tracking tables |

---

## Milestone 4: The Intelligent Assistant

**Theme:** Pecharunt becomes a real coach.
**Status:** Not Started

The LLM chat exists but currently operates as a general-purpose Q&A tool. This milestone transforms it into a contextually aware coach that can narrate battles, guide learning paths, and generate meta intelligence reports — all grounded in the user's actual data and gameplay.

### Deliverables

#### Battle-Aware LLM Commentary

Real-time and post-battle narration powered by the LLM, grounded in actual battle state.

**Real-time narration:**
- Optional toggle (default OFF to preserve API credits)
- After each turn, send the battle state delta to the LLM
- Generate a 1-2 sentence comment: move quality, strategic insight, or prediction
- Context: uses `packages/llm/src/battle-context-builder.ts` to build the prompt
- Display in the existing `CommentaryPanel` component

**Post-battle analysis:**
- LLM reads the full battle log (protocol output) and move grading data from M3
- Generates a structured analysis: opening assessment, key turning points, endgame execution
- Actionable advice: "In future games against rain teams, consider leading with your Grass-type"

**Strategic explanations:**
- "Why should I switch here?" — LLM explains based on type matchups, speed tiers, and known opponent sets
- "What is my opponent likely to do?" — prediction based on common play patterns and set predictor data
- Accessible from the battle UI via a "Ask Pecharunt" button

#### Coaching Sessions

Structured learning paths that adapt to the user's skill level.

**Learning paths:**

| Path | Target Audience | Topics |
|------|----------------|--------|
| Fundamentals | Beginners | Type matchups, STAB, stat stages, priority moves, entry hazards |
| Teambuilding | Intermediate | Role compression, core building, speed tiers, threat coverage |
| Advanced Play | Experienced | Prediction, momentum, win conditions, endgame theory, risk management |

**Adaptive difficulty:**
- Track puzzle accuracy and battle performance to estimate skill level
- Pecharunt adjusts explanation depth based on demonstrated knowledge
- "You already know type matchups well — let's focus on when to sacrifice Pokemon for momentum"

**Contextual questions:**
- During replay review: "Ask about this turn" button that sends the current turn state to the LLM
- During team building: "Why this EV spread?" button on slot editor
- During analysis: "Explain this weakness" on threat analysis results

**Session persistence:**
- Coaching progress saved to `ChatSession` with a `type` field distinguishing coaching from free chat
- Resume coaching sessions where you left off
- Track concept mastery per learning path

#### Meta Briefings

Automated meta intelligence reports generated from usage statistics.

**Report content:**
- Format-specific (one report per format)
- Usage trend analysis: rising Pokemon, falling Pokemon, stable core
- "Surprise picks" — Pokemon with low usage but high win rate
- Threat of the week — a featured Pokemon with its top sets and how to beat it
- Recommended team adjustments based on meta shifts

**Data sources:**
- `UsageStats` table (monthly snapshots)
- `TeammateCorr` table (core identification)
- `CheckCounter` table (threat/counter relationships)
- Historical comparison when multiple months of data exist

**Generation:**
- On-demand via chat command or button
- LLM synthesizes the raw data into readable analysis
- Grounded in real numbers — no hallucinated statistics
- Format: structured markdown with tables and bullet points

#### Tool Expansion

Grow the MCP tool suite to cover new M2-M4 capabilities.

**New tool modules:**

| Module | Tools | Purpose |
|--------|-------|---------|
| `battle-tools.ts` | `run_simulation`, `get_replay`, `get_battle_results`, `compare_variants` | Battle simulation and replay access |
| `version-tools.ts` | `fork_team`, `compare_teams`, `merge_teams`, `get_lineage` | Team versioning operations |
| `training-tools.ts` | `get_puzzle`, `submit_puzzle_answer`, `start_drill`, `get_training_stats` | Training and puzzle interaction |
| `meta-tools.ts` | `get_meta_briefing`, `get_trending_pokemon`, `get_meta_profile` | Meta intelligence |

**Target:** 24 existing tools + ~11 new tools = ~35 total

### Success Criteria

1. LLM commentary references actual Pokemon, moves, and battle state accurately (no hallucinated game events)
2. Commentary is toggleable and defaults to OFF
3. At least 3 structured coaching paths are available with progress tracking
4. Meta briefings are generated from real usage data with no hallucinated statistics
5. "Ask about this turn" provides contextually relevant explanations during replay review
6. MCP tool count reaches at least 35 with the new modules functional
7. Coaching sessions persist and can be resumed

### Dependencies

- M2 for meta profiles (meta briefings build on meta profile infrastructure)
- M3 for battle data and replay (commentary needs battle state, coaching uses puzzles and drills)
- M3 for move grading (post-battle LLM analysis references move grades)

### Key New Files/Packages

| File/Path | Purpose |
|-----------|---------|
| `packages/llm/src/coaching/` | Coaching session logic |
| `packages/llm/src/coaching/learning-paths.ts` | Path definitions and progression |
| `packages/llm/src/coaching/skill-estimator.ts` | Estimate user skill from performance data |
| `packages/llm/src/coaching/coaching.service.ts` | Coaching session management |
| `packages/llm/src/meta-briefing.service.ts` | Meta briefing generation from usage data |
| `packages/mcp-server/src/tools/battle-tools.ts` | Battle simulation MCP tools |
| `packages/mcp-server/src/tools/version-tools.ts` | Team versioning MCP tools |
| `packages/mcp-server/src/tools/training-tools.ts` | Puzzle and drill MCP tools |
| `packages/mcp-server/src/tools/meta-tools.ts` | Meta intelligence MCP tools |
| `apps/web/src/app/learn/page.tsx` | Learning hub page |
| `apps/web/src/app/learn/[pathId]/page.tsx` | Individual learning path page |
| `apps/web/src/features/chat/components/coaching-panel.tsx` | Coaching session UI |
| `apps/web/src/features/battle/components/AskPecharunt.tsx` | Contextual question button |

---

## Milestone 5: Community & Scale

**Theme:** From personal tool to platform.
**Status:** Not Started

Everything up to M4 serves a single user. This milestone adds the features needed for Nasty Plot to become a shared platform: multi-generation support broadens the audience, team sharing enables community content, and multiplayer battles make it a destination rather than just a tool.

### Deliverables

#### Multi-Generation Support

Parameterize `Dex.forGen(N)` throughout the codebase instead of hardcoding Gen 9.

**Scope of changes:**
- `packages/pokemon-data/src/dex.service.ts` — all functions accept an optional `generation` parameter
- `packages/formats/src/format.service.ts` — format definitions include generation metadata
- `packages/damage-calc/` — `@smogon/calc` already supports multiple gens, needs plumbing
- `packages/smogon-data/` — usage stats fetched per generation
- `packages/data-pipeline/` — seeding supports multi-gen data
- Prisma schema: `Format.generation` already exists, ensure all queries filter by it
- UI: generation selector in format picker

**Target generations:**

| Generation | Era | Priority |
|------------|-----|----------|
| Gen 9 | Scarlet/Violet | Already supported |
| Gen 8 | Sword/Shield | High |
| Gen 7 | Sun/Moon | Medium |
| Gen 6 | X/Y | Medium |
| Gen 5 | Black/White | Low |
| Gen 4 | Diamond/Pearl | Low |
| Gen 3 | Ruby/Sapphire | Low |
| Gen 1-2 | RBY/GSC | Low |

**Minimum viable:** Gens 6-9 fully supported at launch.

#### Team Sharing

Enable users to share teams publicly and import teams from URLs.

**Features:**
- Public team URLs: `/teams/shared/[shareId]` with a read-only view
- Share button on team editor generates a shareable link
- Import from URL: paste a share link to clone the team into your account
- Team metadata for shared teams: author name, description, format, usage stats source
- Showdown paste import/export already exists — extend to support URL-based sharing

**Data model additions:**
- `Team.shareId` — nullable unique string for public access
- `Team.isPublic` — boolean flag
- `Team.description` — optional text field for shared teams
- `Team.authorName` — display name for attribution

**Community features (stretch):**
- Browse public teams by format
- Sort by creation date, popularity (view count), or rating
- Team ratings (upvote/downvote)

#### Multiplayer Battles

Real-time battles between two human players.

**Architecture options:**
- **WebSocket server:** dedicated battle server that mediates between two clients
- **P2P with WebRTC:** direct connection between browsers, server only for matchmaking
- **Hybrid:** WebSocket for matchmaking and state sync, battle logic runs server-side for anti-cheat

**Recommended approach:** WebSocket server (simplest, enables anti-cheat, battle engine already runs server-side).

**Features:**
- Lobby system: create a room, share a code, opponent joins
- Format selection and team validation before battle starts
- Real-time battle with the existing battle UI
- Battle chat (text messages between players)
- Rematch option
- Battle history: all multiplayer battles saved as replays

**Matchmaking (stretch):**
- Casual queue: match with any available opponent
- Format-specific queues
- Skill-based matching (requires rating system)

#### Tournament Mode

Structured competitive events.

**Tournament formats:**

| Format | Description |
|--------|-------------|
| Single Elimination | Lose once, you're out |
| Double Elimination | Two losses to eliminate |
| Swiss | Fixed rounds, pair by record |
| Round Robin | Everyone plays everyone |

**Features:**
- Tournament creation wizard: format, player count, bracket type
- Bracket visualization (interactive SVG or canvas)
- Auto-pairing for Swiss rounds
- Results tracking and standings
- Tournament replays: all games saved and browsable
- Tournament history page

**Data model:**
- `Tournament` — id, name, format, bracketType, status, createdAt
- `TournamentParticipant` — tournamentId, userId/name, teamId, seed
- `TournamentRound` — tournamentId, roundNumber
- `TournamentMatch` — roundId, player1Id, player2Id, winnerId, battleId

### Success Criteria

1. At least 4 generations (Gens 6-9) are fully supported with format definitions, legality checks, and usage data
2. Teams can be shared via URL and imported by other users
3. Two users can battle each other in real-time via WebSocket
4. At least one tournament format (single elimination) works end-to-end
5. Multiplayer battles are saved as replays and reviewable with M3 tools
6. Generation selector works throughout the UI without breaking existing Gen 9 functionality

### Dependencies

- M1 for foundational robustness (multi-gen needs solid format/validation infrastructure)
- M2 for team versioning (shared teams benefit from fork lineage)
- M3 for replay system (multiplayer battles use the same replay infrastructure)
- M4 for coaching (tournament coaching, multiplayer tips)

### Key New Files/Packages

| File/Path | Purpose |
|-----------|---------|
| `packages/battle-engine/src/multiplayer/` | Multiplayer battle server |
| `packages/battle-engine/src/multiplayer/lobby.service.ts` | Room creation, joining, matchmaking |
| `packages/battle-engine/src/multiplayer/ws-server.ts` | WebSocket server for real-time battles |
| `packages/battle-engine/src/multiplayer/anti-cheat.ts` | Server-side validation of moves |
| `packages/tournament/` | New package for tournament logic |
| `packages/tournament/src/bracket.service.ts` | Bracket generation and advancement |
| `packages/tournament/src/pairing.service.ts` | Swiss and round-robin pairing algorithms |
| `packages/tournament/src/tournament.service.ts` | Tournament CRUD and lifecycle |
| `apps/web/src/app/teams/shared/[shareId]/page.tsx` | Public team view |
| `apps/web/src/app/battle/multiplayer/page.tsx` | Multiplayer lobby |
| `apps/web/src/app/battle/multiplayer/[roomId]/page.tsx` | Active multiplayer battle |
| `apps/web/src/app/tournaments/page.tsx` | Tournament browser |
| `apps/web/src/app/tournaments/[id]/page.tsx` | Tournament bracket view |
| `apps/web/src/app/tournaments/new/page.tsx` | Tournament creation wizard |
| `apps/web/src/features/battle/components/BracketView.tsx` | Bracket visualization component |
| `apps/web/src/features/battle/components/BattleChat.tsx` | In-battle text chat |
| `prisma/migrations/YYYYMMDD_add_multiplayer/migration.sql` | Multiplayer and tournament tables |

---

## Cross-Cutting Concerns

These concerns span multiple milestones and should be addressed incrementally.

### Performance

| Concern | Milestone | Approach |
|---------|-----------|----------|
| MCTS computation blocking UI | M3 | Web Worker |
| Batch simulation speed | M2 | Worker threads, progress streaming |
| Large team lineage queries | M2 | Recursive CTE in Prisma, pagination |
| Real-time battle latency | M5 | WebSocket, server-side battle engine |
| Usage data queries | M1 | Database indexes, query optimization |

### Data Model Evolution

| Migration | Milestone | Changes |
|-----------|-----------|---------|
| Team versioning | M2 | `parentId` on Team, meta profile tables |
| Puzzles and drills | M3 | Puzzle, PuzzleAttempt, DrillSession tables |
| Coaching | M4 | ChatSession.type field, CoachingProgress table |
| Sharing | M5 | Team.shareId, Team.isPublic, Team.description |
| Multiplayer | M5 | Tournament, TournamentParticipant, TournamentMatch tables |

### Testing Strategy

| Phase | Focus | Target |
|-------|-------|--------|
| M1 | Unit tests for all packages | 80% coverage |
| M2 | Integration tests for version + simulation flows | Key user journeys |
| M3 | Battle engine accuracy tests | Move grading correctness |
| M4 | LLM output validation | Factual accuracy checks |
| M5 | E2E tests for multiplayer | Connection handling, state sync |

---

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| `@pkmn/sim` API changes break battle engine | High | Low | Pin versions, integration tests |
| LLM costs scale with battle commentary | Medium | High | Default OFF, token budgets, caching |
| WebSocket complexity for multiplayer | High | Medium | Start with lobby-code system, no matchmaking |
| Multi-gen scope creep | Medium | High | Prioritize Gens 6-9, defer older gens |
| Puzzle curation bottleneck | Medium | Medium | Auto-extraction from replays, community submissions |
| SQLite limitations at scale | High | Low | Acceptable for single-user, evaluate PostgreSQL for M5 |

---

## Appendix: Package Growth Projection

| Package | M1 | M2 | M3 | M4 | M5 |
|---------|----|----|----|----|-----|
| `core` | Types cleanup | Version types | Puzzle types | Coaching types | Tournament types |
| `teams` | Validation | version.service | — | — | Sharing |
| `formats` | Clause system | — | — | — | Multi-gen |
| `battle-engine` | Doubles | Batch sim UI | Review, puzzles, drills | Commentary hooks | Multiplayer |
| `llm` | — | Optimization suggestions | — | Coaching, meta briefings | — |
| `mcp-server` | — | — | — | +11 tools | — |
| `ui` | Error boundaries | Diff views | Grade badges | Coaching panel | Bracket view |
| `pokemon-data` | NatDex | — | — | — | Multi-gen |
| `tournament` | — | — | — | — | New package |
