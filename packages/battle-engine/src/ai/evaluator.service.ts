import type { BattleState, BattlePokemon, SideConditions, FieldState } from "../types"
import { getTypeEffectiveness } from "@nasty-plot/core"
import { getSpeciesTypes, getEffectiveSpeed } from "./shared"

/**
 * Position evaluator for competitive Pokemon battles.
 *
 * Uses weighted features to produce a score in [-1, +1] range
 * where positive favors p1 (player) and negative favors p2 (opponent).
 */

export interface EvalFeature {
  name: string
  rawValue: number
  weight: number
  contribution: number
}

export interface EvalResult {
  /** Normalized score in [-1, +1], positive = favors perspective */
  score: number
  /** Raw unnormalized score */
  rawScore: number
  /** Breakdown of features for UI display */
  features: EvalFeature[]
}

// Feature weights (research-based)
const WEIGHT = {
  HP_REMAINING: 1024,
  POKEMON_ALIVE: 512,
  FAST_POKEMON_ALIVE: 512,
  HAZARDS_SR: 200,
  HAZARDS_SPIKES_PER: 150,
  HAZARDS_TSPIKES_PER: 100,
  HAZARDS_WEB: 120,
  SCREEN_REFLECT: 64,
  SCREEN_LIGHT: 64,
  SCREEN_VEIL: 80,
  TAILWIND: 50,
  STATUS_BRN: 120,
  STATUS_PAR: 100,
  STATUS_SLP: 110,
  STATUS_TOX: 120,
  STATUS_PSN: 80,
  STATUS_FRZ: 110,
  SE_COVERAGE: 200,
  STAB_ADVANTAGE: 100,
  SPEED_ADVANTAGE: 50,
  BOOST_PER_STAGE: 30,
  SUBSTITUTE: 150,
} as const

const NORMALIZATION_FACTOR = 1400

const FAST_SPEED_THRESHOLD = 100

const STATUS_WEIGHTS: Record<string, number> = {
  brn: WEIGHT.STATUS_BRN,
  par: WEIGHT.STATUS_PAR,
  slp: WEIGHT.STATUS_SLP,
  tox: WEIGHT.STATUS_TOX,
  psn: WEIGHT.STATUS_PSN,
  frz: WEIGHT.STATUS_FRZ,
}

function isAlive(p: BattlePokemon): boolean {
  return !p.fainted && p.hp > 0
}

function isFast(p: BattlePokemon): boolean {
  return p.stats.spe >= FAST_SPEED_THRESHOLD
}

function hpFraction(team: BattlePokemon[]): number {
  let totalHp = 0
  let totalMaxHp = 0
  for (const p of team) {
    totalMaxHp += p.maxHp || 1
    totalHp += p.hp
  }
  return totalMaxHp > 0 ? totalHp / totalMaxHp : 0
}

function aliveCount(team: BattlePokemon[]): number {
  return team.filter(isAlive).length
}

function fastAliveCount(team: BattlePokemon[]): number {
  return team.filter((p) => isAlive(p) && isFast(p)).length
}

function evalHazards(sc: SideConditions): number {
  let score = 0
  if (sc.stealthRock) score += WEIGHT.HAZARDS_SR
  score += sc.spikes * WEIGHT.HAZARDS_SPIKES_PER
  score += sc.toxicSpikes * WEIGHT.HAZARDS_TSPIKES_PER
  if (sc.stickyWeb) score += WEIGHT.HAZARDS_WEB
  return score
}

function evalScreens(sc: SideConditions): number {
  let score = 0
  if (sc.reflect > 0) score += WEIGHT.SCREEN_REFLECT
  if (sc.lightScreen > 0) score += WEIGHT.SCREEN_LIGHT
  if (sc.auroraVeil > 0) score += WEIGHT.SCREEN_VEIL
  if (sc.tailwind > 0) score += WEIGHT.TAILWIND
  return score
}

function evalStatus(team: BattlePokemon[]): number {
  let score = 0
  for (const p of team) {
    if (!isAlive(p) || !p.status) continue
    score += STATUS_WEIGHTS[p.status] ?? 0
  }
  return score
}

