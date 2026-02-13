import { prisma } from "@nasty-plot/db"
import { toId } from "@nasty-plot/core"
import type { SmogonSetData, NatureName, PokemonType } from "@nasty-plot/core"
import { resolveYearMonth, type SmogonChaosData } from "./usage-stats.service"
import { generateSetsFromChaos } from "./chaos-sets.service"

function buildSetsUrl(formatId: string): string {
  return `https://data.pkmn.cc/sets/${formatId}.json`
}

// Raw shape from pkmn.cc - fields can be arrays for slash options
interface RawSetEntry {
  ability: string | string[]
  item: string | string[]
  nature: string | string[]
  teraType?: string | string[]
  moves: (string | string[])[]
  evs?: Record<string, number> | Record<string, number>[]
  ivs?: Record<string, number> | Record<string, number>[]
}

type RawSetsJson = Record<string, Record<string, RawSetEntry>>

/** Take the first element if array, otherwise return the value as-is. */
function firstOf(val: string | string[]): string {
  return Array.isArray(val) ? val[0] : val
}

/** Take the first element if array of records, otherwise return the value as-is. */
function firstRecord(
  val: Record<string, number> | Record<string, number>[],
): Record<string, number> {
  return Array.isArray(val) ? val[0] : val
}

async function upsertSyncLog(formatId: string, message: string): Promise<void> {
  await prisma.dataSyncLog.upsert({
    where: { source_formatId: { source: "smogon-sets", formatId } },
    update: { lastSynced: new Date(), status: "success", message },
    create: {
      source: "smogon-sets",
      formatId,
      lastSynced: new Date(),
      status: "success",
      message,
    },
  })
}

/**
 * Fetch Smogon recommended sets from data.pkmn.cc and persist to DB.
 * @param formatId - The app's format ID (used for DB storage)
 * @param options.pkmnSetsId - Override format ID for the pkmn.cc URL (e.g. "gen9doublesou")
 */
export async function fetchSmogonSets(
  formatId: string,
  options?: { pkmnSetsId?: string; smogonStatsId?: string },
): Promise<void> {
  const setsId = options?.pkmnSetsId ?? formatId
  const url = buildSetsUrl(setsId)
  console.log(`[smogon-sets] Fetching ${url}`)

  const res = await fetch(url)
  if (!res.ok) {
    if (res.status === 404) {
      console.log(
        `[smogon-sets] Sets not found at ${url}, attempting to generate from usage stats...`,
      )
      return fetchAndSaveChaosSets(formatId, options?.smogonStatsId ?? setsId)
    }
    throw new Error(`Failed to fetch sets: ${res.status} ${res.statusText} (${url})`)
  }

  const json: RawSetsJson = await res.json()
  let totalSets = 0
  let skipped = 0

  for (const [pokemonName, sets] of Object.entries(json)) {
    const pokemonId = toId(pokemonName)
    if (!pokemonId || !sets || typeof sets !== "object") {
      skipped++
      continue
    }

    for (const [setName, setData] of Object.entries(sets)) {
      if (!setData || typeof setData !== "object") {
        skipped++
        continue
      }

      const normalizedIvs = setData.ivs ? firstRecord(setData.ivs) : null
      const fields = {
        ability: firstOf(setData.ability ?? ""),
        item: firstOf(setData.item ?? ""),
        nature: firstOf(setData.nature ?? "Serious"),
        teraType: setData.teraType ? firstOf(setData.teraType) : null,
        moves: JSON.stringify(setData.moves ?? []),
        evs: JSON.stringify(firstRecord(setData.evs ?? {})),
        ivs:
          normalizedIvs && Object.keys(normalizedIvs).length > 0
            ? JSON.stringify(normalizedIvs)
            : null,
      }

      await prisma.smogonSet.upsert({
        where: {
          formatId_pokemonId_setName: { formatId, pokemonId, setName },
        },
        update: fields,
        create: { formatId, pokemonId, setName, ...fields },
      })

      totalSets++
    }
  }

  const syncMessage = `Fetched ${totalSets} sets${skipped > 0 ? ` (${skipped} entries skipped)` : ""}`
  await upsertSyncLog(formatId, syncMessage)
  console.log(
    `[smogon-sets] Done: ${totalSets} sets saved for ${formatId}${skipped > 0 ? ` (${skipped} skipped)` : ""}`,
  )
}

