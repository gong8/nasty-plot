import type { AIPlayer, BattleState, BattleActionSet, BattleAction, BattleFormat } from "../types";

/**
 * RandomAI picks a uniformly random legal action.
 * This is the simplest AI - useful as a baseline and for testing.
 */
export class RandomAI implements AIPlayer {
  readonly difficulty = "random" as const;

  async chooseAction(
    _state: BattleState,
    actions: BattleActionSet
  ): Promise<BattleAction> {
    if (actions.forceSwitch) {
      // Must switch - pick a random non-fainted Pokemon
      const available = actions.switches.filter((s) => !s.fainted);
      if (available.length === 0) {
        // No switches available, shouldn't happen but fallback
        return { type: "switch", pokemonIndex: actions.switches[0]?.index || 1 };
      }
      const pick = available[Math.floor(Math.random() * available.length)];
      return { type: "switch", pokemonIndex: pick.index };
    }

    // Build all possible actions
    const possibleActions: BattleAction[] = [];

    // Add enabled moves
    for (let i = 0; i < actions.moves.length; i++) {
      if (!actions.moves[i].disabled) {
        possibleActions.push({
          type: "move",
          moveIndex: i + 1,
        });
      }
    }

    // Add available switches
    for (const sw of actions.switches) {
      if (!sw.fainted) {
        possibleActions.push({
          type: "switch",
          pokemonIndex: sw.index,
        });
      }
    }

    if (possibleActions.length === 0) {
      // Fallback: use first move (Struggle)
      return { type: "move", moveIndex: 1 };
    }

    return possibleActions[Math.floor(Math.random() * possibleActions.length)];
  }

  chooseLeads(teamSize: number, gameType: BattleFormat): number[] {
    // Random lead order
    const order = Array.from({ length: teamSize }, (_, i) => i + 1);
    // Fisher-Yates shuffle
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
  }
}
