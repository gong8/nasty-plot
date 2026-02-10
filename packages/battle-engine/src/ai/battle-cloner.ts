/**
 * Battle Cloner — utilities for cloning @pkmn/sim Battle instances.
 *
 * Key discovery: @pkmn/sim's Battle supports toJSON()/fromJSON() for
 * full serialization, and Battle.choose()/makeChoices() for direct
 * turn execution without BattleStream.
 */

import { Battle } from "@pkmn/sim";

/**
 * Clone a @pkmn/sim Battle by serializing + deserializing.
 * The clone is a fully independent copy that can be advanced independently.
 */
export function cloneBattle(battle: Battle): Battle {
  const json = battle.toJSON();
  return Battle.fromJSON(json);
}

/**
 * Apply choices for both players and advance the battle by one turn.
 * Returns the same battle instance (mutated).
 *
 * Choices are in @pkmn/sim format: "move 1", "switch 3", etc.
 */
export function applyChoices(
  battle: Battle,
  p1Choice: string,
  p2Choice: string,
): Battle {
  battle.choose("p1", p1Choice);
  battle.choose("p2", p2Choice);
  return battle;
}

/**
 * Get legal choices for a side from a Battle instance.
 *
 * Returns an array of choice strings like ["move 1", "move 2", "switch 3"].
 */
export function getLegalChoices(
  battle: Battle,
  side: "p1" | "p2",
): string[] {
  // `request` exists at runtime but isn't in @pkmn/sim's type declarations
  const sideObj = battle[side] as unknown as Record<string, unknown>;
  const request = sideObj.request as {
    wait?: boolean;
    forceSwitch?: boolean[];
    active?: { moves: { disabled?: boolean }[] }[];
  } | null;
  if (!request || request.wait) return [];

  const choices: string[] = [];
  const sideTyped = battle[side];

  if (request.forceSwitch) {
    // Must switch
    const pokemon = sideTyped.pokemon;
    for (let i = 0; i < pokemon.length; i++) {
      if (!pokemon[i].fainted && pokemon[i] !== sideTyped.active[0]) {
        choices.push(`switch ${i + 1}`);
      }
    }
    return choices.length > 0 ? choices : ["default"];
  }

  // Normal turn: moves + switches
  const active = request.active?.[0];
  if (active) {
    for (let i = 0; i < active.moves.length; i++) {
      if (!active.moves[i].disabled) {
        choices.push(`move ${i + 1}`);
      }
    }
  }

  // Switches
  const pokemon = sideTyped.pokemon;
  for (let i = 0; i < pokemon.length; i++) {
    if (!pokemon[i].fainted && pokemon[i] !== sideTyped.active[0]) {
      choices.push(`switch ${i + 1}`);
    }
  }

  return choices.length > 0 ? choices : ["default"];
}

/**
 * Check if the battle has ended.
 */
export function isBattleOver(battle: Battle): boolean {
  return battle.ended;
}

/**
 * Get the winner of a finished battle.
 * Returns "p1", "p2", or null if not ended / draw.
 */
export function getBattleWinner(battle: Battle): "p1" | "p2" | null {
  if (!battle.ended) return null;
  if (battle.winner === battle.p1.name) return "p1";
  if (battle.winner === battle.p2.name) return "p2";
  return null;
}
