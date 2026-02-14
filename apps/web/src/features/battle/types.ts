import type { GameType } from "@nasty-plot/core"
import type { AIDifficulty, BattleMode } from "@nasty-plot/battle-engine"

export interface BattleSummary {
  id: string
  formatId: string
  gameType: GameType
  mode: BattleMode
  aiDifficulty: AIDifficulty | null
  team1Name: string
  team2Name: string
  team1Id: string | null
  team2Id: string | null
  batchId: string | null
  winnerId: string | null
  turnCount: number
  createdAt: string
}

export interface TeamValidation {
  valid: boolean
  pokemonCount: number
  errors: string[]
}
