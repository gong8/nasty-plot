import { POKEMON_TYPES, type PokemonType, type TeamSlotData } from "@/shared/types";
import { getTypeEffectiveness, getWeaknesses, getOffensiveCoverage } from "@/shared/lib/type-chart";
import { calculateAllStats } from "@/shared/lib/stat-calc";
import { DEFAULT_IVS, DEFAULT_EVS } from "@/shared/constants";

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

  let score = 0;

  // 1. Defensive complementarity (max 35 points)
  // Do teammates cover each other's weaknesses?
  score += calculateDefensiveComplementarity(slots);

  // 2. Offensive coverage breadth (max 25 points)
  score += calculateOffensiveBreadth(slots);

  // 3. Speed tier diversity (max 20 points)
  score += calculateSpeedDiversity(slots);

  // 4. Physical/Special balance (max 20 points)
  score += calculateAttackBalance(slots);

  return Math.min(100, Math.max(0, Math.round(score)));
}

function calculateDefensiveComplementarity(slots: TeamSlotData[]): number {
  let coveredWeaknesses = 0;
  let totalWeaknesses = 0;

  for (let i = 0; i < slots.length; i++) {
    const types = slots[i].species?.types ?? [];
    if (types.length === 0) continue;
    const weaknesses = getWeaknesses(types as PokemonType[]);

    for (const weakness of weaknesses) {
      totalWeaknesses++;
      // Check if any teammate resists this type
      for (let j = 0; j < slots.length; j++) {
        if (i === j) continue;
        const mateTypes = slots[j].species?.types ?? [];
        if (mateTypes.length === 0) continue;
        const eff = getTypeEffectiveness(weakness, mateTypes as PokemonType[]);
        if (eff < 1) {
          coveredWeaknesses++;
          break;
        }
      }
    }
  }

  if (totalWeaknesses === 0) return 35;
  const ratio = coveredWeaknesses / totalWeaknesses;
  return Math.round(ratio * 35);
}

function calculateOffensiveBreadth(slots: TeamSlotData[]): number {
  const coveredTypes = new Set<PokemonType>();

  for (const slot of slots) {
    const types = slot.species?.types ?? [];
    for (const pkType of types) {
      const coverage = getOffensiveCoverage(pkType as PokemonType);
      for (const t of coverage) {
        coveredTypes.add(t);
      }
    }
  }

  // 18 types total. Covering 14+ is excellent.
  const ratio = coveredTypes.size / POKEMON_TYPES.length;
  return Math.round(ratio * 25);
}

function calculateSpeedDiversity(slots: TeamSlotData[]): number {
  const speeds: number[] = [];

  for (const slot of slots) {
    if (!slot.species) continue;
    const stats = calculateAllStats(
      slot.species.baseStats,
      { ...DEFAULT_IVS, ...(slot.ivs ?? {}) } as typeof DEFAULT_IVS,
      { ...DEFAULT_EVS, ...(slot.evs ?? {}) } as typeof DEFAULT_EVS,
      slot.level,
      slot.nature
    );
    speeds.push(stats.spe);
  }

  if (speeds.length < 2) return 10;

  // We want a mix of fast and slow Pokemon
  speeds.sort((a, b) => a - b);
  const min = speeds[0];
  const max = speeds[speeds.length - 1];
  const range = max - min;

  // Good range = 100+ spread
  const rangePts = Math.min(range / 100, 1) * 10;

  // Check that speeds are spread out (not all clumped)
  let spreadScore = 0;
  for (let i = 1; i < speeds.length; i++) {
    if (speeds[i] - speeds[i - 1] > 15) spreadScore++;
  }
  const spreadPts = Math.min(spreadScore / (speeds.length - 1), 1) * 10;

  return Math.round(rangePts + spreadPts);
}

function calculateAttackBalance(slots: TeamSlotData[]): number {
  let physicalAttackers = 0;
  let specialAttackers = 0;

  for (const slot of slots) {
    if (!slot.species) continue;
    const baseAtk = slot.species.baseStats.atk;
    const baseSpa = slot.species.baseStats.spa;

    if (baseAtk > baseSpa && baseAtk >= 80) physicalAttackers++;
    if (baseSpa > baseAtk && baseSpa >= 80) specialAttackers++;
    if (Math.abs(baseAtk - baseSpa) <= 10 && baseAtk >= 80) {
      physicalAttackers += 0.5;
      specialAttackers += 0.5;
    }
  }

  const total = physicalAttackers + specialAttackers;
  if (total === 0) return 10;

  // Ideal ratio is close to 50/50
  const ratio = Math.min(physicalAttackers, specialAttackers) / Math.max(physicalAttackers, specialAttackers);
  return Math.round(ratio * 20);
}
