import { STATUS_DISPLAY_MAP } from "@nasty-plot/core"
import type { BattleState, BattleLogEntry } from "../types"
import { parsePokemonIdent, findPokemon, isStatusCondition, isBoostStat, logEntry } from "./utils"

export function handleStatus(
  state: BattleState,
  _cmd: string,
  args: string[],
): BattleLogEntry | null {
  const ident = parsePokemonIdent(args[0])
  if (!ident) return null
  const statusId = isStatusCondition(args[1]) ? args[1] : ""
  const pokemon = findPokemon(state, ident.side, ident.name)
  if (pokemon) pokemon.status = statusId
  return logEntry(
    "status",
    `${ident.name} ${STATUS_DISPLAY_MAP[statusId] || `got ${statusId}`}!`,
    state.turn,
    ident.side,
  )
}

export function handleCureStatus(
  state: BattleState,
  _cmd: string,
  args: string[],
): BattleLogEntry | null {
  const ident = parsePokemonIdent(args[0])
  if (!ident) return null
  const pokemon = findPokemon(state, ident.side, ident.name)
  if (pokemon) pokemon.status = ""
  return logEntry("status", `${ident.name} was cured!`, state.turn, ident.side)
}

export function handleBoostChange(
  state: BattleState,
  cmd: string,
  args: string[],
): BattleLogEntry | null {
  const isBoost = cmd === "-boost"
  const ident = parsePokemonIdent(args[0])
  if (!ident) return null
  const stat = args[1]
  const amount = parseInt(args[2], 10)
  const pokemon = findPokemon(state, ident.side, ident.name)
  if (pokemon && isBoostStat(stat)) {
    pokemon.boosts[stat] = isBoost
      ? Math.min(6, pokemon.boosts[stat] + amount)
      : Math.max(-6, pokemon.boosts[stat] - amount)
  }

  const stages = amount === 1 ? "" : amount === 2 ? " sharply" : " drastically"
  const verb = isBoost ? "rose" : "fell"
  return logEntry(
    isBoost ? "boost" : "unboost",
    `${ident.name}'s ${stat} ${verb}${stages}!`,
    state.turn,
    ident.side,
  )
}
