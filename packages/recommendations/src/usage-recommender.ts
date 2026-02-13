import type { Recommendation, RecommendationReason } from "@nasty-plot/core"
import { prisma } from "@nasty-plot/db"
import { getSpecies } from "@nasty-plot/pokemon-data"

const CORRELATION_SCALE_FACTOR = 2
const MAX_SCORE = 100
const MAX_REASONS_PER_RECOMMENDATION = 3

interface CorrelationAggregate {
  total: number
  count: number
  reasons: RecommendationReason[]
}

/**
 * Get recommendations based on teammate usage correlations from competitive data.
 */
export async function getUsageBasedRecommendations(
  teamPokemonIds: string[],
  formatId: string,
  limit: number = 10,
): Promise<Recommendation[]> {
  if (teamPokemonIds.length === 0) return []

  const correlations = await prisma.teammateCorr.findMany({
    where: {
      formatId,
      pokemonAId: { in: teamPokemonIds },
      pokemonBId: { notIn: teamPokemonIds },
    },
    orderBy: { correlationPercent: "desc" },
  })

  if (correlations.length === 0) return []

  const aggregateByPokemon = new Map<string, CorrelationAggregate>()

  for (const corr of correlations) {
    const aggregate = aggregateByPokemon.get(corr.pokemonBId) ?? {
      total: 0,
      count: 0,
      reasons: [],
    }
    aggregate.total += corr.correlationPercent
    aggregate.count++

    const partnerName = getSpecies(corr.pokemonAId)?.name ?? corr.pokemonAId

    aggregate.reasons.push({
      type: "usage",
      description: `Used alongside ${partnerName} ${corr.correlationPercent.toFixed(1)}% of the time`,
      weight: corr.correlationPercent,
    })

    aggregateByPokemon.set(corr.pokemonBId, aggregate)
  }

  const recommendations: Recommendation[] = []

  for (const [pokemonId, aggregate] of aggregateByPokemon) {
    const species = getSpecies(pokemonId)
    if (!species) continue

    const avgCorrelation = aggregate.total / aggregate.count
    const score = Math.min(MAX_SCORE, Math.round(avgCorrelation * CORRELATION_SCALE_FACTOR))

    recommendations.push({
      pokemonId,
      pokemonName: species.name,
      score,
      reasons: aggregate.reasons.slice(0, MAX_REASONS_PER_RECOMMENDATION),
    })
  }

  recommendations.sort((a, b) => b.score - a.score)
  return recommendations.slice(0, limit)
}
