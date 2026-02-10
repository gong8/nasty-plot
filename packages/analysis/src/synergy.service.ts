import {
  POKEMON_TYPES,
  DEFAULT_IVS,
  DEFAULT_EVS,
  calculateAllStats,
  getTypeEffectiveness,
  getWeaknesses,
  getOffensiveCoverage,
  type PokemonType,
  type TeamSlotData,
} from "@nasty-plot/core";

/**
 * Calculate a synergy score (0-100) for the team based on:
 * - Type coverage complementarity
 * - Offensive coverage breadth
 * - Speed tier diversity
 * - Physical/Special balance
 */
export function calculateSynergy(slots: TeamSlotData[]): number {
  if (slots.length === 0) return 0;
  if (slots.length === 1) return 50;

  const score =
    calculateDefensiveComplementarity(slots) +
    calculateOffensiveBreadth(slots) +
    calculateSpeedDiversity(slots) +
    calculateAttackBalance(slots);

  return Math.min(100, Math.max(0, Math.round(score)));
}

/** Max 35 points. Do teammates cover each other's weaknesses? */
function calculateDefensiveComplementarity(slots: TeamSlotData[]): number {
  let coveredWeaknesses = 0;
  let totalWeaknesses = 0;

  for (let i = 0; i < slots.length; i++) {
    const types = slots[i].species?.types ?? [];
    if (types.length === 0) continue;
    const weaknesses = getWeaknesses(types);

    for (const weakness of weaknesses) {
      totalWeaknesses++;
      for (let j = 0; j < slots.length; j++) {
        if (i === j) continue;
        const mateTypes = slots[j].species?.types ?? [];
        if (mateTypes.length === 0) continue;
        if (getTypeEffectiveness(weakness, mateTypes) < 1) {
          coveredWeaknesses++;
          break;
        }
      }
    }
  }

  if (totalWeaknesses === 0) return 35;
  return Math.round((coveredWeaknesses / totalWeaknesses) * 35);
}

/** Max 25 points. How many types can the team hit super-effectively? */
function calculateOffensiveBreadth(slots: TeamSlotData[]): number {
  const coveredTypes = new Set<PokemonType>();

  for (const slot of slots) {
    const types = slot.species?.types ?? [];
    for (const pkType of types) {
      for (const t of getOffensiveCoverage(pkType)) {
        coveredTypes.add(t);
      }
    }
  }

  return Math.round((coveredTypes.size / POKEMON_TYPES.length) * 25);
}

/** Max 20 points. Mix of fast and slow Pokemon. */
function calculateSpeedDiversity(slots: TeamSlotData[]): number {
  const speeds: number[] = [];

  for (const slot of slots) {
    if (!slot.species) continue;
    const stats = calculateAllStats(
      slot.species.baseStats,
      { ...DEFAULT_IVS, ...(slot.ivs ?? {}) },
      { ...DEFAULT_EVS, ...(slot.evs ?? {}) },
      slot.level,
      slot.nature
    );
    speeds.push(stats.spe);
  }

  if (speeds.length < 2) return 10;

  speeds.sort((a, b) => a - b);
  const range = speeds[speeds.length - 1] - speeds[0];

  // Good range = 100+ spread
  const rangePts = Math.min(range / 100, 1) * 10;

  // Check that speeds are spread out (not all clumped)
  let spreadCount = 0;
  for (let i = 1; i < speeds.length; i++) {
    if (speeds[i] - speeds[i - 1] > 15) spreadCount++;
  }
  const spreadPts = Math.min(spreadCount / (speeds.length - 1), 1) * 10;

  return Math.round(rangePts + spreadPts);
}

/** Max 20 points. Balance of physical and special attackers. */
function calculateAttackBalance(slots: TeamSlotData[]): number {
  let physicalAttackers = 0;
  let specialAttackers = 0;

  for (const slot of slots) {
    if (!slot.species) continue;
    const { atk, spa } = slot.species.baseStats;

    if (atk > spa && atk >= 80) physicalAttackers++;
    if (spa > atk && spa >= 80) specialAttackers++;
    if (Math.abs(atk - spa) <= 10 && atk >= 80) {
      physicalAttackers += 0.5;
      specialAttackers += 0.5;
    }
  }

  const total = physicalAttackers + specialAttackers;
  if (total === 0) return 10;

  const ratio = Math.min(physicalAttackers, specialAttackers) / Math.max(physicalAttackers, specialAttackers);
  return Math.round(ratio * 20);
}
