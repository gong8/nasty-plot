import {
  POKEMON_TYPES,
  getTypeEffectiveness,
  getWeaknesses,
  getOffensiveCoverage,
  type PokemonType,
  type TeamSlotData,
  type TypeCoverage,
} from "@nasty-plot/core"

/**
 * Analyze type coverage for a team: offensive and defensive profiles.
 */
export function analyzeTypeCoverage(slots: TeamSlotData[]): TypeCoverage {
  const offensive = {} as Record<PokemonType, number>
  const defensive = {} as Record<PokemonType, number>

  for (const type of POKEMON_TYPES) {
    offensive[type] = 0
    defensive[type] = 0
  }

  // Offensive: count how many team members can hit each type super-effectively
  for (const slot of slots) {
    const coveredTypes = new Set<PokemonType>()
    const pokemonTypes = slot.species?.types ?? []

    for (const stabType of pokemonTypes) {
      for (const coveredType of getOffensiveCoverage(stabType)) {
        coveredTypes.add(coveredType)
      }
    }

    for (const coveredType of coveredTypes) {
      offensive[coveredType]++
    }
  }

  // Defensive: count how many team members resist each attacking type
  for (const slot of slots) {
    const types = slot.species?.types ?? []
    if (types.length === 0) continue

    for (const atkType of POKEMON_TYPES) {
      const effectiveness = getTypeEffectiveness(atkType, types)
      if (effectiveness < 1) {
        defensive[atkType]++
      }
    }
  }

  // Uncovered types: no team member can hit super-effectively
  const uncoveredTypes = POKEMON_TYPES.filter((type) => offensive[type] === 0) as PokemonType[]

  // Shared weaknesses: types that 2+ team members are weak to
  const weaknessCount: Partial<Record<PokemonType, number>> = {}
  for (const slot of slots) {
    const types = slot.species?.types ?? []
    if (types.length === 0) continue
    for (const weakness of getWeaknesses(types)) {
      weaknessCount[weakness] = (weaknessCount[weakness] ?? 0) + 1
    }
  }

  const sharedWeaknesses = POKEMON_TYPES.filter(
    (type) => (weaknessCount[type] ?? 0) >= 2,
  ) as PokemonType[]

  return {
    offensive,
    defensive,
    uncoveredTypes,
    sharedWeaknesses,
  }
}
