# @nasty-plot/battle-engine

Battle simulator built on `@pkmn/sim` with protocol parsing, AI players at multiple difficulty levels, replay support, and batch simulation.

## Key Exports

- **Battle Manager** -- `BattleManager` class for running interactive battles
- **AI Players** -- `RandomAI`, `GreedyAI`, `HeuristicAI`, `MCTSAI` (difficulty levels)
- **Protocol Parser** -- `processLine()`, `processChunk()`, `parseRequest()`
- **State Serializer** -- `serializeBattleState()`, `formatMoveStats()`, `formatFieldState()`
- **Evaluation** -- `evaluatePosition()`, `estimateWinProbability()`, `generateHints()`
- **Replay** -- `ReplayEngine`, `parseReplayUrl()`, `importFromReplayUrl()`, `importFromRawLog()`
- **Simulation** -- `runAutomatedBattle()`, `runBatchSimulation()`
- **Team Packing** -- `packTeam()`, `unpackTeam()` for `@pkmn/sim` format
- **Types** -- `BattleState`, `BattleSide`, `AIDifficulty`, `BattlePhase`

## Dependencies

- `@nasty-plot/core`, `@nasty-plot/db`, `@nasty-plot/damage-calc`, `@nasty-plot/pokemon-data`
- `@pkmn/sim`, `@smogon/calc`

## Usage

```typescript
import { BattleManager, HeuristicAI } from "@nasty-plot/battle-engine"

const battle = new BattleManager({ formatId: "gen9ou", gameType: "singles" })
await battle.start(team1Paste, team2Paste, { p2ai: new HeuristicAI() })
```
