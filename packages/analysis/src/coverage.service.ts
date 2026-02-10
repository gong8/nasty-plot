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

  for (const t of POKEMON_TYPES) {
    offensive[t] = 0
    defensive[t] = 0
  }

  // Offensive: count how many team members can hit each type super-effectively
  for (const slot of slots) {
    const coveredTypes = new Set<PokemonType>()
    const pokemonTypes = slot.species?.types ?? []

    for (const pkType of pokemonTypes) {
      for (const coveredType of getOffensiveCoverage(pkType)) {
        coveredTypes.add(coveredType)
      }
    }

    for (const covType of coveredTypes) {
      offensive[covType]++
    }
  }

  // Defensive: count how many team members resist each attacking type
  for (const slot of slots) {
    const types = slot.species?.types ?? []
    if (types.length === 0) continue

    for (const atkType of POKEMON_TYPES) {
      const eff = getTypeEffectiveness(atkType, types)
      if (eff < 1) {
        defensive[atkType]++
      }
    }
  }

  // Uncovered types: no team member can hit super-effectively
  const uncoveredTypes = POKEMON_TYPES.filter((t) => offensive[t] === 0) as PokemonType[]

  // Shared weaknesses: types that 2+ team members are weak to
  const weaknessCount: Partial<Record<PokemonType, number>> = {}
  for (const slot of slots) {
    const types = slot.species?.types ?? []
    if (types.length === 0) continue
    for (const w of getWeaknesses(types)) {
      weaknessCount[w] = (weaknessCount[w] ?? 0) + 1
    }
  }

  const sharedWeaknesses = POKEMON_TYPES.filter(
    (t) => (weaknessCount[t] ?? 0) >= 2,
  ) as PokemonType[]

  return {
    offensive,
    defensive,
    uncoveredTypes,
    sharedWeaknesses,
  }
}
