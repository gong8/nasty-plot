import { toId } from "@nasty-plot/core"
import { defaultBoosts, type BattleState, type BattleLogEntry } from "../types"
import {
  parsePokemonIdent,
  parseDetails,
  parseHp,
  parseStatusFromHp,
  findPokemon,
  makeEmptyPokemon,
  applyHpUpdate,
  slotIndex,
  logEntry,
} from "./utils"

const SWITCH_VERBS: Record<string, string> = {
  switch: "sent out",
  drag: "was dragged out",
  replace: "appeared",
}

export function handleSwitch(
  state: BattleState,
  cmd: string,
  args: string[],
): BattleLogEntry | null {
  const ident = parsePokemonIdent(args[0])
  if (!ident) return null
  const details = parseDetails(args[1])
  const hpData = args[2] ? parseHp(args[2]) : { hp: 100, maxHp: 100 }
  const status = args[2] ? parseStatusFromHp(args[2]) : ""

  const side = state.sides[ident.side]
  const idx = slotIndex(ident.slot)

  let pokemon = side.team.find((p) => p.name === details.species || p.nickname === ident.name)
  if (!pokemon) {
    pokemon = makeEmptyPokemon()
    pokemon.name = details.species
    pokemon.pokemonId = toId(details.species)
    pokemon.nickname = ident.name
    pokemon.level = details.level
    side.team.push(pokemon)
  }

  applyHpUpdate(pokemon, hpData, status || undefined)
  pokemon.boosts = defaultBoosts()
  pokemon.volatiles = []
  side.active[idx] = pokemon

  const verb = SWITCH_VERBS[cmd] ?? "appeared"
  return logEntry("switch", `${side.name} ${verb} ${ident.name}!`, state.turn, ident.side)
}

export function handleFaint(
  state: BattleState,
  _cmd: string,
  args: string[],
): BattleLogEntry | null {
  const ident = parsePokemonIdent(args[0])
  if (!ident) return null
  const pokemon = findPokemon(state, ident.side, ident.name)
  if (pokemon) {
    pokemon.hp = 0
    pokemon.hpPercent = 0
    pokemon.fainted = true
  }
  return logEntry("faint", `${ident.name} fainted!`, state.turn, ident.side)
}
