import { TYPE_CHART } from "@/shared/constants";
import { POKEMON_TYPES, type PokemonType } from "@/shared/types";

/**
 * Get effectiveness multiplier of an attacking type against defending type(s).
 */
export function getTypeEffectiveness(
  attackType: PokemonType,
  defenseTypes: PokemonType[]
): number {
  let multiplier = 1;
  for (const defType of defenseTypes) {
    const chart = TYPE_CHART[attackType];
    const effectiveness = chart[defType];
    if (effectiveness !== undefined) {
      multiplier *= effectiveness;
    }
  }
  return multiplier;
}

/**
 * Get all weaknesses for a type combination.
 */
export function getWeaknesses(types: PokemonType[]): PokemonType[] {
  return POKEMON_TYPES.filter(
    (attackType) => getTypeEffectiveness(attackType, types) > 1
  );
}

/**
 * Get all resistances for a type combination.
 */
export function getResistances(types: PokemonType[]): PokemonType[] {
  return POKEMON_TYPES.filter((attackType) => {
    const eff = getTypeEffectiveness(attackType, types);
    return eff > 0 && eff < 1;
  });
}

/**
 * Get all immunities for a type combination.
 */
export function getImmunities(types: PokemonType[]): PokemonType[] {
  return POKEMON_TYPES.filter(
    (attackType) => getTypeEffectiveness(attackType, types) === 0
  );
}

/**
 * Get full defensive profile for a type combination.
 */
export function getDefensiveProfile(types: PokemonType[]) {
  const profile: Record<string, PokemonType[]> = {
    "4x": [],
    "2x": [],
    "1x": [],
    "0.5x": [],
    "0.25x": [],
    "0x": [],
  };

  for (const attackType of POKEMON_TYPES) {
    const eff = getTypeEffectiveness(attackType, types);
    if (eff >= 4) profile["4x"].push(attackType);
    else if (eff >= 2) profile["2x"].push(attackType);
    else if (eff === 1) profile["1x"].push(attackType);
    else if (eff >= 0.5) profile["0.5x"].push(attackType);
    else if (eff > 0) profile["0.25x"].push(attackType);
    else profile["0x"].push(attackType);
  }

  return profile;
}

/**
 * Get offensive coverage: which types can this type hit super-effectively?
 */
export function getOffensiveCoverage(attackType: PokemonType): PokemonType[] {
  return POKEMON_TYPES.filter((defType) => {
    const chart = TYPE_CHART[attackType];
    return (chart[defType] ?? 1) > 1;
  });
}
