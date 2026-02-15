import type { BattleState, BattleLogEntry } from "../types"
import { parsePokemonIdent, logEntry } from "./utils"

export function handleMove(
  state: BattleState,
  _cmd: string,
  args: string[],
): BattleLogEntry | null {
  const ident = parsePokemonIdent(args[0])
  if (!ident) return null
  return logEntry("move", `${ident.name} used ${args[1]}!`, state.turn, ident.side)
}

export function handleFailOrMiss(
  state: BattleState,
  cmd: string,
  args: string[],
): BattleLogEntry | null {
  const ident = parsePokemonIdent(args[0] || "")
  if (!ident) return null
  const verb = cmd === "-fail" ? "move failed" : "attack missed"
  return logEntry("info", `${ident.name}'s ${verb}!`, state.turn, ident.side)
}

export function handlePrepare(
  state: BattleState,
  _cmd: string,
  args: string[],
): BattleLogEntry | null {
  const ident = parsePokemonIdent(args[0] || "")
  if (!ident) return null
  return logEntry(
    "move",
    `${ident.name} is preparing ${args[1] || "a move"}!`,
    state.turn,
    ident.side,
  )
}

export function handleCant(
  state: BattleState,
  _cmd: string,
  args: string[],
): BattleLogEntry | null {
  const ident = parsePokemonIdent(args[0])
  if (!ident) return null
  return logEntry(
    "cant",
    `${ident.name} can't move! (${args[1] || "unknown"})`,
    state.turn,
    ident.side,
  )
}

export function handleHitCount(
  state: BattleState,
  _cmd: string,
  args: string[],
): BattleLogEntry | null {
  const ident = parsePokemonIdent(args[0] || "")
  return logEntry("info", `Hit ${args[1] || "?"} time(s)!`, state.turn, ident?.side)
}
