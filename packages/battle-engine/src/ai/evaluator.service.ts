import type { BattleState, BattlePokemon, SideConditions, FieldState } from "../types"
import { getTypeEffectiveness, type PokemonType } from "@nasty-plot/core"
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

function hasSuperEffectiveCoverage(
  attackerTypes: PokemonType[],
  defenderTypes: PokemonType[],
): boolean {
  return attackerTypes.some((t) => getTypeEffectiveness(t, defenderTypes) > 1)
}

function countUnresistedStabs(attackerTypes: PokemonType[], defenderTypes: PokemonType[]): number {
  return attackerTypes.filter((t) => getTypeEffectiveness(t, defenderTypes) >= 1).length
}

function evalSpeedMatchup(
  myActive: BattlePokemon,
  oppActive: BattlePokemon,
  field: FieldState,
  mySideConditions: SideConditions,
  oppSideConditions: SideConditions,
): number {
  const mySpeed = getEffectiveSpeed(myActive, mySideConditions)
  const oppSpeed = getEffectiveSpeed(oppActive, oppSideConditions)
  const isTrickRoom = field.trickRoom > 0
  const isFaster = isTrickRoom ? mySpeed < oppSpeed : mySpeed > oppSpeed
  const isSlower = isTrickRoom ? mySpeed > oppSpeed : mySpeed < oppSpeed
  if (isFaster) return WEIGHT.SPEED_ADVANTAGE
  if (isSlower) return -WEIGHT.SPEED_ADVANTAGE
  return 0
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

  if (hasSuperEffectiveCoverage(myTypes, oppTypes)) {
    score += WEIGHT.SE_COVERAGE
  }

  const unresistedStabs = countUnresistedStabs(myTypes, oppTypes)
  if (unresistedStabs > 0) {
    score += WEIGHT.STAB_ADVANTAGE * (unresistedStabs / myTypes.length)
  }

  score += evalSpeedMatchup(myActive, oppActive, field, mySideConditions, oppSideConditions)

  const myBoostTotal = Object.values(myActive.boosts).reduce((sum, val) => sum + val, 0)
  const oppBoostTotal = Object.values(oppActive.boosts).reduce((sum, val) => sum + val, 0)
  score += (myBoostTotal - oppBoostTotal) * WEIGHT.BOOST_PER_STAGE

  if (myActive.volatiles.includes("Substitute")) score += WEIGHT.SUBSTITUTE
  if (oppActive.volatiles.includes("Substitute")) score -= WEIGHT.SUBSTITUTE

  return score
}

function evalActiveMatchupScore(
  state: BattleState,
  mySide: BattleState["sides"]["p1"],
  oppSide: BattleState["sides"]["p1"],
): number {
  if (state.gameType !== "doubles") {
    return evalActiveMatchup(
      mySide.active[0],
      oppSide.active[0],
      state.field,
      mySide.sideConditions,
      oppSide.sideConditions,
    )
  }

  const myActives = mySide.active.filter((p): p is BattlePokemon => p != null && isAlive(p))
  const oppActives = oppSide.active.filter((p): p is BattlePokemon => p != null && isAlive(p))
  let total = 0
  for (const myMon of myActives) {
    for (const oppMon of oppActives) {
      total += evalActiveMatchup(
        myMon,
        oppMon,
        state.field,
        mySide.sideConditions,
        oppSide.sideConditions,
      )
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
  const mySide = state.sides[perspective]
  const oppSide = state.sides[perspective === "p1" ? "p2" : "p1"]
  const myTeamSize = mySide.team.length || 1
  const oppTeamSize = oppSide.team.length || 1

  const features: EvalFeature[] = []
  let rawScore = 0

  function addFeature(name: string, rawValue: number, weight: number, contribution: number) {
    features.push({ name, rawValue, weight, contribution })
    rawScore += contribution
  }

  const hpDiff = hpFraction(mySide.team) - hpFraction(oppSide.team)
  addFeature("HP remaining", hpDiff, WEIGHT.HP_REMAINING, hpDiff * WEIGHT.HP_REMAINING)

  const aliveFrac = aliveCount(mySide.team) / myTeamSize - aliveCount(oppSide.team) / oppTeamSize
  addFeature(
    "Pokemon alive",
    aliveCount(mySide.team) - aliveCount(oppSide.team),
    WEIGHT.POKEMON_ALIVE,
    aliveFrac * WEIGHT.POKEMON_ALIVE,
  )

  const fastDiff = fastAliveCount(mySide.team) - fastAliveCount(oppSide.team)
  addFeature(
    "Fast mons alive",
    fastDiff,
    WEIGHT.FAST_POKEMON_ALIVE,
    (fastDiff / Math.max(myTeamSize, 1)) * WEIGHT.FAST_POKEMON_ALIVE,
  )

  const hazardDiff = evalHazards(oppSide.sideConditions) - evalHazards(mySide.sideConditions)
  addFeature("Hazards", hazardDiff, 1, hazardDiff)

  const screenDiff = evalScreens(mySide.sideConditions) - evalScreens(oppSide.sideConditions)
  addFeature("Screens/Tailwind", screenDiff, 1, screenDiff)

  const statusDiff = evalStatus(oppSide.team) - evalStatus(mySide.team)
  addFeature("Status conditions", statusDiff, 1, statusDiff)

  const matchupScore = evalActiveMatchupScore(state, mySide, oppSide)
  addFeature("Active matchup", matchupScore, 1, matchupScore)

  const score = Math.tanh(rawScore / NORMALIZATION_FACTOR)
  return { score, rawScore, features }
}
