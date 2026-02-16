import type { BattleAction } from "../../types"
import type { EvalResult } from "../evaluator.service"

export type MoveClassification = "best" | "good" | "neutral" | "inaccuracy" | "mistake" | "blunder"

export interface MoveHint {
  action: BattleAction
  name: string
  score: number
  rank: number
  classification: MoveClassification
  explanation: string
}

export interface HintResult {
  rankedMoves: MoveHint[]
  currentEval: EvalResult
  bestAction: BattleAction
}

/** Intermediate scored action before classification is applied. */
export interface ScoredAction {
  action: BattleAction
  name: string
  score: number
  explanation: string
}
