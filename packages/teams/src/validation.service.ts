import { validateTeam as coreValidateTeam } from "@nasty-plot/core";
import {
  isMegaStone,
  getMegaStonesFor,
  isZCrystal,
  getZCrystalType,
  getSignatureZCrystal,
  getMove,
} from "@nasty-plot/pokemon-data";
import type { TeamData, TeamSlotData } from "@nasty-plot/core";

interface ValidationError {
  field: string;
  message: string;
}

function validateMegaStones(
  team: TeamData,
  errors: ValidationError[]
): void {
  // One Mega per team
  const megaSlots = team.slots.filter(
    (slot) => slot.item && isMegaStone(slot.item)
  );
  if (megaSlots.length > 1) {
    for (const slot of megaSlots) {
      errors.push({
        field: `slot.${slot.position}.item`,
        message: "Only one Mega Evolution allowed per team",
      });
    }
  }

  // Mega Stone compatibility per slot
  for (const slot of team.slots) {
    if (!slot.item || !isMegaStone(slot.item)) continue;
    const validStones = getMegaStonesFor(slot.pokemonId);
    const isCompatible = validStones.some((s) => s.id === slot.item);
    if (!isCompatible) {
      errors.push({
        field: `slot.${slot.position}.item`,
        message: `${slot.item} is not compatible with ${slot.pokemonId}`,
      });
    }
  }
}

function validateZCrystal(
  slot: TeamSlotData,
  errors: ValidationError[]
): void {
  if (!slot.item || !isZCrystal(slot.item)) return;

  const signature = getSignatureZCrystal(slot.item);
  if (signature) {
    // Signature Z-Crystal: check species and move
    if (slot.pokemonId !== signature.pokemonId) {
      errors.push({
        field: `slot.${slot.position}.item`,
        message: `${slot.item} can only be held by ${signature.pokemonId}`,
      });
    }
    const knownMoves = slot.moves.filter(Boolean) as string[];
    if (!knownMoves.includes(signature.moveId)) {
      errors.push({
        field: `slot.${slot.position}.item`,
        message: `${slot.item} requires the move ${signature.moveId}`,
      });
    }
    return;
  }

  const zType = getZCrystalType(slot.item);
  if (zType) {
    // Type-based Z-Crystal: check that at least one move matches the type
    const knownMoves = slot.moves.filter(Boolean) as string[];
    const hasMatchingMove = knownMoves.some((moveId) => {
      const move = getMove(moveId);
      return move !== null && move.type === zType;
    });
    if (!hasMatchingMove) {
      errors.push({
        field: `slot.${slot.position}.item`,
        message: `${slot.item} requires at least one ${zType}-type move`,
      });
    }
  }
}

export function validateTeam(team: TeamData): {
  valid: boolean;
  errors: ValidationError[];
} {
  const result = coreValidateTeam(team);

  // Mega Stone validation (team-level + per-slot compatibility)
  validateMegaStones(team, result.errors);

  // Z-Crystal validation for each slot
  for (const slot of team.slots) {
    validateZCrystal(slot, result.errors);
  }

  return { valid: result.errors.length === 0, errors: result.errors };
}
