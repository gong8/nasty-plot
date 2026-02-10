# Pokemon Game Solver - Feature Design Document

## Vision
A battle simulator + AI solver engine integrated into the Pokemon Team Builder app:
1. **Battle Simulator** - Full Pokemon battles powered by `@pkmn/sim`
2. **AI Opponents** - Tiered difficulty bots from random to MCTS-powered solver
3. **Strategic Hints** - Real-time move recommendations with win probability (like chess engine eval bar)
4. **Batch Simulation** - Run N games between teams, report win rates and analytics
5. **Team Testing** - Build a team, then battle it against real competitive teams to validate

## Design Decisions (Confirmed)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Formats | Singles + Doubles from start | @pkmn/sim handles both |
| Info modes | Full info + hidden info | Full for analysis, hidden for play |
| Build order | Full vertical slice (engine + UI + AI) | Complete playable experience first |
| Sprites | @pkmn/img | Same ecosystem as existing packages |
| Opponent teams | Real competitive teams + LLM archetype picker | Quality > randomness |
| Battle UI quality | Showdown-quality | Functional, sprite-based, clean |
| Multiplayer | AI only (to start) | No networking complexity |
| AI/Solver engine | Pure algorithmic (MCTS/heuristic) | Not LLM-dependent |
| LLM role | Optional commentary + strategy advisor (default off) | Preserve API credits |
| Eval function | Research-based (adapt Foul Play / Percymon) | Proven weights |

---

## Research Summary

### Battle Engine: `@pkmn/sim`
- Pokemon Showdown's simulator extracted as standalone TypeScript package
- Handles ALL battle mechanics (turn resolution, abilities, weather, hazards, 1000+ moves, 300+ abilities)
- Browser-compatible, same ecosystem as our `@pkmn/dex` and `@pkmn/data`
- `BattleStream` API for programmatic battles
- Alternative: `pkmn/engine` (Zig, 1000x faster) but only Gen 1-2 currently

### AI Landscape

| Project | Algorithm | Performance |
|---------|-----------|-------------|
| **Foul Play** | MCTS + DUCT (Rust engine) | 71-88% GXE |
| **Metamon** | Offline RL (80M transformer) | Top 10% of players |
| **MIT Thesis** | PPO + MCTS (neural guided) | Rank 8, 1693 Elo |
| **Technical Machine** | Expectiminimax + AB pruning | ~4 turns depth |
| **PokéChamp** | LLM-based minimax | Expert level |

**Key insight from Foul Play**: "Set prediction is as important as, if not more important than, accurate and fast search." We have Smogon data for this already!

### Position Evaluation Weights (from Percymon + research synthesis)

```
Factor                        | Weight | Notes
------------------------------|--------|------
HP remaining                  | 1024   | Most critical single factor
Pokemon alive count           | 512    | Non-linear (losing 6th < losing 3rd)
Fast Pokemon alive            | 512    | Speed tier control
Super-effective coverage      | 200    | Type advantage on active
Stealth Rock control          | 200    | Most impactful single hazard
Substitute up                 | 150    | Protection
Spikes layers                 | 150    | Diminishing per layer
Sleep/status inflicted        | 100-120| Long-term advantage
STAB availability             | 100    | Consistent damage output
Toxic Spikes                  | 100    | Passive damage
Reflect/Light Screen          | 64     | Damage reduction
Attack/SpA boosts             | 50     | Setup progress
Being faster                  | 50     | Turn order advantage
Sticky Web                    | 40     | Speed control
Defense boosts                | 25     | Survivability
```

### Opponent Team Generation Strategy
1. **Scrape real competitive teams** from Smogon forums/sample teams, store in DB
2. **Random selection** from stored teams for quick play
3. **LLM archetype picker** - "Give me a rain team to practice against"
4. **Import/paste** Showdown teams directly (already supported via existing paste parser)
5. **Pick from own teams** to test matchups between self-built teams

---

## Architecture

