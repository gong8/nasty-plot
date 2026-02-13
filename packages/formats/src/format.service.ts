import type { FormatDefinition, ItemData, MoveData, PokemonSpecies } from "@nasty-plot/core"
import {
  getAllItems,
  getAllMoves,
  getAllSpecies,
  getLearnset,
  getSpecies,
} from "@nasty-plot/pokemon-data"

import { FORMAT_DEFINITIONS } from "./data/format-definitions"
import { resolveFormatId } from "./resolver"

function buildBanSet(format: FormatDefinition): Set<string> {
  return new Set(format.bans.map((b) => b.toLowerCase()))
}

function isPastGenExcluded(format: FormatDefinition, isNonstandard: string | null): boolean {
  return format.dexScope === "sv" && isNonstandard === "Past"
}

function isBanned(species: PokemonSpecies, format: FormatDefinition, banSet: Set<string>): boolean {
  if (banSet.has(species.name.toLowerCase())) return true
  if (banSet.has(species.id.toLowerCase())) return true
  if (species.tier && banSet.has(species.tier.toLowerCase())) return true
  if (format.id === "gen9lc" && species.tier !== "LC") return true
  return false
}

function isNameOrIdBanned(
  entry: { name: string; id: string; isNonstandard: string | null },
  format: FormatDefinition,
  banSet: Set<string>,
): boolean {
  if (isPastGenExcluded(format, entry.isNonstandard)) return true
  if (banSet.has(entry.name.toLowerCase())) return true
  if (banSet.has(entry.id.toLowerCase())) return true
  return false
}

export function getFormat(id: string): FormatDefinition | null {
  const resolvedId = resolveFormatId(id)
  if (!resolvedId) return null
  return FORMAT_DEFINITIONS.find((f) => f.id === resolvedId) ?? null
}

export function getAllFormats(): FormatDefinition[] {
  return FORMAT_DEFINITIONS
}

export function getActiveFormats(): FormatDefinition[] {
  return FORMAT_DEFINITIONS.filter((f) => f.isActive)
}

export function getFormatPokemon(formatId: string): PokemonSpecies[] {
  const format = getFormat(formatId)
  if (!format) return []

  const banSet = buildBanSet(format)
  return getAllSpecies().filter((species) => {
    if (isPastGenExcluded(format, species.isNonstandard)) return false
    return !isBanned(species, format, banSet)
  })
}

export function isLegalInFormat(pokemonId: string, formatId: string): boolean {
  const format = getFormat(formatId)
  if (!format) return false

  const species = getSpecies(pokemonId)
  if (!species) return false

  if (isPastGenExcluded(format, species.isNonstandard)) return false
  return !isBanned(species, format, buildBanSet(format))
}

export function getFormatItems(formatId: string): ItemData[] {
  const format = getFormat(formatId)
  if (!format) return []

  const banSet = buildBanSet(format)
  return getAllItems().filter((item) => !isNameOrIdBanned(item, format, banSet))
}

export function getFormatMoves(formatId: string): MoveData[] {
  const format = getFormat(formatId)
  if (!format) return []

  const banSet = buildBanSet(format)
  return getAllMoves().filter((move) => !isNameOrIdBanned(move, format, banSet))
}

export async function getFormatLearnset(speciesId: string, formatId: string): Promise<string[]> {
  const format = getFormat(formatId)
  if (!format) return []

  const learnset = await getLearnset(speciesId)
  const legalMoves = new Set(getFormatMoves(formatId).map((m) => m.id))
  return learnset.filter((moveId) => legalMoves.has(moveId))
}
