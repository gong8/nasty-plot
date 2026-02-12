import { Dex } from "@pkmn/dex"
import { Generations, type Generation } from "@pkmn/data"
import { POKEMON_TYPES } from "@nasty-plot/core"
import type { PokemonSpecies, PokemonType, MoveData, AbilityData, ItemData } from "@nasty-plot/core"

const dex = Dex.forGen(9)

function toID(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "")
}

/** Nonstandard categories to exclude from all listings (CAP fakemons, LGPE exclusives, etc.) */
const EXCLUDED_NONSTANDARD = new Set(["CAP", "LGPE", "Custom", "Future", "Unobtainable"])

export function getDex() {
  return dex
}

function mapTypes(types: readonly string[]): [PokemonType] | [PokemonType, PokemonType] {
  if (types.length === 1) return [types[0] as PokemonType]
  return [types[0] as PokemonType, types[1] as PokemonType]
}

function toSpecies(species: ReturnType<typeof dex.species.get>): PokemonSpecies {
  return {
    id: species.id,
    name: species.name,
    num: species.num,
    types: mapTypes(species.types),
    baseStats: { ...species.baseStats },
    abilities: { ...species.abilities } as Record<string, string>,
    weightkg: species.weightkg,
    tier: species.tier,
    isNonstandard: species.isNonstandard ?? null,
  }
}

export function getSpecies(id: string): PokemonSpecies | null {
  const species = dex.species.get(id)
  if (!species || !species.exists) return null
  return toSpecies(species)
}

/**
 * Returns true if a forme is purely cosmetic (same stats/abilities/types as its base form).
 * Examples: Pikachu caps, Vivillon patterns, Alcremie flavors, Deerling seasons.
 */
function isCosmeticForme(species: ReturnType<typeof dex.species.get>): boolean {
  if (!species.forme || species.changesFrom || species.battleOnly) return false
  const base = dex.species.get(species.baseSpecies)
  if (!base || !base.exists) return false
  return (
    JSON.stringify(species.baseStats) === JSON.stringify(base.baseStats) &&
    JSON.stringify(species.abilities) === JSON.stringify(base.abilities) &&
    JSON.stringify(species.types) === JSON.stringify(base.types)
  )
}

export function getAllSpecies(): PokemonSpecies[] {
  const all: PokemonSpecies[] = []
  for (const species of dex.species.all()) {
    if (
      species.exists &&
      species.num > 0 &&
      !EXCLUDED_NONSTANDARD.has(species.isNonstandard as string) &&
      !species.battleOnly &&
      !isCosmeticForme(species)
    ) {
      all.push(toSpecies(species))
    }
  }
  return all
}

function toMove(move: ReturnType<typeof dex.moves.get>): MoveData {
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
    isNonstandard: move.isNonstandard ?? null,
  }
}

export function getMove(id: string): MoveData | null {
  const move = dex.moves.get(id)
  if (!move || !move.exists) return null
  return toMove(move)
}

export function getAllMoves(): MoveData[] {
  const all: MoveData[] = []
  for (const move of dex.moves.all()) {
    if (move.exists && !EXCLUDED_NONSTANDARD.has(move.isNonstandard as string)) {
      all.push(toMove(move))
    }
  }
  return all
}

export function getAbility(id: string): AbilityData | null {
  const ability = dex.abilities.get(id)
  if (!ability || !ability.exists) return null
  return {
    id: ability.id,
    name: ability.name,
    description: ability.shortDesc || ability.desc,
  }
}

export function getItem(id: string): ItemData | null {
  const item = dex.items.get(id)
  if (!item || !item.exists) return null
  return {
    id: item.id,
    name: item.name,
    description: item.shortDesc || item.desc,
    isNonstandard: item.isNonstandard ?? null,
  }
}

export async function getLearnset(speciesId: string): Promise<string[]> {
  // Try exact ID first
  const learnsetData = await dex.learnsets.get(speciesId)
  if (learnsetData?.learnset) return Object.keys(learnsetData.learnset)

  // Alternate forms (Gmax, Mega, Therian, etc.) don't have their own learnsets
  // in @pkmn/dex — walk the inheritance chain: changesFrom → baseSpecies
  const species = dex.species.get(speciesId)
  if (!species.exists) return []

  if (species.changesFrom) {
    const parent = Array.isArray(species.changesFrom) ? species.changesFrom[0] : species.changesFrom
    const parentData = await dex.learnsets.get(toID(parent))
    if (parentData?.learnset) return Object.keys(parentData.learnset)
  }

  if (species.baseSpecies && species.baseSpecies !== species.name) {
    const baseData = await dex.learnsets.get(toID(species.baseSpecies))
    if (baseData?.learnset) return Object.keys(baseData.learnset)
  }

  return []
}

export function searchSpecies(query: string): PokemonSpecies[] {
  const lower = query.toLowerCase()
  return getAllSpecies().filter((s) => s.name.toLowerCase().includes(lower))
}

export function getAllItems(): ItemData[] {
  const all: ItemData[] = []
  for (const item of dex.items.all()) {
    if (item.exists && !EXCLUDED_NONSTANDARD.has(item.isNonstandard as string)) {
      all.push({
        id: item.id,
        name: item.name,
        description: item.shortDesc || item.desc,
        isNonstandard: item.isNonstandard ?? null,
      })
    }
  }
  return all
}