### Module Structure
```
src/modules/battle/
├── engine/                    # Battle simulation layer
│   ├── battle-manager.ts      # Orchestrates @pkmn/sim battles
│   ├── battle-state.ts        # Normalized battle state types
│   ├── battle-stream.ts       # BattleStream wrapper
│   └── team-packer.ts         # TeamSlotData → packed team format
├── ai/                        # AI opponent engine
│   ├── types.ts               # AI interface definitions
│   ├── random-ai.ts           # Random legal move selection
│   ├── greedy-ai.ts           # Max immediate damage
│   ├── heuristic-ai.ts        # Type matchups + switching + status
│   ├── mcts-ai.ts             # Monte Carlo Tree Search (DUCT)
│   ├── evaluator.ts           # Position evaluation function
│   └── set-predictor.ts       # Infer opponent sets from Smogon data
├── analysis/                  # Real-time analysis layer
│   ├── hint-engine.ts         # Move recommendations
│   ├── win-probability.ts     # Win % estimation
│   └── critical-turns.ts      # Game-deciding moment detection
├── simulation/                # Batch simulation
│   ├── batch-simulator.ts     # Run N games, collect stats
│   ├── matchup-matrix.ts      # Team A vs Team B results
│   └── worker.ts              # Web Worker for parallel sims
├── teams/                     # Opponent team management
│   ├── sample-teams.ts        # Scraper/importer for competitive teams
│   └── team-generator.ts      # Generate teams by archetype (LLM-assisted)
├── components/                # Battle UI components
│   ├── BattleView.tsx         # Main battle screen container
│   ├── BattleSetup.tsx        # Team/format/mode selection
│   ├── BattleField.tsx        # Active Pokemon display (singles + doubles)
│   ├── PokemonSprite.tsx      # Sprite rendering via @pkmn/img
│   ├── HealthBar.tsx          # Animated HP bar
│   ├── MoveSelector.tsx       # Move buttons with type colors + damage preview
│   ├── SwitchMenu.tsx         # Bench Pokemon switch interface
│   ├── TeamPreview.tsx        # Lead selection (6→1 singles, 6→4→2 VGC)
│   ├── BattleLog.tsx          # Turn-by-turn text log
│   ├── HintPanel.tsx          # AI move recommendations (optional sidebar)
│   ├── EvalBar.tsx            # Win probability bar (chess-style)
│   ├── FieldStatus.tsx        # Weather, terrain, hazards display
│   └── PostBattle.tsx         # Results, win probability graph, replay option
├── hooks/
│   ├── use-battle.ts          # Core battle state hook
│   ├── use-battle-ai.ts       # AI integration hook
│   └── use-battle-hints.ts    # Hint system hook
├── types/
│   └── index.ts               # All battle-related types
└── utils/
    └── protocol-parser.ts     # Parse @pkmn/sim protocol messages
```

### Battle Flow
```
1. SETUP (/battle/new)
   ├── Select YOUR team (from saved teams)
   ├── Select OPPONENT team:
   │   ├── Pick from saved teams
   │   ├── Pick from competitive sample teams
   │   ├── Generate by archetype (LLM)
   │   └── Import Showdown paste
   ├── Choose format (OU singles / VGC doubles / etc.)
   ├── Choose mode: Play (hidden info) | Analyze (full info)
   └── Choose AI difficulty: Random | Greedy | Smart | Expert

2. TEAM PREVIEW
   ├── Singles: Both teams shown, pick lead
   └── VGC: Both teams shown, pick 4 to bring, then 2 leads

3. BATTLE LOOP
   Each turn:
   ├── Display state (HP, status, field, weather, terrain)
   ├── [If hints ON] Show move recommendations + win %
   ├── Player selects action (move | switch | Tera)
   ├── AI selects action (based on difficulty)
   ├── @pkmn/sim resolves turn
   ├── Animate results (HP drain, status, messages)
   └── Check win condition (all fainted on one side)

4. POST-BATTLE
   ├── Winner announcement
   ├── Win probability graph over the whole game
   ├── Critical turn highlights
   ├── Option to replay / rematch
   └── Save battle for later review
```

