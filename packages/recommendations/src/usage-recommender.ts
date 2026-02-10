import type { Recommendation, RecommendationReason } from "@nasty-plot/core"
import { prisma } from "@nasty-plot/db"
import { Dex } from "@pkmn/dex"

/**
 * Get recommendations based on teammate usage correlations from competitive data.
 */
export async function getUsageBasedRecommendations(
  teamPokemonIds: string[],
  formatId: string,
  limit: number = 10,
): Promise<Recommendation[]> {
  if (teamPokemonIds.length === 0) return []

  // Query teammate correlations for all team members
  const correlations = await prisma.teammateCorr.findMany({
    where: {
      formatId,
      pokemonAId: { in: teamPokemonIds },
      pokemonBId: { notIn: teamPokemonIds },
    },
    orderBy: { correlationPercent: "desc" },
  })

  if (correlations.length === 0) return []

  // Aggregate correlations per recommended Pokemon
  const scoreMap = new Map<
    string,
    { total: number; count: number; reasons: RecommendationReason[] }
  >()

  for (const corr of correlations) {
    const existing = scoreMap.get(corr.pokemonBId) ?? { total: 0, count: 0, reasons: [] }
    existing.total += corr.correlationPercent
    existing.count++

    const partnerSpecies = Dex.species.get(corr.pokemonAId)
    const partnerName = partnerSpecies?.exists ? partnerSpecies.name : corr.pokemonAId

    existing.reasons.push({
      type: "usage",
      description: `Used alongside ${partnerName} ${corr.correlationPercent.toFixed(1)}% of the time`,
      weight: corr.correlationPercent,
    })

    scoreMap.set(corr.pokemonBId, existing)
  }

  // Convert to recommendations
  const recommendations: Recommendation[] = []

  for (const [pokemonId, data] of scoreMap) {
    const species = Dex.species.get(pokemonId)
    if (!species?.exists) continue

    const avgCorrelation = data.total / data.count
    // Scale score: avg correlation normalized to 0-100
    const score = Math.min(100, Math.round(avgCorrelation * 2))

    recommendations.push({
      pokemonId,
      pokemonName: species.name,
      score,
      reasons: data.reasons.slice(0, 3), // Top 3 reasons
    })
  }

  recommendations.sort((a, b) => b.score - a.score)
  return recommendations.slice(0, limit)
}
