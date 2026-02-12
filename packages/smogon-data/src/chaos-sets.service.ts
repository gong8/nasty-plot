import { toId, type SmogonSetData, type NatureName, type PokemonType } from "@nasty-plot/core"
import { getAbility, getItem, getMove } from "@nasty-plot/pokemon-data"
import type { SmogonChaosData } from "./usage-stats.service"

// Minimum usage percentage to generate a set for (to avoid noise)
const MIN_USAGE_PERCENT = 0.01 // 0.01%

/**
 * Parses a Smogon "Spread" key (e.g. "Timid:0/0/0/252/4/252") into components.
 */
function parseSpread(spreadKey: string): {
  nature: NatureName
  evs: Record<string, number>
} {
  const parts = spreadKey.split(":")
  const nature = (parts[0] || "Serious") as NatureName
  const evsRaw = parts[1] ? parts[1].split("/") : []

  const evs: Record<string, number> = {}
  const stats = ["hp", "atk", "def", "spa", "spd", "spe"]

  stats.forEach((stat, i) => {
    const val = parseInt(evsRaw[i] || "0", 10)
    if (val > 0) evs[stat] = val
  })

  return { nature, evs }
}

/**
 * Gets the key with the highest value from a record.
 */
function getTopKey(record: Record<string, number> | undefined): string | undefined {
  if (!record) return undefined
  let maxKey: string | undefined
  let maxValue = -1

  for (const [key, value] of Object.entries(record)) {
    if (value > maxValue) {
      maxValue = value
      maxKey = key
    }
  }
  return maxKey
}

/**
 * Gets the top N keys from a record by value.
 */
function getTopKeys(record: Record<string, number> | undefined, n: number): string[] {
  if (!record) return []
  return Object.entries(record)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k)
}

/**
 * Generates "Standard Usage" sets from raw Smogon Chaos data.
 * Used when pre-compiled sets (from pkmn.cc) are unavailable.
 */
export function generateSetsFromChaos(chaos: SmogonChaosData): SmogonSetData[] {
  const results: SmogonSetData[] = []

  // Total battles used to calculate usage % if needed, though 'usage' field usually exists
  // The 'usage' field in chaos.data is typically the weighted usage fraction (0.0 to 1.0) or percentage.

  for (const [name, data] of Object.entries(chaos.data)) {
    // Skip if usage is too low (data.usage is typically a decimal like 0.5 for 50% or 0.0001)
    // Adjust threshold based on observation: standard usage stats are 0.0 to 1.0
    if ((data.usage || 0) < MIN_USAGE_PERCENT / 100) continue

    const pokemonId = toId(name)
    if (!pokemonId) continue

    // 1. Ability
    const abilityId = getTopKey(data.Abilities)
    const topAbility = abilityId ? getAbility(abilityId)?.name || abilityId : "No Ability"

    // 2. Item
    const itemId = getTopKey(data.Items)
    const topItem = itemId ? getItem(itemId)?.name || itemId : ""

    // 3. Nature & EVs
    const topSpread = getTopKey(data.Spreads)
    const { nature, evs } = topSpread
      ? parseSpread(topSpread)
      : { nature: "Serious" as NatureName, evs: {} }

    // 4. Moves (Top 4)
    const moveIds = getTopKeys(data.Moves, 4)
    const topMoves = moveIds.map((id) => getMove(id)?.name || id)

    // 5. Tera Type
    // Tera Types are usually just capitalized type names or IDs.
    // We can just capitalize strictly to match PokemonType enum if needed.
    const topTera = getTopKey(data["Tera Types"])
    const normalizedTera = topTera
      ? ((topTera.charAt(0).toUpperCase() + topTera.slice(1).toLowerCase()) as PokemonType)
      : undefined

    results.push({
      pokemonId,
      setName: "Standard Usage", // Distinguish from "Recommended" sets
      ability: topAbility,
      item: topItem,
      nature,
      evs,
      ivs: undefined, // Chaos data doesn't track IVs explicitly usually (assumed 31 unless trick room?)
      moves: topMoves,
      teraType: normalizedTera,
    })
  }

  return results
}
