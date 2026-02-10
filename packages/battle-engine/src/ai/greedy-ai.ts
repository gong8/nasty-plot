import { Generations } from "@pkmn/data";
import { Dex } from "@pkmn/dex";
import { calculate, Pokemon, Move, Field } from "@smogon/calc";
import type { AIPlayer, BattleState, BattleActionSet, BattleAction, BattleFormat } from "../types";
import { flattenDamage, fallbackMove, pickHealthiestSwitch } from "./shared";

const gens = new Generations(Dex);
const gen = gens.get(9);

/**
 * GreedyAI picks the move that deals the most damage to the opponent.
 * If all moves are resisted/weak, it may switch to a better matchup.
 */
export class GreedyAI implements AIPlayer {
  readonly difficulty = "greedy" as const;

  async chooseAction(
    state: BattleState,
    actions: BattleActionSet
  ): Promise<BattleAction> {
    if (actions.forceSwitch) {
      return pickHealthiestSwitch(actions);
    }

    const activePokemon = state.sides.p2.active[0];
    const opponentPokemon = state.sides.p1.active[0];

    if (!activePokemon || !opponentPokemon) {
      return fallbackMove(actions);
    }

    let bestDamage = -1;
    let bestMoveIndex = -1;

    for (let i = 0; i < actions.moves.length; i++) {
      const move = actions.moves[i];
      if (move.disabled) continue;

      try {
        const attacker = new Pokemon(gen, activePokemon.name, {
          level: activePokemon.level,
          ability: activePokemon.ability || undefined,
          item: activePokemon.item || undefined,
        });

        const defender = new Pokemon(gen, opponentPokemon.name, {
          level: opponentPokemon.level,
          ability: opponentPokemon.ability || undefined,
          item: opponentPokemon.item || undefined,
          curHP: opponentPokemon.hp,
        });

        const calcMove = new Move(gen, move.name);
        const result = calculate(gen, attacker, defender, calcMove, new Field());

        const damage = flattenDamage(result.damage);
        const avgDamage = damage.reduce((a, b) => a + b, 0) / damage.length;

        if (avgDamage > bestDamage) {
          bestDamage = avgDamage;
          bestMoveIndex = i;
        }
      } catch {
        // Move calc failed (status move etc.), treat as 0 damage
      }
    }

    // If best damage is very low, consider switching
    if (bestDamage < 20 && actions.switches.length > 0) {
      const switchAction = pickHealthiestSwitch(actions);
      if (switchAction.type === "switch") {
        return switchAction;
      }
    }

    if (bestMoveIndex >= 0) {
      return { type: "move", moveIndex: bestMoveIndex + 1 };
    }

    return fallbackMove(actions);
  }

  chooseLeads(teamSize: number, _gameType: BattleFormat): number[] {
    return Array.from({ length: teamSize }, (_, i) => i + 1);
  }
}
