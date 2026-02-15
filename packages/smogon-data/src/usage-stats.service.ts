import { prisma } from "@nasty-plot/db"
import type { PrismaPromise } from "@nasty-plot/db"
import { toId, TTLCache } from "@nasty-plot/core"
import type { UsageStatsEntry, TeammateCorrelation } from "@nasty-plot/core"
import { fetchSmogonData } from "./fetch-helper"
import { upsertSyncLog } from "./sync-log.service"

const usageStatsCache = new TTLCache<UsageStatsEntry[]>(5 * 60 * 1000) // 5 min

// Build Smogon stats URL for a given format/year/month
export function buildStatsUrl(
  formatId: string,
  year: number,
  month: number,
  rating = 1695,
): string {
  const monthStr = String(month).padStart(2, "0")
  return `https://www.smogon.com/stats/${year}-${monthStr}/chaos/${formatId}-${rating}.json`
}

// Raw shape from Smogon chaos JSON
export interface SmogonChaosData {
  info: { metagame: string; cutoff: number }
  data: Record<
    string,
    {
      usage: number
      "Raw count": number
      Abilities: Record<string, number>
      Items: Record<string, number>
      Moves: Record<string, number>
      Teammates: Record<string, number>
      "Checks and Counters": Record<string, [number, number, ...number[]]>
      Spreads?: Record<string, number>
      "Tera Types"?: Record<string, number>
    }
  >
}

// Rating thresholds to try, in order of preference.
// OU uses 1695; most other tiers only publish at 1630 or lower.
const RATING_THRESHOLDS = [1695, 1630, 1500, 0]

/**
 * Try to determine the latest available stats month and rating.
 * Smogon stats are typically published a month behind.
 * Tries multiple rating thresholds per month since only OU has 1695.
 */
export async function resolveYearMonth(
  formatId: string,
  year?: number,
  month?: number,
): Promise<{ year: number; month: number; rating: number; url: string }> {
  if (year !== undefined && month !== undefined) {
    const url = buildStatsUrl(formatId, year, month)
    return { year, month, rating: 1695, url }
  }

  const now = new Date()
  const candidates: { year: number; month: number }[] = []

  // Try previous months (Smogon stats lag by 1-2 months, sometimes more)
  for (let offset = 1; offset <= 6; offset++) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1)
    candidates.push({ year: date.getFullYear(), month: date.getMonth() + 1 })
  }

  // Try each month x rating combination
  for (const candidate of candidates) {
    for (const rating of RATING_THRESHOLDS) {
      const url = buildStatsUrl(formatId, candidate.year, candidate.month, rating)
      try {
        const res = await fetch(url, { method: "HEAD" })
        if (res.ok) {
          return { year: candidate.year, month: candidate.month, rating, url }
        }
      } catch {
        // network error, try next
      }
    }
  }

  throw new Error(
    `No Smogon stats found for ${formatId} in the last 6 months at any rating threshold (${RATING_THRESHOLDS.join(", ")})`,
  )
}

// ---------------------------------------------------------------------------
// Collect helpers for syncUsageStats (return PrismaPromise arrays for batching)
// ---------------------------------------------------------------------------

const TRANSACTION_CHUNK_SIZE = 500

function collectTeammateOps(
  formatId: string,
  pokemonId: string,
  teammates: Record<string, number> | undefined,
) {
  const ops = []
  for (const [teammateName, correlation] of Object.entries(teammates ?? {})) {
    const teammateId = toId(teammateName)
    if (!teammateId || correlation <= 0) continue
    ops.push(
      prisma.teammateCorr.upsert({
        where: {
          formatId_pokemonAId_pokemonBId: {
            formatId,
            pokemonAId: pokemonId,
            pokemonBId: teammateId,
          },
        },
        update: { correlationPercent: correlation },
        create: {
          formatId,
          pokemonAId: pokemonId,
          pokemonBId: teammateId,
          correlationPercent: correlation,
        },
      }),
    )
  }
  return ops
}

function collectChecksAndCounterOps(
  formatId: string,
  targetId: string,
  counters: Record<string, [number, number, ...number[]]> | undefined,
) {
  const ops = []
  for (const [counterName, [koPercent, switchPercent]] of Object.entries(counters ?? {})) {
    const counterId = toId(counterName)
    if (!counterId) continue
    ops.push(
      prisma.checkCounter.upsert({
        where: {
          formatId_targetId_counterId: { formatId, targetId, counterId },
        },
        update: { koPercent, switchPercent },
        create: { formatId, targetId, counterId, koPercent, switchPercent },
      }),
    )
  }
  return ops
}

