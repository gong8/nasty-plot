import { getRawMove } from "@nasty-plot/pokemon-data"
import { getTypeEffectiveness } from "@nasty-plot/core"
import type { BattleState, BattleActionSet, BattleAction, BattlePokemon, DexMove } from "../types"
import { evaluatePosition, type EvalResult } from "./evaluator.service"
import {
  calculateBattleDamage,
  getSpeciesTypes,
  HAZARD_SCORES,
  STATUS_INFLICTION_SCORES,
  SETUP_MOVE_SCORE,
  RECOVERY_SCORES,
  HAZARD_REMOVAL_BASE,
  HAZARD_REMOVAL_PER_HAZARD,
} from "./shared"

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

const GUARANTEED_KO_BONUS = 80
const PARTIAL_KO_BASE = 40
const PARTIAL_KO_SCALING = 40
const PRIORITY_BONUS = 20
const LOW_HP_THRESHOLD = 30
const STAB_BONUS = 5

const SWITCH_SCORES = {
  RESIST_BONUS: 15,
  IMMUNITY_BONUS: 25,
  SE_COVERAGE_BONUS: 10,
  STEALTH_ROCK_PENALTY: 10,
  SPIKES_PENALTY_PER_LAYER: 5,
  STICKY_WEB_PENALTY: 5,
} as const

const STATUS_MOVE_IDS = new Set([
  "toxic",
  "willowisp",
  "thunderwave",
  "spore",
  "sleeppowder",
  "yawn",
])

const SETUP_MOVE_IDS = new Set([
  "swordsdance",
  "nastyplot",
  "calmmind",
  "dragondance",
  "irondefense",
  "amnesia",
  "shellsmash",
])

const RECOVERY_MOVE_IDS = new Set([
  "recover",
  "roost",
  "softboiled",
  "moonlight",
  "synthesis",
  "shoreup",
  "slackoff",
])

const HAZARD_REMOVAL_IDS = new Set(["defog", "rapidspin"])

/** Layered hazards: move ID -> side condition key and max layers */
const LAYERED_HAZARDS: Record<
  string,
  { key: "spikes" | "toxicSpikes"; max: number; label: string }
> = {
  spikes: { key: "spikes", max: 3, label: "Spikes" },
  toxicspikes: { key: "toxicSpikes", max: 2, label: "Toxic Spikes" },
}

/** Single-layer hazards: move ID -> side condition key */
const SINGLE_HAZARDS: Record<string, { key: "stealthRock" | "stickyWeb"; label: string }> = {
  stealthrock: { key: "stealthRock", label: "Stealth Rock" },
  stickyweb: { key: "stickyWeb", label: "Sticky Web" },
}

function classifyGap(gap: number): MoveClassification {
  if (gap <= 0) return "best"
  if (gap <= 5) return "good"
  if (gap <= 15) return "neutral"
  if (gap <= 30) return "inaccuracy"
  if (gap <= 60) return "mistake"
  return "blunder"
}

function estimateMoveScore(
  move: BattleActionSet["moves"][0],
  myActive: BattlePokemon,
  oppActive: BattlePokemon,
  state: BattleState,
): { score: number; explanation: string } {
  const moveData = getRawMove(move.name)
  if (!moveData?.exists) {
    return { score: 0, explanation: "Unknown move" }
  }

  if (moveData.category === "Status") {
    return estimateStatusMoveScore(moveData, myActive, oppActive, state)
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
    const eff = getTypeEffectiveness(moveData.type, oppTypes as string[])
    const score = eff * 20
    return { score, explanation: `Type effectiveness: ${eff}x` }
  }
}

function countHazards(sc: {
  stealthRock: boolean
  spikes: number
  toxicSpikes: number
  stickyWeb: boolean
}): number {
  return (sc.stealthRock ? 1 : 0) + sc.spikes + sc.toxicSpikes + (sc.stickyWeb ? 1 : 0)
}

type HazardKey = keyof typeof HAZARD_SCORES
type StatusKey = keyof typeof STATUS_INFLICTION_SCORES

