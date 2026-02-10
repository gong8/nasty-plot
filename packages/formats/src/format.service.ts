import type { FormatDefinition, PokemonSpecies } from "@nasty-plot/core";
import { getAllSpecies, getSpecies } from "@nasty-plot/pokemon-data";

import { FORMAT_DEFINITIONS } from "./data/format-definitions";

function buildBanSet(format: FormatDefinition): Set<string> {
  return new Set(format.bans.map((b) => b.toLowerCase()));
}

function isBanned(species: PokemonSpecies, format: FormatDefinition, banSet: Set<string>): boolean {
  if (banSet.has(species.name.toLowerCase())) return true;
  if (banSet.has(species.id.toLowerCase())) return true;
  if (species.tier && banSet.has(species.tier.toLowerCase())) return true;
  if (format.id === "gen9lc" && species.tier !== "LC") return true;
  return false;
}

export function getFormat(id: string): FormatDefinition | null {
  return FORMAT_DEFINITIONS.find((f) => f.id === id) ?? null;
}

export function getAllFormats(): FormatDefinition[] {
  return FORMAT_DEFINITIONS;
}

export function getActiveFormats(): FormatDefinition[] {
  return FORMAT_DEFINITIONS.filter((f) => f.isActive);
}

export function getFormatPokemon(formatId: string): PokemonSpecies[] {
  const format = getFormat(formatId);
  if (!format) return [];

  const banSet = buildBanSet(format);
  return getAllSpecies().filter((species) => !isBanned(species, format, banSet));
}

export function isLegalInFormat(pokemonId: string, formatId: string): boolean {
  const format = getFormat(formatId);
  if (!format) return false;

  const species = getSpecies(pokemonId);
  if (!species) return false;

  return !isBanned(species, format, buildBanSet(format));
}
