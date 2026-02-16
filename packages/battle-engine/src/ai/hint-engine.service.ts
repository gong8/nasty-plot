import type { BattleState, BattleActionSet, BattlePokemon } from "../types"
import { evaluatePosition } from "./evaluator.service"
import { CLASSIFICATION_GAP } from "./hints/hint-constants"
import type { MoveClassification, MoveHint, HintResult, ScoredAction } from "./hints/hint-types"
import { estimateMoveScore, scoreMoveAgainstBestTarget } from "./hints/move-scorer"
import { estimateSwitchScore } from "./hints/switch-scorer"

export type { MoveClassification, MoveHint, HintResult }

function classifyGap(gap: number): MoveClassification {
  if (gap <= 0) return "best"
  if (gap <= CLASSIFICATION_GAP.GOOD) return "good"
  if (gap <= CLASSIFICATION_GAP.NEUTRAL) return "neutral"
  if (gap <= CLASSIFICATION_GAP.INACCURACY) return "inaccuracy"
  if (gap <= CLASSIFICATION_GAP.MISTAKE) return "mistake"
  return "blunder"
}

/**
 * Generate hints for all legal actions at the current battle state.
 * Ranks moves by estimated value and classifies them relative to the best option.
 *
 * In doubles, pass `activeSlot` (0 or 1) to evaluate against the correct opponent slot(s).
 */
export function generateHints(
  state: BattleState,
  actions: BattleActionSet,
  perspective: "p1" | "p2" = "p1",
  activeSlot = 0,
): HintResult {
  const currentEval = evaluatePosition(state, perspective)
  const scored: ScoredAction[] = []

  const oppSideKey = perspective === "p1" ? "p2" : "p1"
  const mySide = state.sides[perspective]
  const oppSide = state.sides[oppSideKey]
  const myActive = mySide.active[activeSlot]
  const isDoubles = state.gameType === "doubles"

  const oppActives = oppSide.active.filter((p): p is BattlePokemon => p != null && !p.fainted)
  const oppActive = oppActives[0] ?? null

  // Score moves
  if (myActive && oppActive) {
    const hasMultipleTargets = isDoubles && oppActives.length > 1
    for (let i = 0; i < actions.moves.length; i++) {
      const move = actions.moves[i]
      if (move.disabled) continue

      const moveIndex = i + 1
      if (hasMultipleTargets) {
        scored.push(
          scoreMoveAgainstBestTarget(
            move,
            moveIndex,
            myActive,
            oppActives,
            oppSide.sideConditions,
            mySide.sideConditions,
          ),
        )
      } else {
        const { score, explanation } = estimateMoveScore(
          move,
          myActive,
          oppActive,
          oppSide.sideConditions,
          mySide.sideConditions,
        )
        scored.push({ action: { type: "move", moveIndex }, name: move.name, score, explanation })
      }
    }
  }

  // Score switches
  for (const sw of actions.switches) {
    if (sw.fainted) continue
    const { score, explanation } = estimateSwitchScore(sw, mySide, oppSide)
    scored.push({
      action: { type: "switch", pokemonIndex: sw.index },
      name: `Switch to ${sw.name}`,
      score,
      explanation,
    })
  }

  scored.sort((a, b) => b.score - a.score)

  const bestScore = scored.length > 0 ? scored[0].score : 0

  const rankedMoves: MoveHint[] = scored.map((s, idx) => ({
    ...s,
    rank: idx + 1,
    classification: classifyGap(bestScore - s.score),
  }))

  return {
    rankedMoves,
    currentEval,
    bestAction: scored.length > 0 ? scored[0].action : { type: "move", moveIndex: 1 },
  }
}
