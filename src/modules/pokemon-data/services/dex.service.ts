import { Dex } from "@pkmn/dex";
import type {
  PokemonSpecies,
  PokemonType,
  MoveData,
  AbilityData,
  ItemData,
  StatsTable,
} from "@/shared/types";

const dex = Dex.forGen(9);

export function getDex() {
  return dex;
}

function mapTypes(types: readonly string[]): [PokemonType] | [PokemonType, PokemonType] {
  if (types.length === 1) return [types[0] as PokemonType];
  return [types[0] as PokemonType, types[1] as PokemonType];
}

function mapStats(stats: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number }): StatsTable {
  return {
    hp: stats.hp,
    atk: stats.atk,
    def: stats.def,
    spa: stats.spa,
    spd: stats.spd,
    spe: stats.spe,
  };
}

export function getSpecies(id: string): PokemonSpecies | null {
  const species = dex.species.get(id);
  if (!species || !species.exists) return null;
  return {
    id: species.id,
    name: species.name,
    num: species.num,
    types: mapTypes(species.types),
    baseStats: mapStats(species.baseStats),
    abilities: { ...species.abilities } as Record<string, string>,
    weightkg: species.weightkg,
    tier: species.tier,
  };
}

/**
 * Returns true if a forme is purely cosmetic (same stats/abilities/types as its base form).
 * Examples: Pikachu caps, Vivillon patterns, Alcremie flavors, Deerling seasons.
 */
function isCosmeticForme(species: ReturnType<typeof dex.species.get>): boolean {
  if (!species.forme || species.changesFrom || species.battleOnly) return false;
  const base = dex.species.get(species.baseSpecies);
  if (!base || !base.exists) return false;
  return (
    JSON.stringify(species.baseStats) === JSON.stringify(base.baseStats) &&
    JSON.stringify(species.abilities) === JSON.stringify(base.abilities) &&
    JSON.stringify(species.types) === JSON.stringify(base.types)
  );
}

export function getAllSpecies(): PokemonSpecies[] {
  const all: PokemonSpecies[] = [];
  for (const species of dex.species.all()) {
    if (
      species.exists &&
      species.num > 0 &&
      !species.isNonstandard &&
      !species.battleOnly &&
      !isCosmeticForme(species)
    ) {
      all.push({
        id: species.id,
        name: species.name,
        num: species.num,
        types: mapTypes(species.types),
        baseStats: mapStats(species.baseStats),
        abilities: { ...species.abilities } as Record<string, string>,
        weightkg: species.weightkg,
        tier: species.tier,
      });
    }
  }
  return all;
}

export function getMove(id: string): MoveData | null {
  const move = dex.moves.get(id);
  if (!move || !move.exists) return null;
  return {
    id: move.id,
    name: move.name,
    type: move.type as PokemonType,
    category: move.category,
    basePower: move.basePower,
    accuracy: move.accuracy,
    pp: move.pp,
    priority: move.priority,
    target: move.target,
    flags: { ...move.flags } as Record<string, number>,
    description: move.shortDesc || move.desc,
  };
}

export function getAllMoves(): MoveData[] {
  const all: MoveData[] = [];
  for (const move of dex.moves.all()) {
    if (move.exists && !move.isNonstandard) {
      all.push({
        id: move.id,
        name: move.name,
        type: move.type as PokemonType,
        category: move.category,
        basePower: move.basePower,
        accuracy: move.accuracy,
        pp: move.pp,
        priority: move.priority,
        target: move.target,
        flags: { ...move.flags } as Record<string, number>,
        description: move.shortDesc || move.desc,
      });
    }
  }
  return all;
}

export function getAbility(id: string): AbilityData | null {
  const ability = dex.abilities.get(id);
  if (!ability || !ability.exists) return null;
  return {
    id: ability.id,
    name: ability.name,
    description: ability.shortDesc || ability.desc,
  };
}

export function getItem(id: string): ItemData | null {
  const item = dex.items.get(id);
  if (!item || !item.exists) return null;
  return {
    id: item.id,
    name: item.name,
    description: item.shortDesc || item.desc,
  };
}

export async function getLearnset(speciesId: string): Promise<string[]> {
  const learnsetData = await dex.learnsets.get(speciesId);
  if (!learnsetData || !learnsetData.learnset) return [];
  return Object.keys(learnsetData.learnset);
}

export function searchSpecies(query: string): PokemonSpecies[] {
  const lower = query.toLowerCase();
  return getAllSpecies().filter((s) => s.name.toLowerCase().includes(lower));
}

export function getAllItems(): ItemData[] {
  const all: ItemData[] = [];
  for (const item of dex.items.all()) {
    if (item.exists && !item.isNonstandard) {
      all.push({
        id: item.id,
        name: item.name,
        description: item.shortDesc || item.desc,
      });
    }
  }
  return all;
}

export function searchItems(query: string): ItemData[] {
  const lower = query.toLowerCase();
  return getAllItems().filter((i) => i.name.toLowerCase().includes(lower));
}

export function getTypeChart(): Record<PokemonType, Partial<Record<PokemonType, number>>> {
  const chart = {} as Record<PokemonType, Partial<Record<PokemonType, number>>>;
  const types: PokemonType[] = [
    "Normal", "Fire", "Water", "Electric", "Grass", "Ice",
    "Fighting", "Poison", "Ground", "Flying", "Psychic", "Bug",
    "Rock", "Ghost", "Dragon", "Dark", "Steel", "Fairy",
  ];

  for (const atkType of types) {
    const partial: Partial<Record<PokemonType, number>> = {};
    for (const defType of types) {
      const effectiveness = dex.types.get(atkType).damageTaken[defType];
      // @pkmn/dex damageTaken: 0 = normal, 1 = super effective (2x), 2 = resist (0.5x), 3 = immune (0x)
      if (effectiveness === 1) partial[defType] = 2;
      else if (effectiveness === 2) partial[defType] = 0.5;
      else if (effectiveness === 3) partial[defType] = 0;
    }
    chart[atkType] = partial;
  }

  return chart;
}
