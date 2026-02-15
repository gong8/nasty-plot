import type { BattleState, BattleLogEntry } from "../types"
import {
  parsePokemonIdent,
  parseHp,
  parseStatusFromHp,
  findPokemon,
  applyHpUpdate,
  logEntry,
} from "./utils"

export function handleDamageOrHeal(
  state: BattleState,
  cmd: string,
  args: string[],
): BattleLogEntry | null {
  const ident = parsePokemonIdent(args[0])
  if (!ident) return null
  const hpData = parseHp(args[1])
  const status = parseStatusFromHp(args[1])
  const pokemon = findPokemon(state, ident.side, ident.name)
  const prevPercent = pokemon?.hpPercent ?? 100

  if (pokemon) {
    applyHpUpdate(pokemon, hpData, status || undefined)
  }

  const isHeal = cmd === "-heal"
  const newPercent = pokemon?.hpPercent ?? 0
  const delta = Math.abs(newPercent - prevPercent)
  const source = args[2] ? ` (${args[2].replace("[from] ", "")})` : ""
  const hpDetail =
    delta > 0 ? ` (${newPercent}%, ${isHeal ? "+" : "-"}${delta}%)` : ` (${newPercent}%)`
  return logEntry(
    isHeal ? "heal" : "damage",
    `${ident.name} ${isHeal ? "restored" : "lost"} HP!${hpDetail}${source}`,
    state.turn,
    ident.side,
  )
}