function collectMoveUsageOps(
  formatId: string,
  pokemonId: string,
  moves: Record<string, number> | undefined,
) {
  const ops = []
  for (const [moveName, usage] of Object.entries(moves ?? {})) {
    if (!moveName || usage <= 0) continue
    ops.push(
      prisma.moveUsage.upsert({
        where: { formatId_pokemonId_moveName: { formatId, pokemonId, moveName } },
        update: { usagePercent: usage },
        create: { formatId, pokemonId, moveName, usagePercent: usage },
      }),
    )
  }
  return ops
}

function collectItemUsageOps(
  formatId: string,
  pokemonId: string,
  items: Record<string, number> | undefined,
) {
  const ops = []
  for (const [itemName, usage] of Object.entries(items ?? {})) {
    if (!itemName || usage <= 0) continue
    ops.push(
      prisma.itemUsage.upsert({
        where: { formatId_pokemonId_itemName: { formatId, pokemonId, itemName } },
        update: { usagePercent: usage },
        create: { formatId, pokemonId, itemName, usagePercent: usage },
      }),
    )
  }
  return ops
}

function collectAbilityUsageOps(
  formatId: string,
  pokemonId: string,
  abilities: Record<string, number> | undefined,
) {
  const ops = []
  for (const [abilityName, usage] of Object.entries(abilities ?? {})) {
    if (!abilityName || usage <= 0) continue
    ops.push(
      prisma.abilityUsage.upsert({
        where: { formatId_pokemonId_abilityName: { formatId, pokemonId, abilityName } },
        update: { usagePercent: usage },
        create: { formatId, pokemonId, abilityName, usagePercent: usage },
      }),
    )
  }
  return ops
}

// ---------------------------------------------------------------------------

/**
 * Fetch usage statistics from Smogon and persist to DB.
 * Collects all upsert operations and executes them in batched transactions.
 * @param formatId - The app's format ID (used for DB storage)
 * @param options.smogonStatsId - Override format ID for the Smogon URL (e.g. "gen9vgc2025regj")
 * @param options.year - Specific year to fetch
 * @param options.month - Specific month to fetch
 */
export async function syncUsageStats(
  formatId: string,
  options?: { smogonStatsId?: string; year?: number; month?: number },
): Promise<void> {
  const { smogonStatsId, year, month } = options ?? {}
  const smogonId = smogonStatsId ?? formatId
  const { url, year: statYear, month: statMonth } = await resolveYearMonth(smogonId, year, month)

  console.log(`[usage-stats] Fetching ${url}`)

  const res = await fetchSmogonData(url)

  const json: SmogonChaosData = await res.json()
  const entries = Object.entries(json.data)

  entries.sort(([, a], [, b]) => b.usage - a.usage)
  console.log(`[usage-stats] Saving ${entries.length} Pokemon for ${formatId}`)

  // Collect all operations into a single array for batched execution
  // Mixed PrismaPromise types (UsageStats, TeammateCorr, CheckCounter, etc.)
  const allOps: PrismaPromise<unknown>[] = []

  for (let i = 0; i < entries.length; i++) {
    const [name, data] = entries[i]
    const pokemonId = toId(name)
    const rank = i + 1

    allOps.push(
      prisma.usageStats.upsert({
        where: {
          formatId_pokemonId_year_month: { formatId, pokemonId, year: statYear, month: statMonth },
        },
        update: { usagePercent: data.usage, rank },
        create: {
          formatId,
          pokemonId,
          usagePercent: data.usage,
          rank,
          year: statYear,
          month: statMonth,
        },
      }),
    )

    allOps.push(...collectTeammateOps(formatId, pokemonId, data.Teammates))
    allOps.push(...collectChecksAndCounterOps(formatId, pokemonId, data["Checks and Counters"]))
    allOps.push(...collectMoveUsageOps(formatId, pokemonId, data.Moves))
    allOps.push(...collectItemUsageOps(formatId, pokemonId, data.Items))
    allOps.push(...collectAbilityUsageOps(formatId, pokemonId, data.Abilities))
  }

  // Execute in chunks to avoid SQLite limits
  for (let i = 0; i < allOps.length; i += TRANSACTION_CHUNK_SIZE) {
    await prisma.$transaction(allOps.slice(i, i + TRANSACTION_CHUNK_SIZE))
  }

  const monthStr = `${statYear}-${String(statMonth).padStart(2, "0")}`
  await upsertSyncLog("smogon-stats", formatId, `Fetched ${entries.length} Pokemon for ${monthStr}`)

  usageStatsCache.clear()

  console.log(`[usage-stats] Done: ${entries.length} Pokemon saved for ${formatId}`)
}

