import { calculate, Field, Move, Pokemon, State } from "@smogon/calc"
import {
  DEFAULT_LEVEL,
  type DamageCalcInput,
  type DamageCalcResult,
  type MatchupMatrixEntry,
  type StatsTable,
  type TeamSlotData,
} from "@nasty-plot/core"
import { getGen9, resolveSpeciesName } from "@nasty-plot/pokemon-data"

// ---------------------------------------------------------------------------
// Helpers: stat table conversion
// ---------------------------------------------------------------------------

function fillStats(partial: Partial<StatsTable> | undefined, defaultValue: number): StatsTable {
  return {
    hp: partial?.hp ?? defaultValue,
    atk: partial?.atk ?? defaultValue,
    def: partial?.def ?? defaultValue,
    spa: partial?.spa ?? defaultValue,
    spd: partial?.spd ?? defaultValue,
    spe: partial?.spe ?? defaultValue,
  }
}

function toCalcBoosts(boosts: Partial<StatsTable> | undefined): Partial<StatsTable> | undefined {
  if (!boosts) return undefined
  return {
    atk: boosts.atk ?? 0,
    def: boosts.def ?? 0,
    spa: boosts.spa ?? 0,
    spd: boosts.spd ?? 0,
    spe: boosts.spe ?? 0,
  }
}

// ---------------------------------------------------------------------------
// Helpers: status mapping
// ---------------------------------------------------------------------------

type CalcStatusName = "slp" | "psn" | "brn" | "frz" | "par" | "tox"

const STATUS_MAP: Record<string, CalcStatusName> = {
  Burned: "brn",
  Paralyzed: "par",
  Poisoned: "psn",
  "Badly Poisoned": "tox",
  Asleep: "slp",
  Frozen: "frz",
}

function toCalcStatus(status?: string): CalcStatusName | undefined {
  if (!status || status === "None" || status === "Healthy") return undefined
  return STATUS_MAP[status]
}

// ---------------------------------------------------------------------------
// Helpers: damage array processing
// ---------------------------------------------------------------------------

export function flattenDamage(damage: number | number[] | number[][]): number[] {
  if (typeof damage === "number") return [damage]
  if (!Array.isArray(damage) || damage.length === 0) return [0]
  // number[][] (doubles spread moves) -- use first sub-array
  if (Array.isArray(damage[0])) return (damage as number[][])[0]
  return damage as number[]
}

function toPercent(value: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((value / total) * 1000) / 10
}

function deriveKoChance(damageArr: number[], defenderHp: number): string {
  if (defenderHp <= 0) return "N/A"
  const minDmg = Math.min(...damageArr)
  const maxDmg = Math.max(...damageArr)

  for (const n of [1, 2, 3, 4]) {
    const label = n === 1 ? "OHKO" : `${n}HKO`
    if (minDmg * n >= defenderHp) return `guaranteed ${label}`
    if (maxDmg * n >= defenderHp) return `possible ${label}`
  }

  return "5+ hits to KO"
}

// ---------------------------------------------------------------------------
// Helpers: Pokemon construction for @smogon/calc
// ---------------------------------------------------------------------------

type CalcPokemonInput = DamageCalcInput["attacker"]

function buildCalcPokemon(input: CalcPokemonInput): Pokemon {
  return new Pokemon(getGen9(), resolveSpeciesName(input.pokemonId), {
    level: input.level,
    ability: input.ability || undefined,
    item: input.item || undefined,
    nature: input.nature || "Hardy",
    evs: fillStats(input.evs, 0),
    ivs: fillStats(input.ivs, 31),
    boosts: toCalcBoosts(input.boosts),
    teraType: input.teraType || undefined,
    status: toCalcStatus(input.status),
  })
}

function buildField(input: DamageCalcInput["field"], move: Move): Field {
  if (!input) return new Field()

  if (input.isCritical) move.isCrit = true

  const fieldOptions: Partial<State.Field> = {
    weather: input.weather as State.Field["weather"],
    terrain: input.terrain as State.Field["terrain"],
    gameType: input.isDoubles ? "Doubles" : undefined,
    defenderSide: {
      isReflect: input.isReflect,
      isLightScreen: input.isLightScreen,
      isAuroraVeil: input.isAuroraVeil,
    } as State.Side,
  }

  return new Field(fieldOptions)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function calculateDamage(input: DamageCalcInput): DamageCalcResult {
  const attackerName = resolveSpeciesName(input.attacker.pokemonId)
  const defenderName = resolveSpeciesName(input.defender.pokemonId)

  const attacker = buildCalcPokemon(input.attacker)
  const defender = buildCalcPokemon(input.defender)
  const move = new Move(getGen9(), input.move)
  const field = buildField(input.field, move)

  const result = calculate(getGen9(), attacker, defender, move, field)
  const damageArr = flattenDamage(result.damage)
  const defenderHp = defender.maxHP()
  const minDamage = Math.min(...damageArr)
  const maxDamage = Math.max(...damageArr)
  const minPercent = toPercent(minDamage, defenderHp)
  const maxPercent = toPercent(maxDamage, defenderHp)

  let description: string
  try {
    description = result.desc()
  } catch {
    description = `${attackerName} ${input.move} vs ${defenderName}: ${minPercent}-${maxPercent}%`
  }

  return {
    moveName: input.move,
    damage: damageArr,
    minPercent,
    maxPercent,
    minDamage,
    maxDamage,
    koChance: deriveKoChance(damageArr, defenderHp),
    description,
  }
}

export function calculateMatchupMatrix(
  teamSlots: TeamSlotData[],
  threatIds: string[],
  _formatId: string,
): MatchupMatrixEntry[][] {
  return teamSlots.map((slot) => {
    const moves = slot.moves.filter(Boolean) as string[]
    const attackerName = slot.species?.name ?? resolveSpeciesName(slot.pokemonId)

    return threatIds.map((threatId) => {
      const baseEntry: MatchupMatrixEntry = {
        attackerId: slot.pokemonId,
        attackerName,
        defenderId: threatId,
        defenderName: resolveSpeciesName(threatId),
        bestMove: moves[0] ?? "Struggle",
        maxPercent: 0,
        koChance: "N/A",
      }

      return moves.reduce((best, moveName) => {
        try {
          const result = calculateDamage({
            attacker: {
              pokemonId: slot.pokemonId,
              level: slot.level,
              ability: slot.ability,
              item: slot.item,
              nature: slot.nature,
              evs: slot.evs,
              ivs: slot.ivs,
            },
            defender: { pokemonId: threatId, level: DEFAULT_LEVEL },
            move: moveName,
          })

          if (result.maxPercent > best.maxPercent) {
            return {
              ...best,
              bestMove: moveName,
              maxPercent: result.maxPercent,
              koChance: result.koChance,
            }
          }
        } catch {
          // Skip moves that fail to calculate (status moves, etc.)
        }
        return best
      }, baseEntry)
    })
  })
}
