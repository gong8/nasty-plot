import type { FormatDefinition, PokemonSpecies } from "@nasty-plot/core";
import { FORMAT_DEFINITIONS } from "./data/format-definitions";
import { getAllSpecies, getSpecies } from "@nasty-plot/pokemon-data";

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

  const allSpecies = getAllSpecies();
  const banSet = new Set(format.bans.map((b) => b.toLowerCase()));

  return allSpecies.filter((species) => {
    // Check direct name ban
    if (banSet.has(species.name.toLowerCase())) return false;
    if (banSet.has(species.id.toLowerCase())) return false;

    // Check tier-based bans (e.g. "OU", "UUBL" in the bans list means exclude those tiers)
    if (species.tier && banSet.has(species.tier.toLowerCase())) return false;

    // For SV scope, only include Pokemon available in Gen 9
    // The dex already filters to Gen 9, so all species from getAllSpecies() are valid

    // For LC, only include basic-stage Pokemon at level 5
    if (format.id === "gen9lc") {
      // LC requires Pokemon that can still evolve (NFE) or are baby Pokemon
      if (species.tier !== "LC") return false;
    }

    return true;
  });
}

export function isLegalInFormat(pokemonId: string, formatId: string): boolean {
  const format = getFormat(formatId);
  if (!format) return false;

  const species = getSpecies(pokemonId);
  if (!species) return false;

  const banSet = new Set(format.bans.map((b) => b.toLowerCase()));

  if (banSet.has(species.name.toLowerCase())) return false;
  if (banSet.has(species.id.toLowerCase())) return false;
  if (species.tier && banSet.has(species.tier.toLowerCase())) return false;

  if (format.id === "gen9lc" && species.tier !== "LC") return false;

  return true;
}
