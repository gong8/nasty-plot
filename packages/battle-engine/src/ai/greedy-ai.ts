import { Generations } from "@pkmn/data";
import { Dex } from "@pkmn/dex";
import { calculate, Pokemon, Move, Field } from "@smogon/calc";
import type { AIPlayer, BattleState, BattleActionSet, BattleAction, BattleFormat } from "../types";

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
      return this.chooseBestSwitch(state, actions);
    }

    // Calculate damage for each available move
    const activePokemon = state.sides.p2.active[0];
    const opponentPokemon = state.sides.p1.active[0];

    if (!activePokemon || !opponentPokemon) {
      // Fallback to random
      const enabledMoves = actions.moves.filter((m) => !m.disabled);
      if (enabledMoves.length > 0) {
        const idx = actions.moves.indexOf(enabledMoves[0]);
        return { type: "move", moveIndex: idx + 1 };
      }
      return { type: "move", moveIndex: 1 };
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
        const field = new Field();
        const result = calculate(gen, attacker, defender, calcMove, field);

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
      const switchAction = this.chooseBestSwitch(state, actions);
      if (switchAction.type === "switch") {
        return switchAction;
      }
    }

    if (bestMoveIndex >= 0) {
      return { type: "move", moveIndex: bestMoveIndex + 1 };
    }

    // Fallback: first non-disabled move
    const firstEnabled = actions.moves.findIndex((m) => !m.disabled);
    return { type: "move", moveIndex: (firstEnabled >= 0 ? firstEnabled : 0) + 1 };
  }

  private chooseBestSwitch(state: BattleState, actions: BattleActionSet): BattleAction {
    const available = actions.switches.filter((s) => !s.fainted);
    if (available.length === 0) {
      return { type: "move", moveIndex: 1 };
    }

    // Pick the switch with the most HP
    const best = available.reduce((a, b) =>
      (a.hp / a.maxHp) > (b.hp / b.maxHp) ? a : b
    );
    return { type: "switch", pokemonIndex: best.index };
  }

  chooseLeads(teamSize: number, _gameType: BattleFormat): number[] {
    // Lead with first Pokemon (typically the team's intended lead)
    return Array.from({ length: teamSize }, (_, i) => i + 1);
  }
}

function flattenDamage(damage: number | number[] | number[][]): number[] {
  if (typeof damage === "number") return [damage];
  if (Array.isArray(damage) && damage.length > 0) {
    if (Array.isArray(damage[0])) {
      return (damage as number[][])[0];
    }
    return damage as number[];
  }
  return [0];
}
