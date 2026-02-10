import { prisma } from "@/shared/services/prisma";
import type { UsageStatsEntry, TeammateCorrelation } from "@/shared/types";

// Convert display name to Showdown-style ID
function toId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Build Smogon stats URL for a given format/year/month
function buildStatsUrl(
  formatId: string,
  year: number,
  month: number,
  rating = 1695
): string {
  const monthStr = String(month).padStart(2, "0");
  return `https://www.smogon.com/stats/${year}-${monthStr}/chaos/${formatId}-${rating}.json`;
}

// Raw shape from Smogon chaos JSON
interface SmogonChaosData {
  info: { metagame: string; cutoff: number };
  data: Record<
    string,
    {
      usage: number;
      "Raw count": number;
      Abilities: Record<string, number>;
      Items: Record<string, number>;
      Moves: Record<string, number>;
      Teammates: Record<string, number>;
      "Checks and Counters": Record<string, [number, number, ...number[]]>;
    }
  >;
}

/**
 * Try to determine the latest available stats month.
 * Smogon stats are typically published a month behind.
 * Start with current month - 1, then try month - 2.
 */
async function resolveYearMonth(
  formatId: string,
  year?: number,
  month?: number
): Promise<{ year: number; month: number; url: string }> {
  if (year !== undefined && month !== undefined) {
    const url = buildStatsUrl(formatId, year, month);
    return { year, month, url };
  }

  const now = new Date();
  const candidates: { y: number; m: number }[] = [];

  // Try previous months (Smogon stats lag by 1-2 months, sometimes more)
  for (let offset = 1; offset <= 6; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    candidates.push({ y: d.getFullYear(), m: d.getMonth() + 1 });
  }

  for (const { y, m } of candidates) {
    const url = buildStatsUrl(formatId, y, m);
    try {
      const res = await fetch(url, { method: "HEAD" });
      if (res.ok) {
        return { year: y, month: m, url };
      }
    } catch {
      // network error, try next
    }
  }

  // Fall back to the first candidate regardless
  const fallback = candidates[0];
  return {
    year: fallback.y,
    month: fallback.m,
    url: buildStatsUrl(formatId, fallback.y, fallback.m),
  };
}

/**
 * Fetch usage statistics from Smogon and persist to DB.
 */
export async function fetchUsageStats(
  formatId: string,
  year?: number,
  month?: number
): Promise<void> {
  const resolved = await resolveYearMonth(formatId, year, month);
  const { url } = resolved;
  const statYear = resolved.year;
  const statMonth = resolved.month;

  console.log(`[usage-stats] Fetching ${url}`);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Failed to fetch usage stats: ${res.status} ${res.statusText} (${url})`
    );
  }

  const json: SmogonChaosData = await res.json();
  const entries = Object.entries(json.data);

  // Sort by usage descending to compute rank
  entries.sort(([, a], [, b]) => b.usage - a.usage);

  // Batch upsert usage stats
  console.log(`[usage-stats] Saving ${entries.length} Pokemon for ${formatId}`);

  for (let i = 0; i < entries.length; i++) {
    const [name, data] = entries[i];
    const pokemonId = toId(name);
    const rank = i + 1;

    await prisma.usageStats.upsert({
      where: {
        formatId_pokemonId_year_month: {
          formatId,
          pokemonId,
          year: statYear,
          month: statMonth,
        },
      },
      update: {
        usagePercent: data.usage,
        rank,
      },
      create: {
        formatId,
        pokemonId,
        usagePercent: data.usage,
        rank,
        year: statYear,
        month: statMonth,
      },
    });

    // Save teammate correlations
    const teammates = Object.entries(data.Teammates ?? {});
    for (const [tmName, corrValue] of teammates) {
      const tmId = toId(tmName);
      if (!tmId || corrValue <= 0) continue;

      await prisma.teammateCorr.upsert({
        where: {
          formatId_pokemonAId_pokemonBId: {
            formatId,
            pokemonAId: pokemonId,
            pokemonBId: tmId,
          },
        },
        update: { correlationPercent: corrValue },
        create: {
          formatId,
          pokemonAId: pokemonId,
          pokemonBId: tmId,
          correlationPercent: corrValue,
        },
      });
    }

    // Save checks and counters
    const counters = Object.entries(data["Checks and Counters"] ?? {});
    for (const [counterName, values] of counters) {
      const counterId = toId(counterName);
      if (!counterId) continue;
      const koPercent = values[0] ?? 0;
      const switchPercent = values[1] ?? 0;

      await prisma.checkCounter.upsert({
        where: {
          formatId_targetId_counterId: {
            formatId,
            targetId: pokemonId,
            counterId,
          },
        },
        update: { koPercent, switchPercent },
        create: {
          formatId,
          targetId: pokemonId,
          counterId,
          koPercent,
          switchPercent,
        },
      });
    }
  }

  // Update sync log
  await prisma.dataSyncLog.upsert({
    where: {
      source_formatId: { source: "smogon-stats", formatId },
    },
    update: {
      lastSynced: new Date(),
      status: "success",
      message: `Fetched ${entries.length} Pokemon for ${statYear}-${String(statMonth).padStart(2, "0")}`,
    },
    create: {
      source: "smogon-stats",
      formatId,
      lastSynced: new Date(),
      status: "success",
      message: `Fetched ${entries.length} Pokemon for ${statYear}-${String(statMonth).padStart(2, "0")}`,
    },
  });

  console.log(
    `[usage-stats] Done: ${entries.length} Pokemon saved for ${formatId}`
  );
}

/**
 * Query usage stats from the DB, ordered by rank.
 */
export async function getUsageStats(
  formatId: string,
  options?: { limit?: number; page?: number }
): Promise<UsageStatsEntry[]> {
  const limit = options?.limit ?? 50;
  const page = options?.page ?? 1;
  const skip = (page - 1) * limit;

  const rows = await prisma.usageStats.findMany({
    where: { formatId },
    orderBy: { rank: "asc" },
    take: limit,
    skip,
  });

  return rows.map((r: { pokemonId: string; usagePercent: number; rank: number }) => ({
    pokemonId: r.pokemonId,
    usagePercent: r.usagePercent,
    rank: r.rank,
  }));
}

/**
 * Get the total count of usage stats for a format (for pagination).
 */
export async function getUsageStatsCount(formatId: string): Promise<number> {
  return prisma.usageStats.count({ where: { formatId } });
}

/**
 * Get top N Pokemon by usage for a format.
 */
export async function getTopPokemon(
  formatId: string,
  limit: number
): Promise<UsageStatsEntry[]> {
  const rows = await prisma.usageStats.findMany({
    where: { formatId },
    orderBy: { rank: "asc" },
    take: limit,
  });

  return rows.map((r: { pokemonId: string; usagePercent: number; rank: number }) => ({
    pokemonId: r.pokemonId,
    usagePercent: r.usagePercent,
    rank: r.rank,
  }));
}

/**
 * Get teammate correlations for a specific Pokemon in a format.
 */
export async function getTeammates(
  formatId: string,
  pokemonId: string,
  limit = 20
): Promise<TeammateCorrelation[]> {
  const rows = await prisma.teammateCorr.findMany({
    where: { formatId, pokemonAId: pokemonId },
    orderBy: { correlationPercent: "desc" },
    take: limit,
  });

  return rows.map((r: { pokemonBId: string; correlationPercent: number }) => ({
    pokemonId: r.pokemonBId,
    correlationPercent: r.correlationPercent,
  }));
}
