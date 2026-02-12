import {
  DEFAULT_IVS,
  DEFAULT_EVS,
  calculateAllStats,
  calculateStat,
  type TeamSlotData,
  type TeamAnalysis,
  type SpeedTierEntry,
} from "@nasty-plot/core"
import { prisma } from "@nasty-plot/db"
import { getFormat } from "@nasty-plot/formats"
import { getSpecies } from "@nasty-plot/pokemon-data"
import { getUsageStats } from "@nasty-plot/smogon-data"
import { dbSlotToDomain } from "@nasty-plot/teams"
import { analyzeTypeCoverage } from "./coverage.service"
import { identifyThreats } from "./threat.service"
import { calculateSynergy } from "./synergy.service"

/**
 * Full team analysis orchestrator.
 */
export async function analyzeTeam(teamId: string): Promise<TeamAnalysis> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { slots: true },
  })

  if (!team) {
    throw new Error(`Team not found: ${teamId}`)
  }

  const slots: TeamSlotData[] = team.slots.map(dbSlotToDomain)

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
  const entries: SpeedTierEntry[] = []

  // Team entries
  for (const slot of slots) {
    if (!slot.species) continue

    const stats = calculateAllStats(
      slot.species.baseStats,
      { ...DEFAULT_IVS, ...(slot.ivs ?? {}) },
      { ...DEFAULT_EVS, ...(slot.evs ?? {}) },
      slot.level,
      slot.nature,
    )

    entries.push({
      pokemonId: slot.pokemonId,
      pokemonName: slot.species.name,
      pokemonNum: slot.species.num,
      speed: stats.spe,
      nature: slot.nature,
      evs: slot.evs.spe,
    })
  }

  // Dynamic benchmarks from format usage data
  const format = getFormat(formatId)
  const level = format?.defaultLevel ?? 100
  const teamPokemonIds = new Set(slots.map((s) => s.pokemonId))

  const usageEntries = await getUsageStats(formatId, { limit: 20 })

  let benchmarkCount = 0
  for (const entry of usageEntries) {
    if (benchmarkCount >= 10) break
    if (teamPokemonIds.has(entry.pokemonId)) continue

    const species = getSpecies(entry.pokemonId)
    if (!species) continue

    // Max speed: 252 EVs, 31 IVs, +Spe nature (Jolly)
    const maxSpeed = calculateStat("spe", species.baseStats.spe, 31, 252, level, "Jolly")

    entries.push({
      pokemonId: entry.pokemonId,
      pokemonName: species.name,
      pokemonNum: species.num,
      speed: maxSpeed,
      nature: "Jolly",
      evs: 252,
      isBenchmark: true,
    })
    benchmarkCount++
  }

  entries.sort((a, b) => b.speed - a.speed)
  return entries
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

  const highThreats = threats.filter((t) => t.threatLevel === "high")
  if (highThreats.length > 0) {
    const threatNames = highThreats
      .slice(0, 2)
      .map((t) => t.pokemonName)
      .join(" and ")
    const plural = highThreats.length !== 1
    suggestions.push(
      `${threatNames} ${plural ? "are" : "is a"} significant threat${plural ? "s" : ""}. Consider adding a check or counter.`,
    )
  }

  if (synergyScore < 40) {
    suggestions.push(
      "Team synergy is low. Consider Pokemon that complement each other's weaknesses and resistances.",
    )
  }

  if (slots.length < 6) {
    suggestions.push(
      `Your team only has ${slots.length} Pokemon. Fill the remaining slots for a complete team.`,
    )
  }

  return suggestions
}
