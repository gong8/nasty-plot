import { getGen9, getRawSpecies, getType } from "@nasty-plot/pokemon-data"
import { calculate, Pokemon, Move, Field } from "@smogon/calc"
import type { Result } from "@smogon/calc"
import type { PokemonType } from "@nasty-plot/core"
import { flattenDamage } from "@nasty-plot/damage-calc"
import type { BattleAction, BattleActionSet, BattlePokemon, SideConditions } from "../types"

export { flattenDamage }

/**
 * Calculate damage from one BattlePokemon to another using @smogon/calc.
 * Centralizes the Pokemon/Move construction boilerplate used by all AI modules.
 */
export function calculateBattleDamage(
  attacker: BattlePokemon,
  defender: BattlePokemon,
  moveName: string,
): { damage: number[]; result: Result } {
  const gen = getGen9()
  const atkCalc = new Pokemon(gen, attacker.name, {
    level: attacker.level,
    ability: attacker.ability || undefined,
    item: attacker.item || undefined,
  })
  const defCalc = new Pokemon(gen, defender.name, {
    level: defender.level,
    ability: defender.ability || undefined,
    item: defender.item || undefined,
    curHP: defender.hp,
  })
  const calcMove = new Move(gen, moveName)
  const result = calculate(gen, atkCalc, defCalc, calcMove, new Field())
  const damage = flattenDamage(result.damage)
  return { damage, result }
}

/** Look up a species' types by display name via @nasty-plot/pokemon-data. */
export function getSpeciesTypes(name: string): PokemonType[] {
  const species = getRawSpecies(name)
  if (species?.exists) return species.types as PokemonType[]
  return ["Normal"]
}

/**
 * Look up type effectiveness using @pkmn/dex damageTaken encoding.
 * NOTE: This uses DEFENSIVE semantics (damageTaken) — returns how much damage
 * the defTypes deal TO atkType. This is different from core's getTypeEffectiveness
 * which uses offensive semantics (TYPE_CHART).
 */
export function getTypeEffectiveness(atkType: string, defTypes: string[]): number {
  let mult = 1
  for (const defType of defTypes) {
    const typeData = getType(atkType)
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

// ---------------------------------------------------------------------------
// Shared base score constants for status move evaluation.
// Used by both hint-engine and heuristic-ai for consistent scoring.
// Each module may apply its own modifiers on top of these.
// ---------------------------------------------------------------------------

/** Base hazard scores (before turn-based or situational modifiers). */
export const HAZARD_SCORES = {
  stealthrock: 40,
  spikes: 30,
  toxicspikes: 25,
  stickyweb: 35,
} as const

/** Base status infliction scores (when opponent has no existing status). */
export const STATUS_INFLICTION_SCORES = {
  spore: 45,
  sleeppowder: 40,
  toxic: 35,
  willowisp: 30,
  thunderwave: 25,
  yawn: 28,
} as const

/** Base setup move score when HP is sufficient (>60%). */
export const SETUP_MOVE_SCORE = 35

/** Recovery move scores by HP threshold. */
export const RECOVERY_SCORES = {
  low: 40, // HP < 50%
  moderate: 20, // HP < 75%
  nearFull: 2, // HP >= 75%
} as const

/** Base hazard removal score, plus per-hazard bonus. */
export const HAZARD_REMOVAL_BASE = 25
export const HAZARD_REMOVAL_PER_HAZARD = 5

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
