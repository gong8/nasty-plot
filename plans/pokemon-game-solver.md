# Pokemon Game Solver - Feature Design Notes

## Vision
A battle simulator + AI solver engine that lets users:
1. Simulate full Pokemon battles between teams
2. Get real-time strategic hints (like a chess engine evaluation)
3. Play against an AI bot
4. Run automated team-vs-team simulations for team evaluation
5. Analyze optimal play sequences

## Why This Is Hard (and Cool)
Pokemon battles are **imperfect information, stochastic** games:
- You can't see opponent's full team, EVs, items, or movesets upfront
- Damage rolls are random (85-100% multiplier)
- Critical hits, accuracy, secondary effects add variance
- This makes Pokemon more like **poker** than chess
- Optimal play requires probabilistic reasoning over hidden information

## Existing Foundation
- `@pkmn/dex` + `@pkmn/data` - Full Pokemon database
- `@smogon/calc` - Damage calculation engine
- Type effectiveness, coverage, threat analysis already built
- Smogon sets/usage/checks-counters data in database
- Team builder with full competitive configuration
- Showdown paste import/export
- OpenAI chat integration

## Key Technical Decision: Battle Engine
**`@pkmn/sim`** - Pokemon Showdown's battle simulator as a standalone package.
- Handles ALL battle mechanics (turn resolution, abilities, weather, hazards, etc.)
- Used by the actual Pokemon Showdown ladder
- Maintained by the @pkmn community
- Avoids reimplementing 1000+ moves and 300+ abilities
- TypeScript, same ecosystem as our existing @pkmn packages

## Feature Tiers

### Tier 1: Battle Simulator (Foundation)
- Integrate `@pkmn/sim` as battle engine
- Battle state management (active Pokemon, HP, status, field conditions)
- Turn execution (move selection, switching, item use)
- Battle UI (HP bars, move buttons, team preview, battle log)
- Team vs Team setup (pick two teams or one team vs imported opponent)
- Basic battle flow (team preview → lead selection → turns → win/loss)

### Tier 2: AI Opponent / Bot
- Implement battle AI that can pilot a team
- AI difficulty levels:
  - Random: picks moves randomly
  - Greedy: picks highest immediate damage
  - Smart: considers type matchups, switching, status
  - Expert: uses search tree / probabilistic reasoning
- Use Smogon usage data to infer likely opponent sets
- Use checks/counters data to inform switching decisions

### Tier 3: Hint System / Active Analysis
- Real-time move recommendations during battle
- "Engine evaluation" bar showing win probability
- Explanation of WHY a move is recommended
- Show damage calc previews for each option
- Threat assessment for current board state
- "If you do X, opponent likely does Y" decision tree visualization

### Tier 4: Game Solver / Simulation Engine
- Monte Carlo Tree Search (MCTS) or Expectimax for optimal play
- Batch simulation: run N games between two teams, report win rates
- Identify which team matchups are favorable/unfavorable
- Find the "critical turns" where games are won/lost
- EV/move optimization: which spread maximizes win rate?

### Tier 5: Advanced Features
- Play against Showdown-style AI with different team archetypes
- Tournament simulation (round-robin between multiple teams)
- Replay viewer with engine analysis overlay
- Training mode: practice against specific threats
- LLM integration: explain battle decisions in natural language

## Architecture Questions (To Resolve)

### Information Model
- How much does the player know about the opponent?
  - Full information mode (practice/analysis): see everything
  - Competitive mode: only see what's been revealed
  - Inferred mode: use Smogon data to predict likely sets

### AI Approach
- **Expectimax**: handles randomness well, but exponential branching
- **Monte Carlo Tree Search (MCTS)**: samples random outcomes, scales better
- **Heuristic evaluation**: fast but less accurate
- **LLM-based reasoning**: use GPT/Claude to reason about positions
- **Hybrid**: heuristic for most decisions, deep search for critical turns

### Performance
- Battle simulation: likely fine client-side (JS is fast enough)
- AI search: may need server-side for deeper searches
- Batch simulations: definitely server-side, possibly with workers
- Could use Web Workers for client-side parallelism

### UI/UX
- Split screen? Side panel? Full page?
- How to show the decision tree / evaluation?
- Mobile support needed?
- Real-time vs turn-by-turn display?

---

## Open Questions for Discussion
(See conversation for detailed Q&A)
