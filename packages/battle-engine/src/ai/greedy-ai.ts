import { Generations } from "@pkmn/data"
import { Dex } from "@pkmn/dex"
import { calculate, Pokemon, Move, Field } from "@smogon/calc"
import type { AIPlayer, BattleState, BattleActionSet, BattleAction, BattleFormat } from "../types"
import { flattenDamage, fallbackMove, pickHealthiestSwitch } from "./shared"

const gens = new Generations(Dex)
const gen = gens.get(9)

/**
 * GreedyAI picks the move that deals the most damage to the opponent.
 * If all moves are resisted/weak, it may switch to a better matchup.
 */
export class GreedyAI implements AIPlayer {
  readonly difficulty = "greedy" as const

  async chooseAction(state: BattleState, actions: BattleActionSet): Promise<BattleAction> {
    if (actions.forceSwitch) {
      return pickHealthiestSwitch(actions)
    }

    const activeSlot = actions.activeSlot ?? 0
    const activePokemon = state.sides.p2.active[activeSlot]
    const isDoubles = state.format === "doubles"

    // In doubles, consider all opponent active slots as targets
    const opponentActives = isDoubles
      ? state.sides.p1.active.filter((p): p is NonNullable<typeof p> => p != null && !p.fainted)
      : [state.sides.p1.active[0]].filter((p): p is NonNullable<typeof p> => p != null)

    if (!activePokemon || opponentActives.length === 0) {
      return fallbackMove(actions)
    }

    let bestDamage = -1
    let bestMoveIndex = -1
    let bestTargetSlot: number | undefined

    for (let i = 0; i < actions.moves.length; i++) {
      const move = actions.moves[i]
      if (move.disabled) continue

      // For each move, evaluate against each possible target
      for (let t = 0; t < opponentActives.length; t++) {
        const opponentPokemon = opponentActives[t]

        try {
          const attacker = new Pokemon(gen, activePokemon.name, {
            level: activePokemon.level,
            ability: activePokemon.ability || undefined,
            item: activePokemon.item || undefined,
          })

          const defender = new Pokemon(gen, opponentPokemon.name, {
            level: opponentPokemon.level,
            ability: opponentPokemon.ability || undefined,
            item: opponentPokemon.item || undefined,
            curHP: opponentPokemon.hp,
          })

          const calcMove = new Move(gen, move.name)
          const result = calculate(gen, attacker, defender, calcMove, new Field())

          const damage = flattenDamage(result.damage)
          const avgDamage = damage.reduce((a, b) => a + b, 0) / damage.length

          if (avgDamage > bestDamage) {
            bestDamage = avgDamage
            bestMoveIndex = i
            // In doubles, foe target slots are positive: 1 = p2a, 2 = p2b
            bestTargetSlot = isDoubles ? t + 1 : undefined
          }
        } catch {
          // Move calc failed (status move etc.), treat as 0 damage
        }
      }
    }

    // If best damage is very low, consider switching
    if (bestDamage < 20 && actions.switches.length > 0) {
      const switchAction = pickHealthiestSwitch(actions)
      if (switchAction.type === "switch") {
        return switchAction
      }
    }

    if (bestMoveIndex >= 0) {
      return {
        type: "move",
        moveIndex: bestMoveIndex + 1,
        targetSlot: bestTargetSlot,
      }
    }

    return fallbackMove(actions)
  }

  chooseLeads(teamSize: number, _gameType: BattleFormat): number[] {
    return Array.from({ length: teamSize }, (_, i) => i + 1)
  }
}