function evalActiveMatchup(
  myActive: BattlePokemon | null,
  oppActive: BattlePokemon | null,
  field: FieldState,
  mySideConditions: SideConditions,
  oppSideConditions: SideConditions,
): number {
  if (!myActive || !oppActive || !isAlive(myActive) || !isAlive(oppActive)) return 0

  let score = 0
  const myTypes = getSpeciesTypes(myActive.name)
  const oppTypes = getSpeciesTypes(oppActive.name)

  // Check if we have SE coverage
  for (const t of myTypes) {
    if (getTypeEffectiveness(t, oppTypes as string[]) > 1) {
      score += WEIGHT.SE_COVERAGE
      break
    }
  }

  // STAB advantage: our STAB resisted by fewer of opponent's types
  let stabCount = 0
  for (const t of myTypes) {
    if (getTypeEffectiveness(t, oppTypes as string[]) >= 1) stabCount++
  }
  if (stabCount > 0) score += WEIGHT.STAB_ADVANTAGE * (stabCount / myTypes.length)

  // Speed advantage — account for boosts, paralysis, tailwind, Trick Room
  const mySpe = getEffectiveSpeed(myActive, mySideConditions)
  const oppSpe = getEffectiveSpeed(oppActive, oppSideConditions)
  const isFaster = field.trickRoom > 0 ? mySpe < oppSpe : mySpe > oppSpe
  const isSlower = field.trickRoom > 0 ? mySpe > oppSpe : mySpe < oppSpe
  if (isFaster) score += WEIGHT.SPEED_ADVANTAGE
  else if (isSlower) score -= WEIGHT.SPEED_ADVANTAGE

  // Stat boosts
  const myBoostTotal = Object.values(myActive.boosts).reduce((sum, val) => sum + val, 0)
  const oppBoostTotal = Object.values(oppActive.boosts).reduce((sum, val) => sum + val, 0)
  score += (myBoostTotal - oppBoostTotal) * WEIGHT.BOOST_PER_STAGE

  // Substitute
  if (myActive.volatiles.includes("Substitute")) score += WEIGHT.SUBSTITUTE
  if (oppActive.volatiles.includes("Substitute")) score -= WEIGHT.SUBSTITUTE

  return score
}

function evalActiveMatchupScore(
  state: BattleState,
  my: BattleState["sides"]["p1"],
  opp: BattleState["sides"]["p1"],
): number {
  if (state.format !== "doubles") {
    return evalActiveMatchup(
      my.active[0],
      opp.active[0],
      state.field,
      my.sideConditions,
      opp.sideConditions,
    )
  }

  const myActives = my.active.filter((p): p is BattlePokemon => p != null && isAlive(p))
  const oppActives = opp.active.filter((p): p is BattlePokemon => p != null && isAlive(p))
  let total = 0
  for (const myA of myActives) {
    for (const oppA of oppActives) {
      total += evalActiveMatchup(myA, oppA, state.field, my.sideConditions, opp.sideConditions)
    }
  }
  const pairCount = myActives.length * oppActives.length
  return pairCount > 1 ? total / pairCount : total
}

/**
 * Evaluate a battle position from the given perspective.
 *
 * Returns a score in [-1, +1] where positive favors the perspective side.
 */
export function evaluatePosition(state: BattleState, perspective: "p1" | "p2" = "p1"): EvalResult {
  const my = state.sides[perspective]
  const opp = state.sides[perspective === "p1" ? "p2" : "p1"]
  const myTotal = my.team.length || 1
  const oppTotal = opp.team.length || 1

  const features: EvalFeature[] = []
  let rawScore = 0

  function addFeature(name: string, rawValue: number, weight: number, contribution: number) {
    features.push({ name, rawValue, weight, contribution })
    rawScore += contribution
  }

  const hpDiff = hpFraction(my.team) - hpFraction(opp.team)
  addFeature("HP remaining", hpDiff, WEIGHT.HP_REMAINING, hpDiff * WEIGHT.HP_REMAINING)

  const aliveFrac = aliveCount(my.team) / myTotal - aliveCount(opp.team) / oppTotal
  addFeature(
    "Pokemon alive",
    aliveCount(my.team) - aliveCount(opp.team),
    WEIGHT.POKEMON_ALIVE,
    aliveFrac * WEIGHT.POKEMON_ALIVE,
  )

  const fastDiff = fastAliveCount(my.team) - fastAliveCount(opp.team)
  addFeature(
    "Fast mons alive",
    fastDiff,
    WEIGHT.FAST_POKEMON_ALIVE,
    (fastDiff / Math.max(myTotal, 1)) * WEIGHT.FAST_POKEMON_ALIVE,
  )

  const hazardDiff = evalHazards(opp.sideConditions) - evalHazards(my.sideConditions)
  addFeature("Hazards", hazardDiff, 1, hazardDiff)

  const screenDiff = evalScreens(my.sideConditions) - evalScreens(opp.sideConditions)
  addFeature("Screens/Tailwind", screenDiff, 1, screenDiff)

  const statusDiff = evalStatus(opp.team) - evalStatus(my.team)
  addFeature("Status conditions", statusDiff, 1, statusDiff)

  const matchupScore = evalActiveMatchupScore(state, my, opp)
  addFeature("Active matchup", matchupScore, 1, matchupScore)

  const score = Math.tanh(rawScore / NORMALIZATION_FACTOR)
  return { score, rawScore, features }
}