function estimateStatusMoveScore(
  moveData: DexMove,
  myActive: BattlePokemon,
  oppActive: BattlePokemon,
  state: BattleState,
): { score: number; explanation: string } {
  const { id } = moveData
  const oppSC = state.sides.p2.sideConditions

  const singleHazard = SINGLE_HAZARDS[id]
  if (singleHazard) {
    if (oppSC[singleHazard.key]) {
      return { score: 0, explanation: `${singleHazard.label} already up` }
    }
    return {
      score: HAZARD_SCORES[id as HazardKey],
      explanation: `Sets ${singleHazard.label}`,
    }
  }

  const layeredHazard = LAYERED_HAZARDS[id]
  if (layeredHazard) {
    const currentLayers = oppSC[layeredHazard.key]
    if (currentLayers >= layeredHazard.max) {
      return { score: 0, explanation: `Max ${layeredHazard.label} layers` }
    }
    return {
      score: HAZARD_SCORES[id as HazardKey],
      explanation: `Sets ${layeredHazard.label} layer ${currentLayers + 1}`,
    }
  }

  if (HAZARD_REMOVAL_IDS.has(id)) {
    const hazardCount = countHazards(state.sides.p1.sideConditions)
    if (hazardCount === 0) {
      return { score: 2, explanation: "No hazards to remove" }
    }
    return {
      score: HAZARD_REMOVAL_BASE + hazardCount * HAZARD_REMOVAL_PER_HAZARD,
      explanation: `Removes ${hazardCount} hazard(s)`,
    }
  }

  if (STATUS_MOVE_IDS.has(id)) {
    if (oppActive.status) {
      return { score: 0, explanation: "Opponent already statused" }
    }
    const score = STATUS_INFLICTION_SCORES[id as StatusKey] || 20
    return { score, explanation: "Inflicts status on opponent" }
  }

  if (SETUP_MOVE_IDS.has(id)) {
    return myActive.hpPercent > 60
      ? { score: SETUP_MOVE_SCORE, explanation: "Boosts stats (good HP)" }
      : { score: 10, explanation: "Boosts stats (low HP risk)" }
  }

  if (RECOVERY_MOVE_IDS.has(id)) {
    if (myActive.hpPercent < 50) {
      return { score: RECOVERY_SCORES.low, explanation: "Recover HP (low)" }
    }
    if (myActive.hpPercent < 75) {
      return {
        score: RECOVERY_SCORES.moderate,
        explanation: "Recover HP (moderate)",
      }
    }
    return {
      score: RECOVERY_SCORES.nearFull,
      explanation: "Already near full HP",
    }
  }

  return { score: 5, explanation: "Status move" }
}

function estimateSwitchScore(
  switchOption: BattleActionSet["switches"][0],
  state: BattleState,
): { score: number; explanation: string } {
  const oppActive = state.sides.p2.active[0]
  if (!oppActive) return { score: 10, explanation: "Switch out" }

  const switchPokemon = state.sides.p1.team.find(
    (p) => p.name === switchOption.name || p.pokemonId === switchOption.pokemonId,
  )
  if (!switchPokemon) return { score: 5, explanation: "Switch to unknown" }

  let score = 0
  const oppTypes = getSpeciesTypes(oppActive.name)
  const swTypes = getSpeciesTypes(switchPokemon.name)

  // Defensive: does the switch-in resist opponent's STAB?
  for (const t of oppTypes) {
    const eff = getTypeEffectiveness(t, swTypes as string[])
    if (eff < 1) score += SWITCH_SCORES.RESIST_BONUS
    if (eff === 0) score += SWITCH_SCORES.IMMUNITY_BONUS
  }

  // Offensive: does switch-in have SE coverage?
  for (const t of swTypes) {
    if (getTypeEffectiveness(t, oppTypes as string[]) > 1) {
      score += SWITCH_SCORES.SE_COVERAGE_BONUS
      break
    }
  }

  // Health penalty
  score *= switchPokemon.hpPercent / 100

  // Hazard penalty
  const mySC = state.sides.p1.sideConditions
  if (mySC.stealthRock) score -= SWITCH_SCORES.STEALTH_ROCK_PENALTY
  if (mySC.spikes > 0) score -= SWITCH_SCORES.SPIKES_PENALTY_PER_LAYER * mySC.spikes
  if (mySC.stickyWeb) score -= SWITCH_SCORES.STICKY_WEB_PENALTY

  const explanation =
    score > 20 ? "Good defensive switch" : score > 0 ? "Reasonable switch" : "Risky switch"

  return { score, explanation }
}

function scoreMoveAgainstBestTarget(
  move: BattleActionSet["moves"][0],
  moveIndex: number,
  myActive: BattlePokemon,
  oppActives: BattlePokemon[],
  state: BattleState,
): { action: BattleAction; name: string; score: number; explanation: string } {
  let bestScore = -Infinity
  let bestExplanation = ""
  let bestTargetSlot = 1

  for (let targetIdx = 0; targetIdx < oppActives.length; targetIdx++) {
    const target = oppActives[targetIdx]
    const { score, explanation } = estimateMoveScore(move, myActive, target, state)
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
  const scored: { action: BattleAction; name: string; score: number; explanation: string }[] = []

  const myActive = state.sides[perspective].active[activeSlot]
  const oppSide = perspective === "p1" ? "p2" : "p1"
  const isDoubles = state.format === "doubles"

  const oppActives = state.sides[oppSide].active.filter(
    (p): p is BattlePokemon => p != null && !p.fainted,
  )
  const oppActive = oppActives[0] ?? null

  // Score moves
  if (myActive && oppActive) {
    const hasMultipleTargets = isDoubles && oppActives.length > 1
    for (let i = 0; i < actions.moves.length; i++) {
      const move = actions.moves[i]
      if (move.disabled) continue

      const moveIndex = i + 1
      if (hasMultipleTargets) {
        scored.push(scoreMoveAgainstBestTarget(move, moveIndex, myActive, oppActives, state))
      } else {
        const { score, explanation } = estimateMoveScore(move, myActive, oppActive, state)
        scored.push({ action: { type: "move", moveIndex }, name: move.name, score, explanation })
      }
    }
  }

  // Score switches
  for (const sw of actions.switches) {
    if (sw.fainted) continue
    const { score, explanation } = estimateSwitchScore(sw, state)
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
