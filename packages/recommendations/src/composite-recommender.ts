import type { PokemonType, Recommendation, TeamSlotData } from "@nasty-plot/core"
import { prisma } from "@nasty-plot/db"
import { Dex } from "@pkmn/dex"
import { getCoverageBasedRecommendations } from "./coverage-recommender"
import { getUsageBasedRecommendations } from "./usage-recommender"

interface CompositeWeights {
  usage: number
  coverage: number
}

const DEFAULT_WEIGHTS: CompositeWeights = {
  usage: 0.6,
  coverage: 0.4,
}

interface ScoreEntry {
  pokemonName: string
  usageScore: number
  coverageScore: number
  reasons: Recommendation["reasons"]
}

interface DbSlot {
  position: number
  pokemonId: string
  ability: string
  item: string
  nature: string
  teraType: string | null
  level: number
  move1: string
  move2: string | null
  move3: string | null
  move4: string | null
  evHp: number
  evAtk: number
  evDef: number
  evSpA: number
  evSpD: number
  evSpe: number
  ivHp: number
  ivAtk: number
  ivDef: number
  ivSpA: number
  ivSpD: number
  ivSpe: number
}

/**
 * Composite recommender that combines usage-based and coverage-based recommendations.
 */
export async function getRecommendations(
  teamId: string,
  limit: number = 10,
  weights: CompositeWeights = DEFAULT_WEIGHTS,
): Promise<Recommendation[]> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { slots: true },
  })

  if (!team) throw new Error(`Team not found: ${teamId}`)

  const slots = team.slots.map(dbSlotToDomain)
  const teamPokemonIds = slots.map((s) => s.pokemonId)

  const [usageRecs, coverageRecs] = await Promise.all([
    getUsageBasedRecommendations(teamPokemonIds, team.formatId, limit * 2),
    getCoverageBasedRecommendations(slots, team.formatId, limit * 2),
  ])

  const scoreMap = mergeRecommendations(usageRecs, coverageRecs)

  const combined: Recommendation[] = []
  for (const [pokemonId, data] of scoreMap) {
    const compositeScore = Math.round(
      data.usageScore * weights.usage + data.coverageScore * weights.coverage,
    )

    combined.push({
      pokemonId,
      pokemonName: data.pokemonName,
      score: Math.min(100, compositeScore),
      reasons: data.reasons,
    })
  }

  combined.sort((a, b) => b.score - a.score)
  return combined.slice(0, limit)
}

function mergeRecommendations(
  usageRecs: Recommendation[],
  coverageRecs: Recommendation[],
): Map<string, ScoreEntry> {
  const scoreMap = new Map<string, ScoreEntry>()

  function getOrCreate(rec: Recommendation): ScoreEntry {
    const existing = scoreMap.get(rec.pokemonId)
    if (existing) return existing

    const entry: ScoreEntry = {
      pokemonName: rec.pokemonName,
      usageScore: 0,
      coverageScore: 0,
      reasons: [],
    }
    scoreMap.set(rec.pokemonId, entry)
    return entry
  }

  for (const rec of usageRecs) {
    const entry = getOrCreate(rec)
    entry.usageScore = rec.score
    entry.reasons.push(...rec.reasons)
  }

  for (const rec of coverageRecs) {
    const entry = getOrCreate(rec)
    entry.coverageScore = rec.score
    entry.reasons.push(...rec.reasons)
  }

  return scoreMap
}

function dbSlotToDomain(s: DbSlot): TeamSlotData {
  const species = Dex.species.get(s.pokemonId)
  const speciesData = species?.exists
    ? {
        id: s.pokemonId,
        name: species.name,
        num: species.num,
        types: species.types as [PokemonType] | [PokemonType, PokemonType],
        baseStats: {
          hp: species.baseStats.hp,
          atk: species.baseStats.atk,
          def: species.baseStats.def,
          spa: species.baseStats.spa,
          spd: species.baseStats.spd,
          spe: species.baseStats.spe,
        },
        abilities: Object.fromEntries(Object.entries(species.abilities).filter(([, v]) => v)),
        weightkg: species.weightkg,
      }
    : undefined

  return {
    position: s.position,
    pokemonId: s.pokemonId,
    species: speciesData,
    ability: s.ability,
    item: s.item,
    nature: s.nature as TeamSlotData["nature"],
    teraType: (s.teraType as PokemonType) ?? undefined,
    level: s.level,
    moves: [
      s.move1,
      s.move2 ?? undefined,
      s.move3 ?? undefined,
      s.move4 ?? undefined,
    ] as TeamSlotData["moves"],
    evs: {
      hp: s.evHp,
      atk: s.evAtk,
      def: s.evDef,
      spa: s.evSpA,
      spd: s.evSpD,
      spe: s.evSpe,
    },
    ivs: {
      hp: s.ivHp,
      atk: s.ivAtk,
      def: s.ivDef,
      spa: s.ivSpA,
      spd: s.ivSpD,
      spe: s.ivSpe,
    },
  }
}