### State Management
- Battle state in **React context** (not React Query - this is real-time, not API-cached)
- Persist completed battles to Prisma/SQLite for replay
- Web Workers for MCTS computation (non-blocking)

### New Database Models
```prisma
model Battle {
  id          String   @id @default(cuid())
  formatId    String
  mode        String   // "play" | "analyze"
  aiDifficulty String? // "random" | "greedy" | "smart" | "expert"
  team1Id     String   // Player's team
  team2Id     String?  // Opponent's team (null if generated)
  team2Paste  String?  // Showdown paste if not from DB
  winnerId    String?  // "team1" | "team2" | "draw"
  log         String   // Full @pkmn/sim protocol log (JSON)
  turnCount   Int
  createdAt   DateTime @default(now())

  team1       Team     @relation("PlayerTeam", fields: [team1Id], references: [id])
  team2       Team?    @relation("OpponentTeam", fields: [team2Id], references: [id])
  turns       BattleTurn[]
}

model BattleTurn {
  id          String   @id @default(cuid())
  battleId    String
  turnNumber  Int
  team1Action String   // JSON: {type: "move"|"switch", details}
  team2Action String
  stateAfter  String   // JSON: snapshot of state after resolution
  winProb     Float?   // Win probability at this point

  battle      Battle   @relation(fields: [battleId], references: [id])
}

model SampleTeam {
  id          String   @id @default(cuid())
  name        String
  formatId    String
  archetype   String?  // "rain", "hyper offense", "stall", "balance", etc.
  source      String?  // "smogon forums", "tournament", etc.
  paste       String   // Showdown paste format
  createdAt   DateTime @default(now())
}
```

### New Routes
```
/battle          - Battle hub (list recent battles, start new)
/battle/new      - Battle setup
/battle/[id]     - Active battle or replay
/battle/simulate - Batch simulation setup + results
```

---

## Implementation Phases (Vertical Slice Approach)

### Phase 1: Engine Foundation (Week 1-2)
**Goal**: Battles work programmatically with tests, no UI yet.

- [ ] Install `@pkmn/sim` and `@pkmn/img`
- [ ] Build `BattleManager` class wrapping BattleStream
- [ ] Build `team-packer.ts` converting `TeamSlotData` → packed format
- [ ] Build `protocol-parser.ts` to normalize @pkmn/sim messages into typed state
- [ ] Build `battle-state.ts` with full typed battle state interface
- [ ] Support singles and doubles battle creation
- [ ] Handle full battle lifecycle: create → preview → turns → end
- [ ] Write comprehensive unit tests with Vitest

### Phase 2: Battle UI (Week 2-4)
**Goal**: Playable battles in the browser (manual control of both sides).

- [ ] `/battle/new` setup page with team/format/mode selectors
- [ ] `TeamPreview` component (singles lead pick + VGC 4-pick-2-lead)
- [ ] `BattleField` component with sprites (@pkmn/img), HP bars, status icons
- [ ] `MoveSelector` with type-colored buttons and damage preview (from @smogon/calc)
- [ ] `SwitchMenu` showing bench Pokemon with HP
- [ ] `BattleLog` with turn-by-turn text
- [ ] `FieldStatus` showing weather, terrain, hazards, screens
- [ ] HP drain animations (CSS transitions)
- [ ] Doubles layout (2v2 active Pokemon)
- [ ] `use-battle` hook managing state + @pkmn/sim interaction

### Phase 3: AI Opponents (Week 4-5)
**Goal**: Play against bots of varying difficulty.

