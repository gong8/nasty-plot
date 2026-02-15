import { getRawMove } from "@nasty-plot/pokemon-data"
import { getTypeEffectiveness, type PokemonType } from "@nasty-plot/core"
import type {
  BattleState,
  BattleActionSet,
  BattleAction,
  BattlePokemon,
  DexMove,
  SideConditions,
} from "../types"
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

/** Fallback score multiplier when damage calc throws (uses type effectiveness * multiplier) */
const TYPE_EFFECTIVENESS_FALLBACK_MULTIPLIER = 20

/** Default score for status-infliction moves not in the STATUS_INFLICTION_SCORES map */
const DEFAULT_STATUS_INFLICTION_SCORE = 20

/** HP threshold (%) above which setup moves are considered worthwhile */
const SETUP_HP_THRESHOLD = 60

/** Score for a setup move when the user is at low HP (risky) */
const SETUP_LOW_HP_SCORE = 10

/** Score for a generic status move with no specific classification */
const GENERIC_STATUS_MOVE_SCORE = 5

/** Minimum score for hazard removal when no hazards are present (still slightly useful for utility) */
const NO_HAZARDS_REMOVAL_SCORE = 2

/** Score for switching to an unknown Pokemon (baseline) */
const SWITCH_UNKNOWN_SCORE = 5

/** Score when no opponent is active (baseline switch score) */
const SWITCH_NO_OPPONENT_SCORE = 10

/** Thresholds for classifying move quality relative to the best option */
const CLASSIFICATION_GAP = {
  GOOD: 5,
  NEUTRAL: 15,
  INACCURACY: 30,
  MISTAKE: 60,
} as const

/** Switch score thresholds for explanation text */
const SWITCH_EXPLANATION = {
  GOOD: 20,
  REASONABLE: 0,
} as const

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
  if (gap <= CLASSIFICATION_GAP.GOOD) return "good"
  if (gap <= CLASSIFICATION_GAP.NEUTRAL) return "neutral"
  if (gap <= CLASSIFICATION_GAP.INACCURACY) return "inaccuracy"
  if (gap <= CLASSIFICATION_GAP.MISTAKE) return "mistake"
  return "blunder"
}

function estimateMoveScore(
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

function estimateSwitchScore(
  switchOption: BattleActionSet["switches"][0],
  mySide: BattleState["sides"]["p1"],
  oppSide: BattleState["sides"]["p1"],
): { score: number; explanation: string } {
  const oppActive = oppSide.active[0]
  if (!oppActive) return { score: SWITCH_NO_OPPONENT_SCORE, explanation: "Switch out" }

  const switchPokemon = mySide.team.find(
    (p) => p.name === switchOption.name || p.pokemonId === switchOption.pokemonId,
  )
  if (!switchPokemon) return { score: SWITCH_UNKNOWN_SCORE, explanation: "Switch to unknown" }

  let score = 0
  const oppTypes = getSpeciesTypes(oppActive.name)
  const switchInTypes = getSpeciesTypes(switchPokemon.name)

  for (const t of oppTypes) {
    const eff = getTypeEffectiveness(t, switchInTypes)
    if (eff < 1) score += SWITCH_SCORES.RESIST_BONUS
    if (eff === 0) score += SWITCH_SCORES.IMMUNITY_BONUS
  }

  for (const t of switchInTypes) {
    if (getTypeEffectiveness(t, oppTypes) > 1) {
      score += SWITCH_SCORES.SE_COVERAGE_BONUS
      break
    }
  }

  score *= switchPokemon.hpPercent / 100

  const mySideConditions = mySide.sideConditions
  if (mySideConditions.stealthRock) score -= SWITCH_SCORES.STEALTH_ROCK_PENALTY
  if (mySideConditions.spikes > 0)
    score -= SWITCH_SCORES.SPIKES_PENALTY_PER_LAYER * mySideConditions.spikes
  if (mySideConditions.stickyWeb) score -= SWITCH_SCORES.STICKY_WEB_PENALTY

  const explanation =
    score > SWITCH_EXPLANATION.GOOD
      ? "Good defensive switch"
      : score > SWITCH_EXPLANATION.REASONABLE
        ? "Reasonable switch"
        : "Risky switch"

  return { score, explanation }
}

function scoreMoveAgainstBestTarget(
  move: BattleActionSet["moves"][0],
  moveIndex: number,
  myActive: BattlePokemon,
  oppActives: BattlePokemon[],
  oppSideConditions: SideConditions,
  mySideConditions: SideConditions,
): { action: BattleAction; name: string; score: number; explanation: string } {
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
