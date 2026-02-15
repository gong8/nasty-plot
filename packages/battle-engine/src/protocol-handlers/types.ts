import type { BattleState, BattleLogEntry } from "../types"

export type Side = "p1" | "p2"

export type ProtocolHandler = (
  state: BattleState,
  cmd: string,
  args: string[],
) => BattleLogEntry | null
