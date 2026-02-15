import { DEFAULT_EVS, DEFAULT_LEVEL, POKEMON_TYPES, type PokemonType } from "@nasty-plot/core"
import {
  calcHpPercent,
  defaultBoosts,
  type BattleState,
  type BattlePokemon,
  type BattleLogEntry,
  type BattleLogType,
  type StatusCondition,
  type BoostTable,
} from "../types"
import type { Side } from "./types"

// --- Type guards for runtime validation of protocol values ---

const STATUS_CONDITIONS = new Set<string>(["brn", "par", "slp", "frz", "psn", "tox"])

export function isStatusCondition(s: string): s is StatusCondition {
  return s === "" || STATUS_CONDITIONS.has(s)
}

const POKEMON_TYPE_SET = new Set<string>(POKEMON_TYPES)

export function isPokemonType(s: string): s is PokemonType {
  return POKEMON_TYPE_SET.has(s)
}

export function isSide(s: string): s is Side {
  return s === "p1" || s === "p2"
}

const BOOST_STATS = new Set<string>(["atk", "def", "spa", "spd", "spe", "accuracy", "evasion"])

export function isBoostStat(s: string): s is keyof BoostTable {
  return BOOST_STATS.has(s)
}

export const BOOST_STAT_NAMES: Record<string, string> = {
  atk: "Attack",
  def: "Defense",
  spa: "Sp. Atk",
  spd: "Sp. Def",
  spe: "Speed",
}

const STAT_BOOST_ABILITIES = ["quarkdrive", "protosynthesis"] as const

/** Parse "quarkdrivespe" -> { ability: "Quark Drive", stat: "Speed" } or null */
export function parseStatBoostCondition(
  condition: string,
): { ability: string; stat: string } | null {
  const lower = condition.toLowerCase()
  for (const prefix of STAT_BOOST_ABILITIES) {
    if (lower.startsWith(prefix)) {
      const statKey = lower.slice(prefix.length)
      const statName = BOOST_STAT_NAMES[statKey]
      if (statName) {
        const abilityName = prefix === "quarkdrive" ? "Quark Drive" : "Protosynthesis"
        return { ability: abilityName, stat: statName }
      }
    }
  }
  return null
}

/** Parse "p1a: Garchomp" -> { side: "p1", slot: "a", name: "Garchomp" } */
export function parsePokemonIdent(
  ident: string,
): { side: Side; slot: string; name: string } | null {
  const match = ident.match(/^(p[12])([a-d]?):\s*(.+)$/)
  if (!match || !isSide(match[1])) return null
  return {
    side: match[1],
    slot: match[2] || "a",
    name: match[3].trim(),
  }
}

/** Parse "100/319" -> { hp: 100, maxHp: 319 } or percentage like "78/100" */
export function parseHp(hpStr: string): { hp: number; maxHp: number } {
  if (hpStr === "0 fnt") return { hp: 0, maxHp: 0 }
  const parts = hpStr.split(" ")[0] // Strip conditions like "100/319 par"
  const [hp, maxHp] = parts.split("/").map(Number)
  return { hp: hp || 0, maxHp: maxHp || 0 }
}

/** Parse status from HP string like "100/319 par" */
export function parseStatusFromHp(hpStr: string): StatusCondition {
  const parts = hpStr.split(" ")
  if (parts.length > 1 && isStatusCondition(parts[1])) {
    return parts[1]
  }
  return ""
}

/** Parse "Garchomp, L100, M" -> species details */
export function parseDetails(details: string): { species: string; level: number; gender: string } {
  const parts = details.split(",").map((s) => s.trim())
  const species = parts[0]
  let level = DEFAULT_LEVEL
  let gender = ""

  for (let i = 1; i < parts.length; i++) {
    if (parts[i].startsWith("L")) {
      level = parseInt(parts[i].slice(1), 10)
    } else if (parts[i] === "M" || parts[i] === "F") {
      gender = parts[i]
    }
  }

  return { species, level, gender }
}

/** Slot letter to 0-based index */
export function slotIndex(slot: string): number {
  return slot.charCodeAt(0) - "a".charCodeAt(0)
}

export function makeEmptyPokemon(): BattlePokemon {
  return {
    pokemonId: "",
    name: "",
    nickname: "",
    level: DEFAULT_LEVEL,
    types: [],
    hp: 0,
    maxHp: 0,
    hpPercent: 0,
    status: "",
    fainted: false,
    item: "",
    ability: "",
    isTerastallized: false,
    moves: [],
    stats: { ...DEFAULT_EVS },
    boosts: defaultBoosts(),
    volatiles: [],
  }
}

/**
 * Apply HP data to a pokemon, only increasing maxHp to avoid
 * corruption from percentage-format HP in opponent's perspective.
 */
export function applyHpUpdate(
  pokemon: BattlePokemon,
  hpData: { hp: number; maxHp: number },
  status?: StatusCondition,
) {
  pokemon.hp = hpData.hp
  if (hpData.maxHp > pokemon.maxHp) pokemon.maxHp = hpData.maxHp
  pokemon.hpPercent = calcHpPercent(pokemon.hp, pokemon.maxHp)
  if (status) pokemon.status = status
  pokemon.fainted = pokemon.hp === 0
}

/**
 * Find a Pokemon on a side by nickname (search active first, then team).
 */
export function findPokemon(state: BattleState, side: Side, name: string): BattlePokemon | null {
  const s = state.sides[side]
  // Check active
  for (const p of s.active) {
    if (p && (p.nickname === name || p.name === name)) return p
  }
  // Check team
  for (const p of s.team) {
    if (p.nickname === name || p.name === name) return p
  }
  return null
}

export function logEntry(
  type: BattleLogType,
  message: string,
  turn: number,
  side?: Side,
): BattleLogEntry {
  return { type, message, turn, side }
}
