import { POKEMON_TYPES, type PokemonType, type TeamSlotData, type TypeCoverage } from "@/shared/types";
import { TYPE_CHART } from "@/shared/constants";
import {
  getTypeEffectiveness,
  getWeaknesses,
  getOffensiveCoverage,
} from "@/shared/lib/type-chart";

/**
 * Analyze type coverage for a team: offensive and defensive profiles.
 */
export function analyzeTypeCoverage(slots: TeamSlotData[]): TypeCoverage {
  const offensive = {} as Record<PokemonType, number>;
  const defensive = {} as Record<PokemonType, number>;

  // Initialize all types to 0
  for (const t of POKEMON_TYPES) {
    offensive[t] = 0;
    defensive[t] = 0;
  }

  // Offensive: count how many team members can hit each type super-effectively
  for (const slot of slots) {
    const moveTypes = new Set<PokemonType>();

    // Collect move types from the slot's moves
    for (const moveName of slot.moves) {
      if (!moveName) continue;
      // Look up move type from the TYPE_CHART keys - we infer from move name matching
      // Since we don't have the full move database accessible here, we rely on
      // the species' move types. For a more accurate analysis, the caller should
      // populate species data or we approximate using the pokemon's types.
      // We'll use a helper that checks the type chart for the move's type.
    }

    // Primary approach: use the Pokemon's own types + move types if species is hydrated
    const pokemonTypes = slot.species?.types ?? [];

    // Add pokemon STAB types as offensive coverage
    for (const pkType of pokemonTypes) {
      const covered = getOffensiveCoverage(pkType);
      for (const coveredType of covered) {
        moveTypes.add(coveredType);
      }
    }

    // Also try to get move types from the move names via dex
    for (const moveName of slot.moves) {
      if (!moveName) continue;
      // Check each attacking type to see if this move name matches
      // We'll use the move type lookup from @pkmn/dex at the API layer
      // For now, we tag all types this pokemon's moves could cover
      for (const atkType of POKEMON_TYPES) {
        const chart = TYPE_CHART[atkType];
        // This is a simplified heuristic; the API route will pass enriched data
        if (chart) {
          for (const defType of POKEMON_TYPES) {
            if ((chart[defType] ?? 1) > 1 && moveTypes.has(defType)) {
              offensive[defType] = Math.max(offensive[defType], 1);
            }
          }
        }
      }
    }

    // Mark types this pokemon can cover
    for (const covType of moveTypes) {
      offensive[covType]++;
    }
  }

  // Defensive: count how many team members resist each attacking type
  for (const slot of slots) {
    const types = slot.species?.types ?? [];
    if (types.length === 0) continue;

    for (const atkType of POKEMON_TYPES) {
      const eff = getTypeEffectiveness(atkType, types as PokemonType[]);
      if (eff < 1) {
        defensive[atkType]++;
      }
    }
  }

  // Uncovered types: no team member can hit super-effectively
  const uncoveredTypes = POKEMON_TYPES.filter((t) => offensive[t] === 0) as PokemonType[];

  // Shared weaknesses: types that 2+ team members are weak to
  const weaknessCount: Partial<Record<PokemonType, number>> = {};
  for (const slot of slots) {
    const types = slot.species?.types ?? [];
    if (types.length === 0) continue;
    const weaks = getWeaknesses(types as PokemonType[]);
    for (const w of weaks) {
      weaknessCount[w] = (weaknessCount[w] ?? 0) + 1;
    }
  }

  const sharedWeaknesses = POKEMON_TYPES.filter(
    (t) => (weaknessCount[t] ?? 0) >= 2
  ) as PokemonType[];

  return {
    offensive,
    defensive,
    uncoveredTypes,
    sharedWeaknesses,
  };
}
