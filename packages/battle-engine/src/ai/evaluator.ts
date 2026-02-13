import type { BattleState, BattlePokemon, SideConditions, FieldState } from "../types"
import { getSpeciesTypes, getTypeEffectiveness, getEffectiveSpeed } from "./shared"

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
const W = {
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

const STATUS_WEIGHTS: Record<string, number> = {
  brn: W.STATUS_BRN,
  par: W.STATUS_PAR,
  slp: W.STATUS_SLP,
  tox: W.STATUS_TOX,
  psn: W.STATUS_PSN,
  frz: W.STATUS_FRZ,
}

function isAlive(p: BattlePokemon): boolean {
  return !p.fainted && p.hp > 0
}

function isFast(p: BattlePokemon): boolean {
  return p.stats.spe >= 100
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
  if (sc.stealthRock) score += W.HAZARDS_SR
  score += sc.spikes * W.HAZARDS_SPIKES_PER
  score += sc.toxicSpikes * W.HAZARDS_TSPIKES_PER
  if (sc.stickyWeb) score += W.HAZARDS_WEB
  return score
}

function evalScreens(sc: SideConditions): number {
  let score = 0
  if (sc.reflect > 0) score += W.SCREEN_REFLECT
  if (sc.lightScreen > 0) score += W.SCREEN_LIGHT
  if (sc.auroraVeil > 0) score += W.SCREEN_VEIL
  if (sc.tailwind > 0) score += W.TAILWIND
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
      score += W.SE_COVERAGE
      break
    }
  }

  // STAB advantage: our STAB resisted by fewer of opponent's types
  let stabCount = 0
  for (const t of myTypes) {
    if (getTypeEffectiveness(t, oppTypes as string[]) >= 1) stabCount++
  }
  if (stabCount > 0) score += W.STAB_ADVANTAGE * (stabCount / myTypes.length)

  // Speed advantage — account for boosts, paralysis, tailwind
  const mySpe = getEffectiveSpeed(myActive, mySideConditions)
  const oppSpe = getEffectiveSpeed(oppActive, oppSideConditions)

  // Trick Room inverts speed advantage
  const trickRoom = field.trickRoom > 0
  if (trickRoom) {
    if (mySpe < oppSpe) score += W.SPEED_ADVANTAGE
    else if (oppSpe < mySpe) score -= W.SPEED_ADVANTAGE
  } else {
    if (mySpe > oppSpe) score += W.SPEED_ADVANTAGE
    else if (oppSpe > mySpe) score -= W.SPEED_ADVANTAGE
  }

  // Stat boosts
  const myBoostTotal = Object.values(myActive.boosts).reduce((sum, val) => sum + val, 0)
  const oppBoostTotal = Object.values(oppActive.boosts).reduce((sum, val) => sum + val, 0)
  score += (myBoostTotal - oppBoostTotal) * W.BOOST_PER_STAGE

  // Substitute
  if (myActive.volatiles.includes("Substitute")) score += W.SUBSTITUTE
  if (oppActive.volatiles.includes("Substitute")) score -= W.SUBSTITUTE

  return score
}

/**
 * Evaluate a battle position from the given perspective.
 *
 * Returns a score in [-1, +1] where positive favors the perspective side.
 */
export function evaluatePosition(state: BattleState, perspective: "p1" | "p2" = "p1"): EvalResult {
  const features: EvalFeature[] = []
  let rawScore = 0

  const my = perspective === "p1" ? state.sides.p1 : state.sides.p2
  const opp = perspective === "p1" ? state.sides.p2 : state.sides.p1

  // HP remaining differential
  const myHp = hpFraction(my.team)
  const oppHp = hpFraction(opp.team)
  const hpDiff = (myHp - oppHp) * W.HP_REMAINING
  features.push({
    name: "HP remaining",
    rawValue: myHp - oppHp,
    weight: W.HP_REMAINING,
    contribution: hpDiff,
  })
  rawScore += hpDiff

  // Pokemon alive differential
  const myAlive = aliveCount(my.team)
  const oppAlive = aliveCount(opp.team)
  const myTotal = my.team.length || 1
  const oppTotal = opp.team.length || 1
  const aliveDiff = (myAlive / myTotal - oppAlive / oppTotal) * W.POKEMON_ALIVE
  features.push({
    name: "Pokemon alive",
    rawValue: myAlive - oppAlive,
    weight: W.POKEMON_ALIVE,
    contribution: aliveDiff,
  })
  rawScore += aliveDiff

  // Fast Pokemon alive
  const fastDiff = fastAliveCount(my.team) - fastAliveCount(opp.team)
  const fastScore = (fastDiff / Math.max(myTotal, 1)) * W.FAST_POKEMON_ALIVE
  features.push({
    name: "Fast mons alive",
    rawValue: fastDiff,
    weight: W.FAST_POKEMON_ALIVE,
    contribution: fastScore,
  })
  rawScore += fastScore

  // Hazards on opponent's side = good for us
  const hazardOnOpp = evalHazards(opp.sideConditions)
  const hazardOnMe = evalHazards(my.sideConditions)
  const hazardDiff = hazardOnOpp - hazardOnMe
  features.push({ name: "Hazards", rawValue: hazardDiff, weight: 1, contribution: hazardDiff })
  rawScore += hazardDiff

  // Screens on our side = good
  const myScreens = evalScreens(my.sideConditions)
  const oppScreens = evalScreens(opp.sideConditions)
  const screenDiff = myScreens - oppScreens
  features.push({
    name: "Screens/Tailwind",
    rawValue: screenDiff,
    weight: 1,
    contribution: screenDiff,
  })
  rawScore += screenDiff

  // Status inflicted on opponent = good
  const statusOnOpp = evalStatus(opp.team)
  const statusOnMe = evalStatus(my.team)
  const statusDiff = statusOnOpp - statusOnMe
  features.push({
    name: "Status conditions",
    rawValue: statusDiff,
    weight: 1,
    contribution: statusDiff,
  })
  rawScore += statusDiff

  // Active matchup — in doubles, evaluate all active-vs-active pairs
  let matchupScore = 0
  if (state.format === "doubles") {
    const myActives = my.active.filter((p): p is BattlePokemon => p != null && isAlive(p))
    const oppActives = opp.active.filter((p): p is BattlePokemon => p != null && isAlive(p))
    for (const myA of myActives) {
      for (const oppA of oppActives) {
        matchupScore += evalActiveMatchup(
          myA,
          oppA,
          state.field,
          my.sideConditions,
          opp.sideConditions,
        )
      }
    }
    // Normalize by number of matchup pairs to keep weight comparable to singles
    const pairCount = myActives.length * oppActives.length
    if (pairCount > 1) matchupScore /= pairCount
  } else {
    matchupScore = evalActiveMatchup(
      my.active[0],
      opp.active[0],
      state.field,
      my.sideConditions,
      opp.sideConditions,
    )
  }
  features.push({
    name: "Active matchup",
    rawValue: matchupScore,
    weight: 1,
    contribution: matchupScore,
  })
  rawScore += matchupScore

  // Normalize via tanh
  const score = Math.tanh(rawScore / NORMALIZATION_FACTOR)

  return { score, rawScore, features }
}
