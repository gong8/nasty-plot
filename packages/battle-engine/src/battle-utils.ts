import { Teams } from "@pkmn/sim"
import type { BattleAction } from "./types"

/** Convert a BattleAction to a @pkmn/sim choice string (e.g. "move 1 terastallize", "switch 3"). */
export function actionToChoice(action: BattleAction): string {
  if (action.type === "move") {
    // @pkmn/sim format: move [index] [target] [mega|terastallize]
    let choice = `move ${action.moveIndex}`
    if (action.targetSlot != null) choice += ` ${action.targetSlot}`
    if (action.tera) choice += " terastallize"
    if (action.mega) choice += " mega"
    return choice
  }
  return `switch ${action.pokemonIndex}`
}

/** Build a doubles choice string where only one slot acts and the other passes. */
export function buildPartialDoublesChoice(actionStr: string, activeSlot: number): string {
  return activeSlot === 0 ? `${actionStr}, pass` : `pass, ${actionStr}`
}

/** Escape backslashes and double quotes in a packed team string for embedding in JSON. */
export function escapeTeam(team: string): string {
  return team.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

/**
 * Convert a Showdown paste string into @pkmn/sim's packed team format.
 * If the input is already packed (no newlines, pipe-delimited), returns it as-is.
 */
export function pasteToPackedTeam(team: string): string | null {
  const trimmed = team.trim()
  if (!trimmed) return null

  // Already in packed format (single line with pipes, no newlines except between mons)
  if (!trimmed.includes("\n") || (trimmed.includes("|") && !trimmed.includes("Ability:"))) {
    return trimmed
  }

  // Parse paste -> PokemonSet[] -> packed string
  try {
    const sets = Teams.import(trimmed)
    if (!sets || sets.length === 0) return null
    return Teams.pack(sets)
  } catch {
    return null
  }
}
