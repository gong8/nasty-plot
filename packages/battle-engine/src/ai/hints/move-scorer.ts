import { getRawMove } from "@nasty-plot/pokemon-data"
import { getTypeEffectiveness, type PokemonType } from "@nasty-plot/core"
import type { BattleActionSet, BattlePokemon, DexMove, SideConditions } from "../../types"
import { calculateBattleDamage, getSpeciesTypes } from "../shared"
import {
  HAZARD_SCORES,
  STATUS_INFLICTION_SCORES,
  SETUP_MOVE_SCORE,
  RECOVERY_SCORES,
  HAZARD_REMOVAL_BASE,
  HAZARD_REMOVAL_PER_HAZARD,
} from "../shared"
import {
  GUARANTEED_KO_BONUS,
  PARTIAL_KO_BASE,
  PARTIAL_KO_SCALING,
  PRIORITY_BONUS,
  LOW_HP_THRESHOLD,
  STAB_BONUS,
  TYPE_EFFECTIVENESS_FALLBACK_MULTIPLIER,
  DEFAULT_STATUS_INFLICTION_SCORE,
  SETUP_HP_THRESHOLD,
  SETUP_LOW_HP_SCORE,
  GENERIC_STATUS_MOVE_SCORE,
  NO_HAZARDS_REMOVAL_SCORE,
  STATUS_MOVE_IDS,
  SETUP_MOVE_IDS,
  RECOVERY_MOVE_IDS,
  HAZARD_REMOVAL_IDS,
  LAYERED_HAZARDS,
  SINGLE_HAZARDS,
} from "./hint-constants"
import type { ScoredAction } from "./hint-types"

type HazardKey = keyof typeof HAZARD_SCORES
type StatusKey = keyof typeof STATUS_INFLICTION_SCORES

function countHazards(sc: {
  stealthRock: boolean
  spikes: number
  toxicSpikes: number
  stickyWeb: boolean
}): number {
  return (sc.stealthRock ? 1 : 0) + sc.spikes + sc.toxicSpikes + (sc.stickyWeb ? 1 : 0)
}

function scoreHazardMove(
  moveId: string,
  oppSideConditions: SideConditions,
  mySideConditions: SideConditions,
): { score: number; explanation: string } | null {
  const singleHazard = SINGLE_HAZARDS[moveId]
  if (singleHazard) {
    if (oppSideConditions[singleHazard.key]) {
      return { score: 0, explanation: `${singleHazard.label} already up` }
    }
    return { score: HAZARD_SCORES[moveId as HazardKey], explanation: `Sets ${singleHazard.label}` }
  }

  const layeredHazard = LAYERED_HAZARDS[moveId]
  if (layeredHazard) {
    const currentLayers = oppSideConditions[layeredHazard.key]
    if (currentLayers >= layeredHazard.max) {
      return { score: 0, explanation: `Max ${layeredHazard.label} layers` }
    }
    return {
      score: HAZARD_SCORES[moveId as HazardKey],
      explanation: `Sets ${layeredHazard.label} layer ${currentLayers + 1}`,
    }
  }

  if (HAZARD_REMOVAL_IDS.has(moveId)) {
    const hazardCount = countHazards(mySideConditions)
    if (hazardCount === 0) {
      return { score: NO_HAZARDS_REMOVAL_SCORE, explanation: "No hazards to remove" }
    }
    return {
      score: HAZARD_REMOVAL_BASE + hazardCount * HAZARD_REMOVAL_PER_HAZARD,
      explanation: `Removes ${hazardCount} hazard(s)`,
    }
  }

  return null
}

