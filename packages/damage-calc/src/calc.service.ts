import { calculate, Field, Move, Pokemon, State } from "@smogon/calc"
import {
  DEFAULT_LEVEL,
  DEFAULT_NATURE,
  PERFECT_IV,
  STATUS_CALC_MAP,
  fillStats,
  toPercent,
  type CalcStatusName,
  type DamageCalcInput,
  type DamageCalcResult,
  type MatchupMatrixEntry,
  type NatureName,
  type StatusName,
  type StatsTable,
  type TeamSlotData,
} from "@nasty-plot/core"
import { getGen9, resolveSpeciesName } from "@nasty-plot/pokemon-data"

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

function toCalcStatus(status?: StatusName): CalcStatusName | undefined {
  if (!status || status === "None" || status === "Healthy") return undefined
  return STATUS_CALC_MAP[status]
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

const MAX_HKO_CALC = 4

function deriveKoChance(damageArr: number[], defenderHp: number): string {
  if (defenderHp <= 0) return "N/A"
  const minDamage = Math.min(...damageArr)
  const maxDamage = Math.max(...damageArr)

  for (let hits = 1; hits <= MAX_HKO_CALC; hits++) {
    const label = hits === 1 ? "OHKO" : `${hits}HKO`
    if (minDamage * hits >= defenderHp) return `guaranteed ${label}`
    if (maxDamage * hits >= defenderHp) return `possible ${label}`
  }

  return `${MAX_HKO_CALC + 1}+ hits to KO`
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
    nature: input.nature || DEFAULT_NATURE,
    evs: fillStats(input.evs, 0),
    ivs: fillStats(input.ivs, PERFECT_IV),
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

function slotToAttackerInput(slot: TeamSlotData): CalcPokemonInput {
  return {
    pokemonId: slot.pokemonId,
    level: slot.level,
    ability: slot.ability,
    item: slot.item,
    nature: slot.nature,
    evs: slot.evs,
    ivs: slot.ivs,
  }
}

function findBestMove(
  attackerInput: CalcPokemonInput,
  moves: string[],
  threatId: string,
  baseEntry: MatchupMatrixEntry,
  cache?: Map<string, DamageCalcResult>,
): MatchupMatrixEntry {
  return moves.reduce((best, moveName) => {
    try {
      const cacheKey = `${attackerInput.pokemonId}|${moveName}|${threatId}`
      let result = cache?.get(cacheKey)
      if (!result) {
        result = calculateDamage({
          attacker: attackerInput,
          defender: { pokemonId: threatId, level: DEFAULT_LEVEL },
          move: moveName,
        })
        cache?.set(cacheKey, result)
      }
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
}

export function calculateQuickDamage(
  attackerName: string,
  defenderName: string,
  moveName: string,
  config?: {
    attackerLevel?: number
    defenderLevel?: number
    attackerEvs?: Partial<StatsTable>
    defenderEvs?: Partial<StatsTable>
    attackerNature?: NatureName
    defenderNature?: NatureName
  },
): { minPercent: number; maxPercent: number } {
  try {
    const gen = getGen9()
    const attacker = new Pokemon(gen, attackerName, {
      level: config?.attackerLevel ?? DEFAULT_LEVEL,
      nature: config?.attackerNature ?? DEFAULT_NATURE,
      evs: fillStats(config?.attackerEvs, 0),
    })
    const defender = new Pokemon(gen, defenderName, {
      level: config?.defenderLevel ?? DEFAULT_LEVEL,
      nature: config?.defenderNature ?? DEFAULT_NATURE,
      evs: fillStats(config?.defenderEvs, 0),
    })
    const move = new Move(gen, moveName)
    const result = calculate(gen, attacker, defender, move, new Field())
    const damageArr = flattenDamage(result.damage)
    const defenderHp = defender.maxHP()
    return {
      minPercent: toPercent(Math.min(...damageArr), defenderHp),
      maxPercent: toPercent(Math.max(...damageArr), defenderHp),
    }
  } catch {
    return { minPercent: 0, maxPercent: 0 }
  }
}

export function calculateMatchupMatrix(
  teamSlots: TeamSlotData[],
  threatIds: string[],
  _formatId: string,
): MatchupMatrixEntry[][] {
  const cache = new Map<string, DamageCalcResult>()

  return teamSlots.map((slot) => {
    const moves = slot.moves.filter(Boolean) as string[]
    const attackerName = slot.species?.name ?? resolveSpeciesName(slot.pokemonId)
    const attackerInput = slotToAttackerInput(slot)

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
      return findBestMove(attackerInput, moves, threatId, baseEntry, cache)
    })
  })
}
