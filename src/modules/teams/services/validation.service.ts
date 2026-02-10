import { MAX_SINGLE_EV, MAX_TOTAL_EVS } from "@/shared/constants";
import type { TeamData } from "@/shared/types";
import { getTotalEvs } from "@/shared/lib/stat-calc";

interface ValidationError {
  field: string;
  message: string;
}

export function validateTeam(team: TeamData): {
  valid: boolean;
  errors: ValidationError[];
} {
  const errors: ValidationError[] = [];

  // Species clause: no duplicate pokemonId
  const seenSpecies = new Set<string>();
  for (const slot of team.slots) {
    if (seenSpecies.has(slot.pokemonId)) {
      errors.push({
        field: `slot.${slot.position}.pokemonId`,
        message: `Duplicate species: ${slot.pokemonId}`,
      });
    }
    seenSpecies.add(slot.pokemonId);
  }

  // Item clause: no duplicate items (skip empty items)
  const seenItems = new Set<string>();
  for (const slot of team.slots) {
    if (slot.item && slot.item.trim() !== "") {
      if (seenItems.has(slot.item)) {
        errors.push({
          field: `slot.${slot.position}.item`,
          message: `Duplicate item: ${slot.item}`,
        });
      }
      seenItems.add(slot.item);
    }
  }

  // Per-slot validation
  for (const slot of team.slots) {
    // EV total <= 510
    const evTotal = getTotalEvs(slot.evs);
    if (evTotal > MAX_TOTAL_EVS) {
      errors.push({
        field: `slot.${slot.position}.evs`,
        message: `EV total (${evTotal}) exceeds maximum of ${MAX_TOTAL_EVS}`,
      });
    }

    // Each EV 0-252
    for (const [stat, value] of Object.entries(slot.evs)) {
      if (value < 0 || value > MAX_SINGLE_EV) {
        errors.push({
          field: `slot.${slot.position}.evs.${stat}`,
          message: `${stat} EVs (${value}) must be between 0 and ${MAX_SINGLE_EV}`,
        });
      }
    }

    // Must have at least one move
    if (!slot.moves[0]) {
      errors.push({
        field: `slot.${slot.position}.moves`,
        message: "Must have at least one move",
      });
    }

    // Must have a Pokemon selected
    if (!slot.pokemonId) {
      errors.push({
        field: `slot.${slot.position}.pokemonId`,
        message: "Must select a Pokemon",
      });
    }
  }

  return { valid: errors.length === 0, errors };
}
