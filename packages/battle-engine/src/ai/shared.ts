import { Dex } from "@pkmn/dex"
import type { PokemonType } from "@nasty-plot/core"
import type { BattleAction, BattleActionSet, BattlePokemon, SideConditions } from "../types"

/**
 * Flatten the damage output from @smogon/calc into a simple number array.
 * The calc returns number | number[] | number[][] depending on the move.
 */
export function flattenDamage(damage: number | number[] | number[][]): number[] {
  if (typeof damage === "number") return [damage]
  if (Array.isArray(damage) && damage.length > 0) {
    if (Array.isArray(damage[0])) {
      return (damage as number[][])[0]
    }
    return damage as number[]
  }
  return [0]
}

/** Look up a species' types by display name via @pkmn/dex. */
export function getSpeciesTypes(name: string): PokemonType[] {
  const species = Dex.species.get(name)
  if (species?.exists) return species.types as PokemonType[]
  return ["Normal"]
}

/** Look up type effectiveness using @pkmn/dex damageTaken encoding. */
export function getTypeEffectiveness(atkType: string, defTypes: string[]): number {
  let mult = 1
  for (const defType of defTypes) {
    const typeData = Dex.types.get(atkType)
    if (!typeData?.exists) continue
    const eff = typeData.damageTaken?.[defType]
    if (eff === 1) mult *= 2
    else if (eff === 2) mult *= 0.5
    else if (eff === 3) mult *= 0
  }
  return mult
}

/** Pick the first non-disabled move, or move 1 (Struggle) as a last resort. */
export function fallbackMove(actions: BattleActionSet): BattleAction {
  const firstEnabled = actions.moves.findIndex((m) => !m.disabled)
  return { type: "move", moveIndex: (firstEnabled >= 0 ? firstEnabled : 0) + 1 }
}

/**
 * Pick the switch target with the highest remaining HP percentage.
 * Falls back to the first available switch or move 1 if none exist.
 */
export function pickHealthiestSwitch(actions: BattleActionSet): BattleAction {
  const available = actions.switches.filter((s) => !s.fainted)
  if (available.length === 0) {
    // Last resort: pick the first switch slot even if all are fainted.
    // Returning a move during forceSwitch causes the sim to reject it.
    const fallbackIndex = actions.switches[0]?.index ?? 1
    return { type: "switch", pokemonIndex: fallbackIndex }
  }
  const best = available.reduce((a, b) => (a.hp / a.maxHp > b.hp / b.maxHp ? a : b))
  return { type: "switch", pokemonIndex: best.index }
}

/**
 * Calculate effective speed for a Pokemon, accounting for boosts, status, and Tailwind.
 * Does NOT account for Trick Room — callers should invert the comparison when trickRoom > 0.
 */
export function getEffectiveSpeed(pokemon: BattlePokemon, sideConditions: SideConditions): number {
  let speed = pokemon.stats.spe || 1

  // Apply boost stages
  const boost = pokemon.boosts.spe
  if (boost > 0) {
    speed = Math.floor((speed * (2 + boost)) / 2)
  } else if (boost < 0) {
    speed = Math.floor((speed * 2) / (2 + Math.abs(boost)))
  }

  // Paralysis halves speed in Gen 9
  if (pokemon.status === "par") {
    speed = Math.floor(speed * 0.5)
  }

  // Tailwind doubles speed
  if (sideConditions.tailwind > 0) {
    speed = Math.floor(speed * 2)
  }

  return Math.max(1, speed)
}
