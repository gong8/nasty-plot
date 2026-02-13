/**
 * Battle Cloner — utilities for cloning @pkmn/sim Battle instances.
 *
 * Key discovery: @pkmn/sim's Battle supports toJSON()/fromJSON() for
 * full serialization, and Battle.choose()/makeChoices() for direct
 * turn execution without BattleStream.
 */

import { Battle } from "@pkmn/sim"

type SideRequest = {
  wait?: boolean
  forceSwitch?: boolean[]
  active?: { moves: { disabled?: boolean; target?: string }[] }[]
} | null

/**
 * Clone a @pkmn/sim Battle by serializing + deserializing.
 * The clone is a fully independent copy that can be advanced independently.
 */
export function cloneBattle(battle: Battle): Battle {
  return Battle.fromJSON(battle.toJSON())
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

/** Get "move N" choices for all non-disabled moves in an active slot. */
function getEnabledMoveChoices(active?: { moves: { disabled?: boolean }[] }): string[] {
  if (!active) return []
  const choices: string[] = []
  for (let i = 0; i < active.moves.length; i++) {
    if (!active.moves[i].disabled) choices.push(`move ${i + 1}`)
  }
  return choices
}

/** Get switch choices for all non-fainted, non-active Pokemon on a side. */
function getSwitchChoices(sideTyped: typeof Battle.prototype.p1): string[] {
  const choices: string[] = []
  const { pokemon, active } = sideTyped
  for (let i = 0; i < pokemon.length; i++) {
    if (!pokemon[i].fainted && pokemon[i] !== active[0]) {
      choices.push(`switch ${i + 1}`)
    }
  }
  return choices
}

/**
 * Get legal choices for a side from a Battle instance.
 *
 * Returns an array of choice strings like ["move 1", "move 2", "switch 3"].
 * For doubles, returns combined choice strings like "move 1 -1, move 2 -2".
 */
export function getLegalChoices(battle: Battle, side: "p1" | "p2"): string[] {
  const sideObj = battle[side] as unknown as Record<string, unknown>
  const request = sideObj.request as SideRequest
  if (!request || request.wait) return []

  const sideTyped = battle[side]
  const isDoubles =
    (request.active && request.active.length > 1) ||
    (request.forceSwitch && request.forceSwitch.length > 1)

  if (isDoubles) {
    return getDoublesLegalChoices(battle, sideTyped, request)
  }

  const switchChoices = getSwitchChoices(sideTyped)

  if (request.forceSwitch) {
    return switchChoices.length > 0 ? switchChoices : ["default"]
  }

  const choices = [...getEnabledMoveChoices(request.active?.[0]), ...switchChoices]
  return choices.length > 0 ? choices : ["default"]
}

/** Get available switch target indices (1-indexed). */
function getSwitchTargets(sideTyped: typeof Battle.prototype.p1): number[] {
  const activeSet = new Set(sideTyped.active.filter(Boolean))
  const targets: number[] = []
  for (let i = 0; i < sideTyped.pokemon.length; i++) {
    const mon = sideTyped.pokemon[i]
    if (!mon.fainted && !activeSet.has(mon)) targets.push(i + 1)
  }
  return targets
}

/** Build choices for a single doubles slot during force-switch. */
function getForceSwitchSlotChoices(mustSwitch: boolean, switchTargets: number[]): string[] {
  if (!mustSwitch) return ["pass"]
  const choices = switchTargets.map((sw) => `switch ${sw}`)
  return choices.length > 0 ? choices : ["pass"]
}

/** Build choices for a single doubles slot during a normal turn. */
function getNormalSlotChoices(
  active: { moves: { disabled?: boolean; target?: string }[] } | undefined,
  switchTargets: number[],
): string[] {
  if (!active) return ["pass"]

  const choices: string[] = []
  for (let i = 0; i < active.moves.length; i++) {
    if (active.moves[i].disabled) continue
    const target = active.moves[i].target
    if (target === "normal" || target === "any") {
      choices.push(`move ${i + 1} 1`)
      choices.push(`move ${i + 1} 2`)
    } else {
      choices.push(`move ${i + 1}`)
    }
  }

  for (const sw of switchTargets) {
    choices.push(`switch ${sw}`)
  }

  return choices.length > 0 ? choices : ["pass"]
}

/** Combine two slots' choices, preventing duplicate switch targets. */
function combineSlotChoices(slot1: string[], slot2: string[]): string[] {
  const combined: string[] = []
  for (const c1 of slot1) {
    for (const c2 of slot2) {
      if (c1.startsWith("switch ") && c1 === c2) continue
      combined.push(`${c1}, ${c2}`)
    }
  }
  return combined.length > 0 ? combined : ["default"]
}

/**
 * Get legal combined choice strings for doubles.
 * Enumerates all valid (slot1, slot2) combinations.
 */
function getDoublesLegalChoices(
  battle: Battle,
  sideTyped: typeof battle.p1,
  request: NonNullable<SideRequest>,
): string[] {
  const switchTargets = getSwitchTargets(sideTyped)

  if (request.forceSwitch) {
    const fs = request.forceSwitch
    return combineSlotChoices(
      getForceSwitchSlotChoices(!!fs[0], switchTargets),
      getForceSwitchSlotChoices(fs.length > 1 && !!fs[1], switchTargets),
    )
  }

  return combineSlotChoices(
    getNormalSlotChoices(request.active?.[0], switchTargets),
    getNormalSlotChoices(request.active?.[1], switchTargets),
  )
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
