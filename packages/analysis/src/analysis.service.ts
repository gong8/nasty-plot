import {
  DEFAULT_LEVEL,
  MAX_SINGLE_EV,
  PERFECT_IV,
  TEAM_SIZE,
  calculateAllStats,
  calculateStat,
  fillStats,
  type TeamSlotData,
  type TeamAnalysis,
  type SpeedTierEntry,
} from "@nasty-plot/core"
import { getFormat } from "@nasty-plot/formats"
import { getSpecies } from "@nasty-plot/pokemon-data"
import { getUsageStats } from "@nasty-plot/smogon-data"
import { getTeam } from "@nasty-plot/teams"
import { analyzeTypeCoverage } from "./coverage.service"
import { identifyThreats } from "./threat.service"
import { calculateSynergy } from "./synergy.service"
import { TOP_USAGE_FOR_BENCHMARKS, MAX_BENCHMARKS, LOW_SYNERGY_THRESHOLD } from "./constants"

/**
 * Full team analysis orchestrator.
 */
export async function analyzeTeam(teamId: string): Promise<TeamAnalysis> {
  const team = await getTeam(teamId)

  if (!team) {
    throw new Error(`Team not found: ${teamId}`)
  }

  const slots = team.slots

  const coverage = analyzeTypeCoverage(slots)
  const threats = await identifyThreats(slots, team.formatId)
  const synergyScore = calculateSynergy(slots)
  const speedTiers = await calculateSpeedTiers(slots, team.formatId)
  const suggestions = generateSuggestions(coverage, threats, synergyScore, slots)

  return {
    coverage,
    threats,
    synergyScore,
    speedTiers,
    suggestions,
  }
}

async function calculateSpeedTiers(
  slots: TeamSlotData[],
  formatId: string,
): Promise<SpeedTierEntry[]> {
  const teamEntries = slots
    .filter((slot) => slot.species?.baseStats)
    .map((slot) => {
      const stats = calculateAllStats(
        slot.species!.baseStats,
        fillStats(slot.ivs, PERFECT_IV),
        fillStats(slot.evs, 0),
        slot.level,
        slot.nature,
      )
      return {
        pokemonId: slot.pokemonId,
        pokemonName: slot.species!.name,
        pokemonNum: slot.species!.num,
        speed: stats.spe,
        nature: slot.nature,
        evs: slot.evs.spe,
      }
    })

  const benchmarkEntries = await buildSpeedBenchmarks(slots, formatId)
  const entries = [...teamEntries, ...benchmarkEntries]

  entries.sort((a, b) => b.speed - a.speed)
  return entries
}

async function buildSpeedBenchmarks(
  slots: TeamSlotData[],
  formatId: string,
): Promise<SpeedTierEntry[]> {
  const format = getFormat(formatId)
  const level = format?.defaultLevel ?? DEFAULT_LEVEL
  const teamPokemonIds = new Set(slots.map((s) => s.pokemonId))
  const usageEntries = await getUsageStats(formatId, { limit: TOP_USAGE_FOR_BENCHMARKS })

  const benchmarks: SpeedTierEntry[] = []
  for (const entry of usageEntries) {
    if (benchmarks.length >= MAX_BENCHMARKS) break
    if (teamPokemonIds.has(entry.pokemonId)) continue

    const species = getSpecies(entry.pokemonId)
    if (!species?.baseStats) continue

    benchmarks.push({
      pokemonId: entry.pokemonId,
      pokemonName: species.name,
      pokemonNum: species.num,
      speed: calculateStat("spe", species.baseStats.spe, PERFECT_IV, MAX_SINGLE_EV, level, "Jolly"),
      nature: "Jolly",
      evs: MAX_SINGLE_EV,
      isBenchmark: true,
    })
  }

  return benchmarks
}

function generateSuggestions(
  coverage: TeamAnalysis["coverage"],
  threats: TeamAnalysis["threats"],
  synergyScore: number,
  slots: TeamSlotData[],
): string[] {
  const suggestions: string[] = []

  if (coverage.uncoveredTypes.length > 0) {
    const typesList = coverage.uncoveredTypes.slice(0, 3).join(", ")
    suggestions.push(
      `Your team lacks super-effective coverage against ${typesList} types. Consider adding a Pokemon that can hit these types.`,
    )
  }

  for (const weakness of coverage.sharedWeaknesses.slice(0, 2)) {
    suggestions.push(
      `Multiple team members are weak to ${weakness}. Consider adding a Pokemon that resists ${weakness}.`,
    )
  }

  const highThreats = threats.filter((threat) => threat.threatLevel === "high")
  if (highThreats.length > 0) {
    const threatNames = highThreats
      .slice(0, 2)
      .map((threat) => threat.pokemonName)
      .join(" and ")
    const isPlural = highThreats.length !== 1
    suggestions.push(
      `${threatNames} ${isPlural ? "are" : "is a"} significant threat${isPlural ? "s" : ""}. Consider adding a check or counter.`,
    )
  }

  if (synergyScore < LOW_SYNERGY_THRESHOLD) {
    suggestions.push(
      "Team synergy is low. Consider Pokemon that complement each other's weaknesses and resistances.",
    )
  }

  if (slots.length < TEAM_SIZE) {
    suggestions.push(
      `Your team only has ${slots.length} Pokemon. Fill the remaining slots for a complete team.`,
    )
  }

  return suggestions
}
