import {
  STATS,
  toId,
  type SmogonSetData,
  type NatureName,
  type PokemonType,
} from "@nasty-plot/core"
import { getAbility, getItem, getMove } from "@nasty-plot/pokemon-data"
import type { SmogonChaosData } from "./usage-stats.service"

const MIN_USAGE_FRACTION = 0.0001

function parseSpread(spreadKey: string): { nature: NatureName; evs: Record<string, number> } {
  const [naturePart, evsPart] = spreadKey.split(":")
  const nature = (naturePart || "Serious") as NatureName
  const evsRaw = evsPart?.split("/") ?? []

  const evs: Record<string, number> = {}
  STATS.forEach((stat, i) => {
    const val = parseInt(evsRaw[i] || "0", 10)
    if (val > 0) evs[stat] = val
  })

  return { nature, evs }
}

function getTopKey(record: Record<string, number> | undefined): string | undefined {
  if (!record) return undefined
  let topKey: string | undefined
  let topValue = -1

  for (const [key, value] of Object.entries(record)) {
    if (value > topValue) {
      topValue = value
      topKey = key
    }
  }
  return topKey
}

function getTopKeys(record: Record<string, number> | undefined, count: number): string[] {
  if (!record) return []
  return Object.entries(record)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([k]) => k)
}

function capitalizeType(raw: string): PokemonType {
  return (raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()) as PokemonType
}

function resolveDisplayName(
  id: string | undefined,
  lookup: (id: string) => { name: string } | null,
  fallback: string,
): string {
  if (!id) return fallback
  return lookup(id)?.name ?? id
}

/**
 * Generates "Standard Usage" sets from raw Smogon Chaos data.
 * Used when pre-compiled sets (from pkmn.cc) are unavailable.
 */
export function generateSetsFromChaos(chaos: SmogonChaosData): SmogonSetData[] {
  const results: SmogonSetData[] = []

  for (const [name, data] of Object.entries(chaos.data)) {
    if ((data.usage || 0) < MIN_USAGE_FRACTION) continue

    const pokemonId = toId(name)
    if (!pokemonId) continue

    const topSpread = getTopKey(data.Spreads)
    const { nature, evs } = topSpread
      ? parseSpread(topSpread)
      : { nature: "Serious" as NatureName, evs: {} }

    const topTera = getTopKey(data["Tera Types"])

    results.push({
      pokemonId,
      setName: "Standard Usage",
      ability: resolveDisplayName(getTopKey(data.Abilities), getAbility, "No Ability"),
      item: resolveDisplayName(getTopKey(data.Items), getItem, ""),
      nature,
      evs,
      ivs: undefined,
      moves: getTopKeys(data.Moves, 4).map((id) => getMove(id)?.name ?? id),
      teraType: topTera ? capitalizeType(topTera) : undefined,
    })
  }

  return results
}
