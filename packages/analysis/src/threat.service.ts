import {
  getTypeEffectiveness,
  type TeamSlotData,
  type ThreatEntry,
  type PokemonType,
} from "@nasty-plot/core"
import { getSpecies } from "@nasty-plot/pokemon-data"
import { getUsageStats } from "@nasty-plot/smogon-data"

const THREAT_LEVEL_ORDER: Record<ThreatEntry["threatLevel"], number> = {
  high: 0,
  medium: 1,
  low: 2,
}

const TOP_USAGE_LIMIT = 50
const MAX_RESULTS = 20
const MULTI_WEAK_SCORE_PER_SLOT = 15
const SINGLE_WEAK_SCORE = 5
const MAX_USAGE_SCORE = 30
const HIGH_THREAT_THRESHOLD = 40
const MEDIUM_THREAT_THRESHOLD = 20
const MIN_LOW_THREAT_SCORE = 10

/**
 * Identify threats to the team based on usage stats and type matchups.
 */
export async function identifyThreats(
  slots: TeamSlotData[],
  formatId: string,
): Promise<ThreatEntry[]> {
  const usageEntries = await getUsageStats(formatId, { limit: TOP_USAGE_LIMIT })

  if (usageEntries.length === 0) {
    return []
  }

  const teamPokemonIds = new Set(slots.map((s) => s.pokemonId))
  const threats: ThreatEntry[] = []

  for (const entry of usageEntries) {
    if (teamPokemonIds.has(entry.pokemonId)) continue

    const species = getSpecies(entry.pokemonId)
    if (!species) continue

    const stabTypes = species.types as PokemonType[]
    let threatScore = 0
    const reasons: string[] = []
    const threatenedSlotIds = new Set<string>()

    for (const stabType of stabTypes) {
      let weakSlotCount = 0
      for (const slot of slots) {
        const defenderTypes = slot.species?.types ?? []
        if (defenderTypes.length === 0) continue
        if (getTypeEffectiveness(stabType, defenderTypes) > 1) {
          weakSlotCount++
          threatenedSlotIds.add(slot.pokemonId)
        }
      }
      if (weakSlotCount >= 2) {
        threatScore += weakSlotCount * MULTI_WEAK_SCORE_PER_SLOT
        reasons.push(`${stabType}-type STAB hits ${weakSlotCount} team members super-effectively`)
      } else if (weakSlotCount === 1) {
        threatScore += SINGLE_WEAK_SCORE
      }
    }

    threatScore += Math.min(entry.usagePercent * 2, MAX_USAGE_SCORE)

    let threatLevel: ThreatEntry["threatLevel"]
    if (threatScore >= HIGH_THREAT_THRESHOLD) {
      threatLevel = "high"
    } else if (threatScore >= MEDIUM_THREAT_THRESHOLD) {
      threatLevel = "medium"
    } else {
      threatLevel = "low"
    }

    if (threatLevel === "low" && threatScore < MIN_LOW_THREAT_SCORE) continue

    threats.push({
      pokemonId: entry.pokemonId,
      pokemonName: species.name,
      pokemonNum: species.num,
      types: stabTypes,
      usagePercent: entry.usagePercent,
      threatLevel,
      reason:
        reasons.length > 0
          ? reasons.join("; ")
          : `High usage (${entry.usagePercent.toFixed(1)}%) in the metagame`,
      threatenedSlots: threatenedSlotIds.size > 0 ? [...threatenedSlotIds] : undefined,
    })
  }

  threats.sort((a, b) => {
    const levelDiff = THREAT_LEVEL_ORDER[a.threatLevel] - THREAT_LEVEL_ORDER[b.threatLevel]
    if (levelDiff !== 0) return levelDiff
    return b.usagePercent - a.usagePercent
  })

  return threats.slice(0, MAX_RESULTS)
}
