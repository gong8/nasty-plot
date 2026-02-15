import type { PokemonType } from "@nasty-plot/core"
import type { BattleState, BattleLogEntry } from "../types"
import {
  parsePokemonIdent,
  findPokemon,
  isPokemonType,
  parseStatBoostCondition,
  logEntry,
} from "./utils"

export function handleItemChange(
  state: BattleState,
  cmd: string,
  args: string[],
): BattleLogEntry | null {
  const isReveal = cmd === "-item"
  const ident = parsePokemonIdent(args[0])
  if (!ident) return null
  const itemName = args[1]
  const pokemon = findPokemon(state, ident.side, ident.name)
  if (pokemon) pokemon.item = isReveal ? itemName : ""
  const verb = isReveal ? "was revealed" : "was consumed"
  return logEntry("item", `${ident.name}'s ${itemName} ${verb}!`, state.turn, ident.side)
}

export function handleAbilityReveal(
  state: BattleState,
  _cmd: string,
  args: string[],
): BattleLogEntry | null {
  const ident = parsePokemonIdent(args[0])
  if (!ident) return null
  const abilityName = args[1]
  const pokemon = findPokemon(state, ident.side, ident.name)
  if (pokemon) pokemon.ability = abilityName
  return logEntry("ability", `${ident.name}'s ${abilityName} activated!`, state.turn, ident.side)
}

export function handleTerastallize(
  state: BattleState,
  _cmd: string,
  args: string[],
): BattleLogEntry | null {
  const ident = parsePokemonIdent(args[0])
  if (!ident) return null
  if (!isPokemonType(args[1])) return null
  const teraType = args[1] as PokemonType
  const pokemon = findPokemon(state, ident.side, ident.name)
  if (pokemon) {
    pokemon.teraType = teraType
    pokemon.isTerastallized = true
  }
  state.sides[ident.side].canTera = false
  state.sides[ident.side].hasTerastallized = true
  return logEntry(
    "tera",
    `${ident.name} terastallized into ${teraType} type!`,
    state.turn,
    ident.side,
  )
}

export function handleVolatileStart(
  state: BattleState,
  _cmd: string,
  args: string[],
): BattleLogEntry | null {
  const ident = parsePokemonIdent(args[0])
  if (!ident) return null
  const condition = args[1]?.replace("move: ", "")
  const pokemon = findPokemon(state, ident.side, ident.name)

  if (condition === "typechange" && args[2] && pokemon) {
    pokemon.types = args[2]
      .split("/")
      .map((t) => t.trim())
      .filter(isPokemonType) as PokemonType[]
  }

  if (pokemon && condition && !pokemon.volatiles.includes(condition)) {
    pokemon.volatiles.push(condition)
  }

  const boost = condition ? parseStatBoostCondition(condition) : null
  if (boost) {
    return logEntry(
      "ability",
      `${ident.name}'s ${boost.ability} boosted its ${boost.stat}!`,
      state.turn,
      ident.side,
    )
  }
  return logEntry("start", `${ident.name}: ${condition} started!`, state.turn, ident.side)
}

export function handleVolatileEnd(
  state: BattleState,
  _cmd: string,
  args: string[],
): BattleLogEntry | null {
  const ident = parsePokemonIdent(args[0])
  if (!ident) return null
  const condition = args[1]?.replace("move: ", "")
  const pokemon = findPokemon(state, ident.side, ident.name)
  if (pokemon && condition) {
    pokemon.volatiles = pokemon.volatiles.filter((v) => v !== condition)
  }
  const endBoost = condition ? parseStatBoostCondition(condition) : null
  if (endBoost) {
    return logEntry(
      "ability",
      `${ident.name}'s ${endBoost.ability} ${endBoost.stat} boost ended!`,
      state.turn,
      ident.side,
    )
  }
  return logEntry("end", `${ident.name}: ${condition} ended!`, state.turn, ident.side)
}

export function handleActivate(
  state: BattleState,
  _cmd: string,
  args: string[],
): BattleLogEntry | null {
  const ident = parsePokemonIdent(args[0] || "")
  if (!ident) return null
  const effect = args[1] || ""

  if (effect === "item: Air Balloon") {
    const pokemon = findPokemon(state, ident.side, ident.name)
    if (pokemon) pokemon.item = ""
    return logEntry("item", `${ident.name}'s Air Balloon popped!`, state.turn, ident.side)
  }

  if (effect === "ability: Disguise" || effect === "Disguise") {
    return logEntry("ability", `${ident.name}'s Disguise was busted!`, state.turn, ident.side)
  }

  const cleanEffect = effect.replace(/^(ability|item|move): /, "")
  return logEntry("info", `${ident.name}'s ${cleanEffect} activated!`, state.turn, ident.side)
}