function estimateStatusMoveScore(
  moveData: DexMove,
  myActive: BattlePokemon,
  oppActive: BattlePokemon,
  oppSideConditions: SideConditions,
  mySideConditions: SideConditions,
): { score: number; explanation: string } {
  const { id } = moveData

  const hazardResult = scoreHazardMove(id, oppSideConditions, mySideConditions)
  if (hazardResult) return hazardResult

  if (STATUS_MOVE_IDS.has(id)) {
    if (oppActive.status) {
      return { score: 0, explanation: "Opponent already statused" }
    }
    const score = STATUS_INFLICTION_SCORES[id as StatusKey] || DEFAULT_STATUS_INFLICTION_SCORE
    return { score, explanation: "Inflicts status on opponent" }
  }

  if (SETUP_MOVE_IDS.has(id)) {
    return myActive.hpPercent > SETUP_HP_THRESHOLD
      ? { score: SETUP_MOVE_SCORE, explanation: "Boosts stats (good HP)" }
      : { score: SETUP_LOW_HP_SCORE, explanation: "Boosts stats (low HP risk)" }
  }

  if (RECOVERY_MOVE_IDS.has(id)) {
    if (myActive.hpPercent < 50) {
      return { score: RECOVERY_SCORES.low, explanation: "Recover HP (low)" }
    }
    if (myActive.hpPercent < 75) {
      return { score: RECOVERY_SCORES.moderate, explanation: "Recover HP (moderate)" }
    }
    return { score: RECOVERY_SCORES.nearFull, explanation: "Already near full HP" }
  }

  return { score: GENERIC_STATUS_MOVE_SCORE, explanation: "Status move" }
}

export function estimateMoveScore(
  move: BattleActionSet["moves"][0],
  myActive: BattlePokemon,
  oppActive: BattlePokemon,
  oppSideConditions: SideConditions,
  mySideConditions: SideConditions,
): { score: number; explanation: string } {
  const moveData = getRawMove(move.name)
  if (!moveData?.exists) {
    return { score: 0, explanation: "Unknown move" }
  }

  if (moveData.category === "Status") {
    return estimateStatusMoveScore(
      moveData,
      myActive,
      oppActive,
      oppSideConditions,
      mySideConditions,
    )
  }

  try {
    const { minPercent, maxPercent } = calculateBattleDamage(myActive, oppActive, move.name)
    const avgPercent = (minPercent + maxPercent) / 2

    let score = avgPercent
    let explanation = `~${Math.round(avgPercent)}% damage`

    if (minPercent >= oppActive.hpPercent) {
      score += GUARANTEED_KO_BONUS
      explanation = "Guaranteed KO!"
    } else if (maxPercent >= oppActive.hpPercent) {
      const range = maxPercent - minPercent
      const koChance = range > 0 ? (maxPercent - oppActive.hpPercent) / range : 0.5
      score += PARTIAL_KO_BASE + koChance * PARTIAL_KO_SCALING
      explanation = `${Math.round(koChance * 100)}% chance to KO`
    }

    if (moveData.priority > 0 && oppActive.hpPercent < LOW_HP_THRESHOLD) {
      score += PRIORITY_BONUS
      explanation += " (priority)"
    }

    const myTypes = getSpeciesTypes(myActive.name)
    if (myTypes.includes(moveData.type as never)) {
      score += STAB_BONUS
    }

    return { score, explanation }
  } catch {
    const oppTypes = getSpeciesTypes(oppActive.name)
    const eff = getTypeEffectiveness(moveData.type as PokemonType, oppTypes)
    const score = eff * TYPE_EFFECTIVENESS_FALLBACK_MULTIPLIER
    return { score, explanation: `Type effectiveness: ${eff}x` }
  }
}

export function scoreMoveAgainstBestTarget(
  move: BattleActionSet["moves"][0],
  moveIndex: number,
  myActive: BattlePokemon,
  oppActives: BattlePokemon[],
  oppSideConditions: SideConditions,
  mySideConditions: SideConditions,
): ScoredAction {
  let bestScore = -Infinity
  let bestExplanation = ""
  let bestTargetSlot = 1

  for (let targetIdx = 0; targetIdx < oppActives.length; targetIdx++) {
    const target = oppActives[targetIdx]
    const { score, explanation } = estimateMoveScore(
      move,
      myActive,
      target,
      oppSideConditions,
      mySideConditions,
    )
    if (score > bestScore) {
      bestScore = score
      bestExplanation = `${explanation} (-> ${target.name})`
      bestTargetSlot = targetIdx + 1
    }
  }

  return {
    action: { type: "move", moveIndex, targetSlot: bestTargetSlot },
    name: move.name,
    score: bestScore,
    explanation: bestExplanation,
  }
}