function rowToEntry(row: {
  pokemonId: string
  usagePercent: number
  rank: number
}): UsageStatsEntry {
  return {
    pokemonId: row.pokemonId,
    usagePercent: row.usagePercent,
    rank: row.rank,
  }
}

export async function getUsageForPokemon(
  formatId: string,
  pokemonId: string,
): Promise<UsageStatsEntry | null> {
  const row = await prisma.usageStats.findFirst({
    where: { formatId, pokemonId },
    orderBy: { year: "desc" },
  })
  return row ? rowToEntry(row) : null
}

/**
 * Query usage stats from the DB, ordered by rank.
 */
export async function getUsageStats(
  formatId: string,
  options?: { limit?: number; page?: number },
): Promise<UsageStatsEntry[]> {
  const limit = options?.limit ?? 50
  const page = options?.page ?? 1
  const cacheKey = `${formatId}:${limit}:${page}`

  const cached = usageStatsCache.get(cacheKey)
  if (cached) return cached

  const skip = (page - 1) * limit

  const rows = await prisma.usageStats.findMany({
    where: { formatId },
    orderBy: { rank: "asc" },
    take: limit,
    skip,
  })

  const result = rows.map(rowToEntry)
  usageStatsCache.set(cacheKey, result)
  return result
}

/**
 * Get the total count of usage stats for a format (for pagination).
 */
export async function getUsageStatsCount(formatId: string): Promise<number> {
  return prisma.usageStats.count({ where: { formatId } })
}

/**
 * Get top N Pokemon by usage for a format.
 */
export async function getTopPokemon(formatId: string, limit: number): Promise<UsageStatsEntry[]> {
  const rows = await prisma.usageStats.findMany({
    where: { formatId },
    orderBy: { rank: "asc" },
    take: limit,
  })

  return rows.map(rowToEntry)
}

/**
 * Get teammate correlations for a specific Pokemon in a format.
 */
export async function getTeammates(
  formatId: string,
  pokemonId: string,
  limit = 20,
): Promise<TeammateCorrelation[]> {
  const rows = await prisma.teammateCorr.findMany({
    where: { formatId, pokemonAId: pokemonId },
    orderBy: { correlationPercent: "desc" },
    take: limit,
  })

  return rows.map((row) => ({
    pokemonId: row.pokemonBId,
    correlationPercent: row.correlationPercent,
  }))
}

/**
 * Get top correlated Pokemon pairs (cores) for a format.
 */
export async function getTopCores(
  formatId: string,
  options: { pokemonId?: string; limit?: number } = {},
): Promise<{ pokemonAId: string; pokemonBId: string; correlationPercent: number }[]> {
  const { pokemonId, limit = 20 } = options
  const rows = await prisma.teammateCorr.findMany({
    where: {
      formatId,
      ...(pokemonId ? { pokemonAId: pokemonId } : {}),
    },
    orderBy: { correlationPercent: "desc" },
    take: limit,
  })

  return rows.map((row) => ({
    pokemonAId: row.pokemonAId,
    pokemonBId: row.pokemonBId,
    correlationPercent: row.correlationPercent,
  }))
}

/**
 * Get move usage data for a specific Pokemon in a format, ordered by usage descending.
 */
export async function getMoveUsage(
  formatId: string,
  pokemonId: string,
): Promise<{ moveName: string; usagePercent: number }[]> {
  const rows = await prisma.moveUsage.findMany({
    where: { formatId, pokemonId },
    orderBy: { usagePercent: "desc" },
  })
  return rows.map((row) => ({ moveName: row.moveName, usagePercent: row.usagePercent }))
}

/**
 * Get item usage data for a specific Pokemon in a format, ordered by usage descending.
 */
export async function getItemUsage(
  formatId: string,
  pokemonId: string,
): Promise<{ itemName: string; usagePercent: number }[]> {
  const rows = await prisma.itemUsage.findMany({
    where: { formatId, pokemonId },
    orderBy: { usagePercent: "desc" },
  })
  return rows.map((row) => ({ itemName: row.itemName, usagePercent: row.usagePercent }))
}

/**
 * Get ability usage data for a specific Pokemon in a format, ordered by usage descending.
 */
export async function getAbilityUsage(
  formatId: string,
  pokemonId: string,
): Promise<{ abilityName: string; usagePercent: number }[]> {
  const rows = await prisma.abilityUsage.findMany({
    where: { formatId, pokemonId },
    orderBy: { usagePercent: "desc" },
  })
  return rows.map((row) => ({ abilityName: row.abilityName, usagePercent: row.usagePercent }))
}

/** Clear the in-memory usage stats cache. Exported for testing. */
export function clearUsageStatsCache(): void {
  usageStatsCache.clear()
}
