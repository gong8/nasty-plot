import type { Recommendation } from "@nasty-plot/core"
import { prisma } from "@nasty-plot/db"
import { dbSlotToDomain } from "@nasty-plot/teams"
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