/**
 * Fallback: Generate sets from Smogon Chaos usage stats when pkmn.cc has no pre-compiled sets.
 */
async function fetchAndSaveChaosSets(formatId: string, smogonStatsId: string): Promise<void> {
  const { url } = await resolveYearMonth(smogonStatsId)
  console.log(`[smogon-sets] Fetching chaos stats from ${url}`)

  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch chaos stats: ${res.status} ${res.statusText} (${url})`)
  }

  const chaos: SmogonChaosData = await res.json()
  const sets = generateSetsFromChaos(chaos)

  console.log(`[smogon-sets] Generated ${sets.length} sets from usage stats. Saving to DB...`)

  for (const set of sets) {
    const fields = {
      ability: set.ability,
      item: set.item,
      nature: set.nature,
      teraType: set.teraType ?? null,
      moves: JSON.stringify(set.moves),
      evs: JSON.stringify(set.evs),
      ivs: null as string | null,
    }
    await prisma.smogonSet.upsert({
      where: {
        formatId_pokemonId_setName: { formatId, pokemonId: set.pokemonId, setName: set.setName },
      },
      update: fields,
      create: { formatId, pokemonId: set.pokemonId, setName: set.setName, ...fields },
    })
  }

  await upsertSyncLog(formatId, `Generated ${sets.length} sets from usage stats (fallback)`)
  console.log(`[smogon-sets] Done: ${sets.length} sets generated for ${formatId}`)
}

function safeJsonParse<T>(json: string | null, fallback: T): T {
  if (!json) return fallback
  try {
    return JSON.parse(json)
  } catch {
    return fallback
  }
}

/**
 * Parse a DB SmogonSet row back into a SmogonSetData domain object.
 * Handles malformed JSON gracefully by returning safe defaults.
 */
function rowToSetData(row: {
  pokemonId: string
  setName: string
  ability: string
  item: string
  nature: string
  teraType: string | null
  moves: string
  evs: string
  ivs: string | null
}): SmogonSetData {
  return {
    pokemonId: row.pokemonId,
    setName: row.setName,
    ability: row.ability,
    item: row.item,
    nature: row.nature as NatureName,
    teraType: (row.teraType as PokemonType) ?? undefined,
    moves: safeJsonParse<(string | string[])[]>(row.moves, []),
    evs: safeJsonParse<Record<string, number>>(row.evs, {}),
    ivs: safeJsonParse<Record<string, number> | undefined>(row.ivs, undefined),
  }
}

/**
 * Get all sets for a specific Pokemon in a specific format.
 */
export async function getSetsForPokemon(
  formatId: string,
  pokemonId: string,
): Promise<SmogonSetData[]> {
  const rows = await prisma.smogonSet.findMany({
    where: { formatId, pokemonId },
  })

  return rows.map(rowToSetData)
}

/**
 * Get nature usage for a specific Pokemon in a format, derived from SmogonSet rows.
 * Groups by nature and counts occurrences, ordered by count descending.
 */
export async function getNatureUsage(
  formatId: string,
  pokemonId: string,
): Promise<{ natureName: string; count: number }[]> {
  const rows = await prisma.smogonSet.findMany({
    where: { formatId, pokemonId },
    select: { nature: true },
  })

  const counts = new Map<string, number>()
  for (const row of rows) {
    counts.set(row.nature, (counts.get(row.nature) ?? 0) + 1)
  }

  return Array.from(counts.entries())
    .map(([natureName, count]) => ({ natureName, count }))
    .sort((a, b) => b.count - a.count)
}

/**
 * Get all sets for a format, grouped by pokemonId.
 */
export async function getAllSetsForFormat(
  formatId: string,
): Promise<Record<string, SmogonSetData[]>> {
  const rows = await prisma.smogonSet.findMany({
    where: { formatId },
  })

  const grouped: Record<string, SmogonSetData[]> = {}
  for (const row of rows) {
    const data = rowToSetData(row)
    ;(grouped[data.pokemonId] ??= []).push(data)
  }

  return grouped
}
