import {
  type PokemonType,
  type Recommendation,
  type RecommendationReason,
  type TeamSlotData,
  getTypeEffectiveness,
  getOffensiveCoverage,
} from "@nasty-plot/core"
import { analyzeTypeCoverage } from "@nasty-plot/analysis"
import { getSpecies, getAllSpecies } from "@nasty-plot/pokemon-data"
import { getUsageStats } from "@nasty-plot/smogon-data"

const OFFENSIVE_GAP_WEIGHT = 15
const DEFENSIVE_RESIST_WEIGHT = 20
const MAX_SCORE = 100
const USAGE_CANDIDATE_LIMIT = 100
const MAX_NATIONAL_DEX_NUM = 1025
const FALLBACK_SPECIES_LIMIT = 200

/**
 * Get recommendations based on coverage gaps in the team.
 */
export async function getCoverageBasedRecommendations(
  slots: TeamSlotData[],
  formatId: string,
  limit: number = 10,
): Promise<Recommendation[]> {
  const { uncoveredTypes, sharedWeaknesses } = analyzeTypeCoverage(slots)

  if (uncoveredTypes.length === 0 && sharedWeaknesses.length === 0) return []

  const usageEntries = await getUsageStats(formatId, { limit: USAGE_CANDIDATE_LIMIT })
  const teamPokemonIds = new Set(slots.map((s) => s.pokemonId))

  const candidates = usageEntries.filter((entry) => !teamPokemonIds.has(entry.pokemonId))
  const candidateIds =
    candidates.length > 0 ? candidates.map((c) => c.pokemonId) : getAllLegalSpeciesIds()

  const recommendations: Recommendation[] = []

  for (const pokemonId of candidateIds) {
    if (teamPokemonIds.has(pokemonId)) continue

    const species = getSpecies(pokemonId)
    if (!species) continue

    const speciesTypes = species.types as PokemonType[]
    const reasons: RecommendationReason[] = []
    let score = 0

    score += scoreOffensiveCoverage(speciesTypes, uncoveredTypes, reasons)
    score += scoreDefensiveResistances(speciesTypes, sharedWeaknesses, reasons)

    if (score > 0) {
      recommendations.push({
        pokemonId,
        pokemonName: species.name,
        score: Math.min(MAX_SCORE, score),
        reasons,
      })
    }
  }

  recommendations.sort((a, b) => b.score - a.score)
  return recommendations.slice(0, limit)
}

function scoreOffensiveCoverage(
  speciesTypes: PokemonType[],
  uncoveredTypes: PokemonType[],
  reasons: RecommendationReason[],
): number {
  const offensiveCoverage = new Set(speciesTypes.flatMap(getOffensiveCoverage))
  const coveredGaps = uncoveredTypes.filter((t) => offensiveCoverage.has(t))

  if (coveredGaps.length === 0) return 0

  const weight = coveredGaps.length * OFFENSIVE_GAP_WEIGHT
  reasons.push({
    type: "coverage",
    description: `Covers offensive gaps: ${coveredGaps.join(", ")}`,
    weight,
  })
  return weight
}

function scoreDefensiveResistances(
  speciesTypes: PokemonType[],
  sharedWeaknesses: PokemonType[],
  reasons: RecommendationReason[],
): number {
  const resistedWeaknesses = sharedWeaknesses.filter(
    (weakness) => getTypeEffectiveness(weakness, speciesTypes) < 1,
  )

  if (resistedWeaknesses.length === 0) return 0

  const weight = resistedWeaknesses.length * DEFENSIVE_RESIST_WEIGHT
  reasons.push({
    type: "coverage",
    description: `Resists team weaknesses: ${resistedWeaknesses.join(", ")}`,
    weight,
  })
  return weight
}

function getAllLegalSpeciesIds(): string[] {
  return getAllSpecies()
    .filter((sp) => sp.num <= MAX_NATIONAL_DEX_NUM)
    .slice(0, FALLBACK_SPECIES_LIMIT)
    .map((sp) => sp.id)
}
