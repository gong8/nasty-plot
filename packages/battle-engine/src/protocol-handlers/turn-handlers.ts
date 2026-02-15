import type { BattleState, BattleLogEntry } from "../types"
import { isSide, logEntry } from "./utils"

export function handleTurn(
  state: BattleState,
  _cmd: string,
  args: string[],
): BattleLogEntry | null {
  const turnNum = parseInt(args[0], 10)
  state.turn = turnNum
  state.log = []
  return logEntry("turn", `=== Turn ${turnNum} ===`, turnNum)
}

export function handleWin(state: BattleState, _cmd: string, args: string[]): BattleLogEntry | null {
  state.winner = state.sides.p1.name === args[0] ? "p1" : "p2"
  state.phase = "ended"
  return logEntry("win", `${args[0]} won the battle!`, state.turn)
}

export function handleTie(
  state: BattleState,
  _cmd: string,
  _args: string[],
): BattleLogEntry | null {
  state.phase = "ended"
  return logEntry("win", "The battle ended in a tie!", state.turn)
}

export function handlePlayer(
  state: BattleState,
  _cmd: string,
  args: string[],
): BattleLogEntry | null {
  const playerId = args[0]
  if (isSide(playerId)) {
    state.sides[playerId].name = args[1] || playerId
  }
  return null
}

export function handleGametype(
  state: BattleState,
  _cmd: string,
  args: string[],
): BattleLogEntry | null {
  if (args[0] === "doubles") state.gameType = "doubles"
  return null
}
