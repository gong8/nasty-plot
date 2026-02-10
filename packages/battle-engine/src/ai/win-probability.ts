import type { BattleState } from "../types"
import { evaluatePosition, type EvalResult } from "./evaluator"

export interface WinProbability {
  /** p1 win percentage [0, 100] */
  p1: number
  /** p2 win percentage [0, 100] */
  p2: number
  /** Underlying evaluation result */
  evaluation: EvalResult
}

/**
 * Map evaluator score [-1, +1] to win probability [0, 100].
 * Uses a slight S-curve: 50 + 50 * sign(s) * |s|^0.85
 */
function scoreToProbability(score: number): number {
  const sign = score >= 0 ? 1 : -1
  return 50 + 50 * sign * Math.pow(Math.abs(score), 0.85)
}

/**
 * Estimate win probability for both sides based on position evaluation.
 */
export function estimateWinProbability(state: BattleState): WinProbability {
  // Handle terminal states
  if (state.phase === "ended") {
    if (state.winner === "p1") {
      return {
        p1: 100,
        p2: 0,
        evaluation: { score: 1, rawScore: 10000, features: [] },
      }
    }
    if (state.winner === "p2") {
      return {
        p1: 0,
        p2: 100,
        evaluation: { score: -1, rawScore: -10000, features: [] },
      }
    }
    // Draw
    return {
      p1: 50,
      p2: 50,
      evaluation: { score: 0, rawScore: 0, features: [] },
    }
  }

  const evaluation = evaluatePosition(state, "p1")
  const p1Prob = scoreToProbability(evaluation.score)

  return {
    p1: Math.round(p1Prob * 10) / 10,
    p2: Math.round((100 - p1Prob) * 10) / 10,
    evaluation,
  }
}

/**
 * Calculate the change in win probability between two states.
 * Useful for identifying critical turns (>20% swing).
 */
export function winProbabilityDelta(
  before: BattleState,
  after: BattleState,
): { delta: number; isCritical: boolean } {
  const probBefore = estimateWinProbability(before)
  const probAfter = estimateWinProbability(after)
  const delta = probAfter.p1 - probBefore.p1
  return {
    delta,
    isCritical: Math.abs(delta) >= 20,
  }
}