export function searchItems(query: string): ItemData[] {
  const lower = query.toLowerCase()
  return getAllItems().filter((i) => i.name.toLowerCase().includes(lower))
}

/** Check if an item is a Mega Stone */
export function isMegaStone(itemId: string): boolean {
  if (!itemId) return false
  const item = dex.items.get(itemId)
  return item.exists && !!item.megaStone
}

/** Get all valid Mega Stones for a given Pokemon */
export function getMegaStonesFor(pokemonId: string): ItemData[] {
  const species = dex.species.get(pokemonId)
  if (!species || !species.exists) return []
  const baseName = species.baseSpecies || species.name
  const result: ItemData[] = []
  for (const item of dex.items.all()) {
    if (
      item.megaStone &&
      baseName in item.megaStone &&
      !EXCLUDED_NONSTANDARD.has(item.isNonstandard as string)
    ) {
      result.push({
        id: item.id,
        name: item.name,
        description: item.shortDesc || item.desc,
        isNonstandard: item.isNonstandard ?? null,
      })
    }
  }
  return result
}

/** Get the Mega form a Pokemon transforms into when holding a specific Mega Stone */
export function getMegaForm(pokemonId: string, itemId: string): PokemonSpecies | null {
  const item = dex.items.get(itemId)
  if (!item.exists || !item.megaStone) return null
  const species = dex.species.get(pokemonId)
  if (!species || !species.exists) return null
  const baseName = species.baseSpecies || species.name
  const megaFormName = item.megaStone[baseName]
  if (!megaFormName) return null
  const megaSpecies = dex.species.get(megaFormName)
  if (!megaSpecies || !megaSpecies.exists) return null
  return toSpecies(megaSpecies)
}

/** Check if an item is a Z-Crystal */
export function isZCrystal(itemId: string): boolean {
  const item = dex.items.get(itemId)
  return item.exists && item.zMove !== undefined
}

/** Get the type a Z-Crystal powers up (e.g., "Electrium Z" → "Electric"). Returns null for signature Z-Crystals. */
export function getZCrystalType(itemId: string): PokemonType | null {
  const item = dex.items.get(itemId)
  if (!item.exists || !item.zMove) return null
  // Type-based Z-Crystals have zMove === true and zMoveType set
  if (item.zMove === true && item.zMoveType) {
    return item.zMoveType as PokemonType
  }
  return null
}

/** Get signature Z-Crystal info (e.g., "Pikanium Z" → { pokemonId, moveId }). Returns null for type-based Z-Crystals. */
export function getSignatureZCrystal(itemId: string): { pokemonId: string; moveId: string } | null {
  const item = dex.items.get(itemId)
  if (!item.exists || !item.zMove) return null
  // Signature Z-Crystals have zMove as a string (the Z-Move name),
  // zMoveFrom (source move display name), and itemUser (species display names)
  if (typeof item.zMove === "string" && item.zMoveFrom && item.itemUser?.[0]) {
    const species = dex.species.get(item.itemUser[0])
    const move = dex.moves.get(item.zMoveFrom)
    return {
      pokemonId: species.id,
      moveId: move.id,
    }
  }
  return null
}

// Lazy gen9 instance for @smogon/calc consumers
let _gen9: Generation | null = null
export function getGen9() {
  if (!_gen9) {
    _gen9 = new Generations(Dex).get(9)
  }
  return _gen9
}

/** Raw Dex move access — use when you need fields not in MoveData (e.g. .flags, .secondary, .target) */
export function getRawMove(nameOrId: string) {
  return dex.moves.get(nameOrId)
}

/** Raw Dex species access — use when you need fields not in PokemonSpecies (e.g. .exists, .baseSpecies) */
export function getRawSpecies(nameOrId: string) {
  return dex.species.get(nameOrId)
}

/** Raw Dex type access — use for damageTaken lookups */
export function getType(name: string) {
  return dex.types.get(name)
}

/** Resolve a pokemonId to a display name (e.g. "greatTusk" → "Great Tusk") */
export function resolveSpeciesName(pokemonId: string): string {
  const species = dex.species.get(pokemonId)
  if (species?.exists) return species.name
  return pokemonId.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (s) => s.toUpperCase())
}

export function getTypeChart(): Record<PokemonType, Partial<Record<PokemonType, number>>> {
  const chart = {} as Record<PokemonType, Partial<Record<PokemonType, number>>>

  for (const atkType of POKEMON_TYPES) {
    const partial: Partial<Record<PokemonType, number>> = {}
    for (const defType of POKEMON_TYPES) {
      const effectiveness = dex.types.get(atkType).damageTaken[defType]
      // @pkmn/dex damageTaken: 0 = normal, 1 = super effective (2x), 2 = resist (0.5x), 3 = immune (0x)
      if (effectiveness === 1) partial[defType] = 2
      else if (effectiveness === 2) partial[defType] = 0.5
      else if (effectiveness === 3) partial[defType] = 0
    }
    chart[atkType] = partial
  }

  return chart
}
