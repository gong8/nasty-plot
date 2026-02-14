import {
  POKEMON_TYPES,
  PERFECT_IV,
  calculateAllStats,
  fillStats,
  getTypeEffectiveness,
  getWeaknesses,
  getOffensiveCoverage,
  type TeamSlotData,
} from "@nasty-plot/core"

const MAX_DEFENSIVE_POINTS = 35
const MAX_OFFENSIVE_POINTS = 25
const MAX_SPEED_POINTS = 20
const MAX_BALANCE_POINTS = 20
const GOOD_SPEED_RANGE = 100
const MEANINGFUL_SPEED_GAP = 15
const MIXED_ATTACKER_THRESHOLD = 10
const MIN_ATTACK_STAT = 80

/**
 * Calculate a synergy score (0-100) for the team based on:
 * - Type coverage complementarity
 * - Offensive coverage breadth
 * - Speed tier diversity
 * - Physical/Special balance
 */
export function calculateSynergy(slots: TeamSlotData[]): number {
  if (slots.length === 0) return 0
  if (slots.length === 1) return 50

  const score =
    calculateDefensiveComplementarity(slots) +
    calculateOffensiveBreadth(slots) +
    calculateSpeedDiversity(slots) +
    calculateAttackBalance(slots)

  return Math.min(100, Math.max(0, Math.round(score)))
}

/** Max 35 points. Do teammates cover each other's weaknesses? */
function calculateDefensiveComplementarity(slots: TeamSlotData[]): number {
  let coveredWeaknesses = 0
  let totalWeaknesses = 0

  for (let i = 0; i < slots.length; i++) {
    const types = slots[i].species?.types ?? []
    if (types.length === 0) continue
    const weaknesses = getWeaknesses(types)

    for (const weakness of weaknesses) {
      totalWeaknesses++
      for (let j = 0; j < slots.length; j++) {
        if (i === j) continue
        const teammateTypes = slots[j].species?.types ?? []
        if (teammateTypes.length === 0) continue
        if (getTypeEffectiveness(weakness, teammateTypes) < 1) {
          coveredWeaknesses++
          break
        }
      }
    }
  }

  if (totalWeaknesses === 0) return MAX_DEFENSIVE_POINTS
  return Math.round((coveredWeaknesses / totalWeaknesses) * MAX_DEFENSIVE_POINTS)
}

/** Max 25 points. How many types can the team hit super-effectively? */
function calculateOffensiveBreadth(slots: TeamSlotData[]): number {
  const coveredTypes = new Set(
    slots.flatMap((slot) => (slot.species?.types ?? []).flatMap(getOffensiveCoverage)),
  )

  return Math.round((coveredTypes.size / POKEMON_TYPES.length) * MAX_OFFENSIVE_POINTS)
}

/** Max 20 points. Mix of fast and slow Pokemon. */
function calculateSpeedDiversity(slots: TeamSlotData[]): number {
  const speeds: number[] = []

  for (const slot of slots) {
    if (!slot.species?.baseStats) continue
    const stats = calculateAllStats(
      slot.species.baseStats,
      fillStats(slot.ivs, PERFECT_IV),
      fillStats(slot.evs, 0),
      slot.level,
      slot.nature,
    )
    speeds.push(stats.spe)
  }

  const halfSpeedPoints = MAX_SPEED_POINTS / 2
  if (speeds.length < 2) return halfSpeedPoints

  speeds.sort((a, b) => a - b)
  const range = speeds[speeds.length - 1] - speeds[0]

  const rangePts = Math.min(range / GOOD_SPEED_RANGE, 1) * halfSpeedPoints

  let spreadCount = 0
  for (let i = 1; i < speeds.length; i++) {
    if (speeds[i] - speeds[i - 1] > MEANINGFUL_SPEED_GAP) spreadCount++
  }
  const spreadPts = Math.min(spreadCount / (speeds.length - 1), 1) * halfSpeedPoints

  return Math.round(rangePts + spreadPts)
}

/** Max 20 points. Balance of physical and special attackers. */
function calculateAttackBalance(slots: TeamSlotData[]): number {
  let physicalAttackers = 0
  let specialAttackers = 0

  for (const slot of slots) {
    if (!slot.species?.baseStats) continue
    const { atk, spa } = slot.species.baseStats

    if (atk > spa && atk >= MIN_ATTACK_STAT) physicalAttackers++
    if (spa > atk && spa >= MIN_ATTACK_STAT) specialAttackers++
    if (Math.abs(atk - spa) <= MIXED_ATTACKER_THRESHOLD && atk >= MIN_ATTACK_STAT) {
      physicalAttackers += 0.5
      specialAttackers += 0.5
    }
  }

  const total = physicalAttackers + specialAttackers
  const halfBalancePoints = MAX_BALANCE_POINTS / 2
  if (total === 0) return halfBalancePoints

  const ratio =
    Math.min(physicalAttackers, specialAttackers) / Math.max(physicalAttackers, specialAttackers)
  return Math.round(ratio * MAX_BALANCE_POINTS)
}
