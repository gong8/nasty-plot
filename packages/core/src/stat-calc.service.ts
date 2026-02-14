import { MAX_SINGLE_EV, MAX_TOTAL_EVS, NATURE_DATA } from "./constants"
import { STATS } from "./types"
import type { NatureName, StatName, StatsTable } from "./types"

/**
 * Calculate a single stat value using the standard Pokemon formula.
 * HP: floor((2*Base + IV + floor(EV/4)) * Level / 100) + Level + 10
 * Other: floor((floor((2*Base + IV + floor(EV/4)) * Level / 100) + 5) * NatureMod)
 */
export function calculateStat(
  stat: StatName,
  base: number,
  iv: number,
  ev: number,
  level: number,
  nature: NatureName,
): number {
  const core = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100)

  if (stat === "hp") {
    if (base === 1) return 1 // Shedinja
    return core + level + 10
  }

  const { plus, minus } = NATURE_DATA[nature]
  const natureMod = plus === stat ? 1.1 : minus === stat ? 0.9 : 1.0

  return Math.floor((core + 5) * natureMod)
}

/**
 * Calculate all stats for a Pokemon.
 */
export function calculateAllStats(
  baseStats: StatsTable,
  ivs: StatsTable,
  evs: StatsTable,
  level: number,
  nature: NatureName,
): StatsTable {
  const stats = {} as StatsTable
  for (const stat of STATS) {
    stats[stat] = calculateStat(stat, baseStats[stat], ivs[stat], evs[stat], level, nature)
  }
  return stats
}

function sumStats(stats: StatsTable): number {
  return STATS.reduce((sum, stat) => sum + stats[stat], 0)
}

/**
 * Get total EVs from a stats table.
 */
export function getTotalEvs(evs: StatsTable): number {
  return sumStats(evs)
}

/**
 * Validate EV spread: each stat 0-252, total <= 510.
 */
export function validateEvs(evs: StatsTable): { valid: boolean; reason?: string } {
  for (const stat of STATS) {
    if (evs[stat] < 0 || evs[stat] > MAX_SINGLE_EV) {
      return { valid: false, reason: `${stat} EVs must be between 0 and ${MAX_SINGLE_EV}` }
    }
    if (evs[stat] % 4 !== 0) {
      return { valid: false, reason: `${stat} EVs should be divisible by 4` }
    }
  }
  const total = getTotalEvs(evs)
  if (total > MAX_TOTAL_EVS) {
    return { valid: false, reason: `Total EVs (${total}) exceeds maximum of ${MAX_TOTAL_EVS}` }
  }
  return { valid: true }
}

export function getBaseStatTotal(stats: StatsTable): number {
  return sumStats(stats)
}

/**
 * Fill a partial StatsTable with a default value for missing stats.
 */
export function fillStats(
  partial: Partial<StatsTable> | undefined,
  defaultValue: number,
): StatsTable {
  return {
    hp: partial?.hp ?? defaultValue,
    atk: partial?.atk ?? defaultValue,
    def: partial?.def ?? defaultValue,
    spa: partial?.spa ?? defaultValue,
    spd: partial?.spd ?? defaultValue,
    spe: partial?.spe ?? defaultValue,
  }
}

// --- StatsTable <-> DB Column Mapping ---

const STAT_CAPITALIZED: Record<StatName, string> = {
  hp: "Hp",
  atk: "Atk",
  def: "Def",
  spa: "Spa",
  spd: "Spd",
  spe: "Spe",
}

export function statsToDbColumns(stats: StatsTable, prefix: "ev" | "iv"): Record<string, number> {
  const result: Record<string, number> = {}
  for (const stat of STATS) {
    result[`${prefix}${STAT_CAPITALIZED[stat]}`] = stats[stat]
  }
  return result
}

export function dbColumnsToStats(row: Record<string, number>, prefix: "ev" | "iv"): StatsTable {
  const result = {} as StatsTable
  for (const stat of STATS) {
    result[stat] = row[`${prefix}${STAT_CAPITALIZED[stat]}`]
  }
  return result
}
