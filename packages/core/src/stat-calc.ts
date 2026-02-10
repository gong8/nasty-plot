import { NATURE_DATA } from "./constants";
import { STATS } from "./types";
import type { NatureName, StatName, StatsTable } from "./types";

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
  nature: NatureName
): number {
  const core = Math.floor((2 * base + iv + Math.floor(ev / 4)) * level / 100);

  if (stat === "hp") {
    if (base === 1) return 1; // Shedinja
    return core + level + 10;
  }

  const natureData = NATURE_DATA[nature];
  let natureMod = 1.0;
  if (natureData.plus === stat) natureMod = 1.1;
  if (natureData.minus === stat) natureMod = 0.9;

  return Math.floor((core + 5) * natureMod);
}

/**
 * Calculate all stats for a Pokemon.
 */
export function calculateAllStats(
  baseStats: StatsTable,
  ivs: StatsTable,
  evs: StatsTable,
  level: number,
  nature: NatureName
): StatsTable {
  const stats = {} as StatsTable;
  for (const stat of STATS) {
    stats[stat] = calculateStat(stat, baseStats[stat], ivs[stat], evs[stat], level, nature);
  }
  return stats;
}

/**
 * Get total EVs from a stats table.
 */
export function getTotalEvs(evs: StatsTable): number {
  return evs.hp + evs.atk + evs.def + evs.spa + evs.spd + evs.spe;
}

/**
 * Validate EV spread: each stat 0-252, total <= 510.
 */
export function validateEvs(evs: StatsTable): { valid: boolean; reason?: string } {
  for (const stat of STATS) {
    if (evs[stat] < 0 || evs[stat] > 252) {
      return { valid: false, reason: `${stat} EVs must be between 0 and 252` };
    }
    if (evs[stat] % 4 !== 0) {
      return { valid: false, reason: `${stat} EVs should be divisible by 4` };
    }
  }
  const total = getTotalEvs(evs);
  if (total > 510) {
    return { valid: false, reason: `Total EVs (${total}) exceeds maximum of 510` };
  }
  return { valid: true };
}
