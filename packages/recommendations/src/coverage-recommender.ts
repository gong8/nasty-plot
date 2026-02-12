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

/**
 * Get recommendations based on coverage gaps in the team.
 */
export async function getCoverageBasedRecommendations(
  slots: TeamSlotData[],
  formatId: string,
  limit: number = 10,
): Promise<Recommendation[]> {
  const coverage = analyzeTypeCoverage(slots)
  const uncovered = coverage.uncoveredTypes
  const sharedWeaknesses = coverage.sharedWeaknesses

  if (uncovered.length === 0 && sharedWeaknesses.length === 0) return []

  // Get Pokemon from usage stats for this format to limit candidates
  const usageEntries = await getUsageStats(formatId, { limit: 100 })

  const teamPokemonIds = new Set(slots.map((s) => s.pokemonId))
  const recommendations: Recommendation[] = []

  const candidates = usageEntries.filter((e) => !teamPokemonIds.has(e.pokemonId))

  // Fall back to scanning the dex when no usage data exists
  const candidateIds =
    candidates.length > 0 ? candidates.map((c) => c.pokemonId) : getAllLegalSpeciesIds()

  for (const pokemonId of candidateIds) {
    if (teamPokemonIds.has(pokemonId)) continue

    const species = getSpecies(pokemonId)
    if (!species) continue

    const speciesTypes = species.types as PokemonType[]
    const reasons: RecommendationReason[] = []
    let score = 0

    // Check offensive coverage: can this Pokemon hit uncovered types?
    const offensiveCoverage = new Set<PokemonType>()
    for (const t of speciesTypes) {
      for (const covered of getOffensiveCoverage(t)) {
        offensiveCoverage.add(covered)
      }
    }

    const coveredGaps = uncovered.filter((t) => offensiveCoverage.has(t))
    if (coveredGaps.length > 0) {
      score += coveredGaps.length * 15
      reasons.push({
        type: "coverage",
        description: `Covers offensive gaps: ${coveredGaps.join(", ")}`,
        weight: coveredGaps.length * 15,
      })
    }

    // Check defensive coverage: does this Pokemon resist shared weaknesses?
    const resistedWeaknesses = sharedWeaknesses.filter((weakness) => {
      const eff = getTypeEffectiveness(weakness, speciesTypes)
      return eff < 1
    })

    if (resistedWeaknesses.length > 0) {
      score += resistedWeaknesses.length * 20
      reasons.push({
        type: "coverage",
        description: `Resists team weaknesses: ${resistedWeaknesses.join(", ")}`,
        weight: resistedWeaknesses.length * 20,
      })
    }

    if (score > 0) {
      recommendations.push({
        pokemonId,
        pokemonName: species.name,
        score: Math.min(100, score),
        reasons,
      })
    }
  }

  recommendations.sort((a, b) => b.score - a.score)
  return recommendations.slice(0, limit)
}

function getAllLegalSpeciesIds(): string[] {
  // Return a limited set of common competitive Pokemon as fallback
  const allSpeciesList = getAllSpecies()
  return allSpeciesList
    .filter((sp) => sp.num <= 1025)
    .slice(0, 200)
    .map((sp) => sp.id)
}
