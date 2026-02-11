/**
 * Battle Cloner — utilities for cloning @pkmn/sim Battle instances.
 *
 * Key discovery: @pkmn/sim's Battle supports toJSON()/fromJSON() for
 * full serialization, and Battle.choose()/makeChoices() for direct
 * turn execution without BattleStream.
 */

import { Battle } from "@pkmn/sim"

/**
 * Clone a @pkmn/sim Battle by serializing + deserializing.
 * The clone is a fully independent copy that can be advanced independently.
 */
export function cloneBattle(battle: Battle): Battle {
  const json = battle.toJSON()
  return Battle.fromJSON(json)
}

/**
 * Apply choices for both players and advance the battle by one turn.
 * Returns the same battle instance (mutated).
 *
 * Choices are in @pkmn/sim format: "move 1", "switch 3", etc.
 */
export function applyChoices(battle: Battle, p1Choice: string, p2Choice: string): Battle {
  battle.choose("p1", p1Choice)
  battle.choose("p2", p2Choice)
  return battle
}

/**
 * Get legal choices for a side from a Battle instance.
 *
 * Returns an array of choice strings like ["move 1", "move 2", "switch 3"].
 * For doubles, returns combined choice strings like "move 1 -1, move 2 -2".
 */
export function getLegalChoices(battle: Battle, side: "p1" | "p2"): string[] {
  // `request` exists at runtime but isn't in @pkmn/sim's type declarations
  const sideObj = battle[side] as unknown as Record<string, unknown>
  const request = sideObj.request as {
    wait?: boolean
    forceSwitch?: boolean[]
    active?: { moves: { disabled?: boolean; target?: string }[] }[]
  } | null
  if (!request || request.wait) return []

  const sideTyped = battle[side]
  const isDoubles =
    (request.active && request.active.length > 1) ||
    (request.forceSwitch && request.forceSwitch.length > 1)

  if (isDoubles) {
    return getDoublesLegalChoices(battle, side, sideTyped, request)
  }

  const choices: string[] = []

  if (request.forceSwitch) {
    // Must switch
    const pokemon = sideTyped.pokemon
    for (let i = 0; i < pokemon.length; i++) {
      if (!pokemon[i].fainted && pokemon[i] !== sideTyped.active[0]) {
        choices.push(`switch ${i + 1}`)
      }
    }
    return choices.length > 0 ? choices : ["default"]
  }

  // Normal turn: moves + switches
  const active = request.active?.[0]
  if (active) {
    for (let i = 0; i < active.moves.length; i++) {
      if (!active.moves[i].disabled) {
        choices.push(`move ${i + 1}`)
      }
    }
  }

  // Switches
  const pokemon = sideTyped.pokemon
  for (let i = 0; i < pokemon.length; i++) {
    if (!pokemon[i].fainted && pokemon[i] !== sideTyped.active[0]) {
      choices.push(`switch ${i + 1}`)
    }
  }

  return choices.length > 0 ? choices : ["default"]
}

/**
 * Get legal combined choice strings for doubles.
 * Enumerates all valid (slot1, slot2) combinations.
 */
function getDoublesLegalChoices(
  battle: Battle,
  _side: "p1" | "p2",
  sideTyped: typeof battle.p1,
  request: {
    wait?: boolean
    forceSwitch?: boolean[]
    active?: { moves: { disabled?: boolean; target?: string }[] }[]
  },
): string[] {
  // Get choices for each slot independently
  const slot1Choices: string[] = []
  const slot2Choices: string[] = []

  const pokemon = sideTyped.pokemon
  const activeSet = new Set(sideTyped.active.filter(Boolean))

  // Get available switch targets (not active, not fainted)
  const switchTargets: number[] = []
  for (let i = 0; i < pokemon.length; i++) {
    if (!pokemon[i].fainted && !activeSet.has(pokemon[i])) {
      switchTargets.push(i + 1)
    }
  }

  if (request.forceSwitch) {
    // Force switch: each slot that must switch picks from available bench
    const fs = request.forceSwitch
    if (fs[0]) {
      for (const sw of switchTargets) {
        slot1Choices.push(`switch ${sw}`)
      }
      if (slot1Choices.length === 0) slot1Choices.push("pass")
    } else {
      slot1Choices.push("pass")
    }

    if (fs.length > 1 && fs[1]) {
      for (const sw of switchTargets) {
        slot2Choices.push(`switch ${sw}`)
      }
      if (slot2Choices.length === 0) slot2Choices.push("pass")
    } else {
      slot2Choices.push("pass")
    }
  } else {
    // Normal turn: moves + switches for each active slot
    for (let slot = 0; slot < 2; slot++) {
      const active = request.active?.[slot]
      const slotChoices = slot === 0 ? slot1Choices : slot2Choices

      if (!active) {
        slotChoices.push("pass")
        continue
      }

      // Add moves with target slots
      for (let i = 0; i < active.moves.length; i++) {
        if (active.moves[i].disabled) continue
        // Add target variants for moves that need targeting
        const target = active.moves[i].target
        if (target === "normal" || target === "any") {
          // Can target either opponent: 1 (p2a) or 2 (p2b)
          slotChoices.push(`move ${i + 1} 1`)
          slotChoices.push(`move ${i + 1} 2`)
        } else {
          // Spread moves, self-targeting, etc. — no target needed
          slotChoices.push(`move ${i + 1}`)
        }
      }

      // Add switches
      for (const sw of switchTargets) {
        slotChoices.push(`switch ${sw}`)
      }

      if (slotChoices.length === 0) slotChoices.push("pass")
    }
  }

  // Combine slot choices, ensuring no duplicate switch targets
  const combined: string[] = []
  for (const c1 of slot1Choices) {
    for (const c2 of slot2Choices) {
      // Can't switch to same Pokemon from both slots
      if (c1.startsWith("switch ") && c2.startsWith("switch ") && c1 === c2) {
        continue
      }
      combined.push(`${c1}, ${c2}`)
    }
  }

  return combined.length > 0 ? combined : ["default"]
}

/**
 * Check if the battle has ended.
 */
export function isBattleOver(battle: Battle): boolean {
  return battle.ended
}

/**
 * Get the winner of a finished battle.
 * Returns "p1", "p2", or null if not ended / draw.
 */
export function getBattleWinner(battle: Battle): "p1" | "p2" | null {
  if (!battle.ended) return null
  if (battle.winner === battle.p1.name) return "p1"
  if (battle.winner === battle.p2.name) return "p2"
  return null
}
