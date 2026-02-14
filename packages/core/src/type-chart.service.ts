import { TYPE_CHART } from "./constants"
import { POKEMON_TYPES, type PokemonType } from "./types"

/**
 * Get effectiveness multiplier of an attacking type against defending type(s).
 */
export function getTypeEffectiveness(attackType: PokemonType, defenseTypes: PokemonType[]): number {
  let multiplier = 1
  const chart = TYPE_CHART[attackType]
  if (!chart) return multiplier
  for (const defType of defenseTypes) {
    multiplier *= chart[defType] ?? 1
  }
  return multiplier
}

/**
 * Get all weaknesses for a type combination.
 */
export function getWeaknesses(types: PokemonType[]): PokemonType[] {
  return POKEMON_TYPES.filter((attackType) => getTypeEffectiveness(attackType, types) > 1)
}

/**
 * Get all resistances for a type combination.
 */
export function getResistances(types: PokemonType[]): PokemonType[] {
  return POKEMON_TYPES.filter((attackType) => {
    const eff = getTypeEffectiveness(attackType, types)
    return eff > 0 && eff < 1
  })
}

/**
 * Get all immunities for a type combination.
 */
export function getImmunities(types: PokemonType[]): PokemonType[] {
  return POKEMON_TYPES.filter((attackType) => getTypeEffectiveness(attackType, types) === 0)
}

type EffectivenessBucket = "4x" | "2x" | "1x" | "0.5x" | "0.25x" | "0x"

/**
 * Get full defensive profile for a type combination.
 */
export function getDefensiveProfile(
  types: PokemonType[],
): Record<EffectivenessBucket, PokemonType[]> {
  const profile: Record<EffectivenessBucket, PokemonType[]> = {
    "4x": [],
    "2x": [],
    "1x": [],
    "0.5x": [],
    "0.25x": [],
    "0x": [],
  }

  for (const attackType of POKEMON_TYPES) {
    const eff = getTypeEffectiveness(attackType, types)
    const bucket = effectivenessToBucket(eff)
    profile[bucket].push(attackType)
  }

  return profile
}

function effectivenessToBucket(eff: number): EffectivenessBucket {
  if (eff === 0) return "0x"
  if (eff >= 4) return "4x"
  if (eff >= 2) return "2x"
  if (eff === 1) return "1x"
  if (eff >= 0.5) return "0.5x"
  return "0.25x"
}

/**
 * Get offensive coverage: which types can this type hit super-effectively?
 */
export function getOffensiveCoverage(attackType: PokemonType): PokemonType[] {
  const chart = TYPE_CHART[attackType]
  return POKEMON_TYPES.filter((defType) => (chart[defType] ?? 1) > 1)
}
