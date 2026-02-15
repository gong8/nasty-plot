import type { BattleState, BattleLogEntry, BattleLogType } from "../types"
import { parsePokemonIdent, logEntry } from "./utils"

const EFFECTIVENESS_MESSAGES: Record<string, { type: BattleLogType; msg: string }> = {
  "-crit": { type: "crit", msg: "A critical hit!" },
  "-supereffective": { type: "supereffective", msg: "It's super effective!" },
  "-resisted": { type: "resisted", msg: "It's not very effective..." },
  "-immune": { type: "immune", msg: "It had no effect!" },
}

export function handleEffectiveness(
  state: BattleState,
  cmd: string,
  args: string[],
): BattleLogEntry | null {
  const ident = parsePokemonIdent(args[0])
  const { type, msg } = EFFECTIVENESS_MESSAGES[cmd]
  return logEntry(type, msg, state.turn, ident?.side)
}

export function handleOhko(
  state: BattleState,
  _cmd: string,
  _args: string[],
): BattleLogEntry | null {
  return logEntry("info", "It's a one-hit KO!", state.turn)
}