- [ ] Define `AIPlayer` interface: `chooseAction(state, legalMoves) → Action`
- [ ] `RandomAI` - uniform random from legal moves
- [ ] `GreedyAI` - pick highest damage move using @smogon/calc
- [ ] `HeuristicAI` - type matchups, switching on bad matchups, status moves
- [ ] AI difficulty selector in battle setup
- [ ] AI thinking delay (so it doesn't feel instant)
- [ ] `SetPredictor` using Smogon data (for hidden info mode)

### Phase 4: Hint System + Evaluation (Week 5-6)
**Goal**: Chess-engine-style analysis during play.

- [ ] `evaluator.ts` position evaluation function (research-based weights)
- [ ] `win-probability.ts` estimating win % from position
- [ ] `hint-engine.ts` evaluating all legal moves and ranking them
- [ ] `EvalBar` component (win probability bar, swings per turn)
- [ ] `HintPanel` showing recommended moves with explanations
- [ ] Damage calc preview per move option
- [ ] Toggle hints on/off (default off for "fair" play)

### Phase 5: MCTS Solver (Week 6-8)
**Goal**: Expert-level AI using Monte Carlo Tree Search.

- [ ] Basic MCTS implementation with UCB1 selection
- [ ] DUCT variant for simultaneous move selection
- [ ] Damage roll grouping (KO vs no-KO) to reduce branching
- [ ] Heuristic evaluator for leaf nodes
- [ ] Web Worker integration for non-blocking search
- [ ] Configurable search depth/time
- [ ] "Expert" difficulty using MCTS

### Phase 6: Sample Teams + Generation (Week 8-9)
**Goal**: High-quality opponent teams from real competitive data.

- [ ] `SampleTeam` database model + API routes
- [ ] Scraper/importer for Smogon sample teams
- [ ] Archetype tagging (rain, HO, stall, balance, trick room, etc.)
- [ ] Random team picker from stored samples
- [ ] LLM archetype picker: "give me a rain team"
- [ ] Seed script to populate initial competitive teams

### Phase 7: Batch Simulation + Analytics (Week 9-11)
**Goal**: Run N games between teams and analyze results.

- [ ] `batch-simulator.ts` running automated AI-vs-AI games
- [ ] Web Worker pool for parallel simulation
- [ ] Win rate calculation with confidence intervals
- [ ] Matchup matrix: which individual Pokemon matchups decide games
- [ ] Critical turn detection (where win probability swung >20%)
- [ ] Win probability graph over time (per game and averaged)
- [ ] `/battle/simulate` page with results dashboard
- [ ] Charts (could use existing charting or add recharts/chart.js)

### Phase 8: Post-Battle + Replay (Week 11-12)
**Goal**: Review and learn from completed battles.

- [ ] Save battles to database (Battle + BattleTurn models)
- [ ] Post-battle summary screen
- [ ] Replay viewer (step through turns with engine analysis)
- [ ] Win probability graph overlay on replay
- [ ] "What if?" mode - change a decision and see alternate outcome
- [ ] Recent battles list on `/battle`

### Phase 9: LLM Integration (Week 12-13)
**Goal**: Optional AI commentary and strategic advice.

- [ ] Battle commentary tool for existing OpenAI integration
- [ ] Real-time narration: "Great switch! Toxapex walls Dragapult completely."
- [ ] Strategic explanations: "You should switch because..."
- [ ] Post-battle analysis summary (LLM reads the battle log)
- [ ] Default OFF, toggle in settings (preserves API credits)

### Phase 10: Polish + Advanced (Week 13+)
- [ ] Tournament mode (round-robin)
- [ ] Training mode (specific scenarios)
- [ ] MCP server tools for battle (run battles via Claude)
- [ ] Import Showdown replays
- [ ] Move animations beyond HP drain
- [ ] Sound effects (optional)
- [ ] Mobile-responsive battle UI

---

## Dependencies to Add
```json
{
  "@pkmn/sim": "latest",
  "@pkmn/img": "latest",
  "@pkmn/randoms": "latest"
}
```

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| @pkmn/sim API complexity | High | Build abstraction layer early, comprehensive tests |
| Battle UI polish takes too long | Medium | Start functional, polish iteratively |
| MCTS performance in browser | Medium | Web Workers, configurable depth, fallback to heuristic |
| Doubles complexity | Medium | Singles-first in UI, doubles reuses same engine |
| State sync between sim and UI | High | Strong typed protocol parser, unit tests |
| @pkmn/sim breaking changes | Low | Pin versions, monitor releases |
