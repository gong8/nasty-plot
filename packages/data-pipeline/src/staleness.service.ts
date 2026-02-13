import { prisma } from "@nasty-plot/db"

const MS_PER_DAY = 1000 * 60 * 60 * 24

const DEFAULT_THRESHOLDS: Record<string, number> = {
  "smogon-stats": 30,
  "smogon-sets": 7,
}

/**
 * Check if a data source for a specific format is stale (needs refresh).
 * Returns true if no sync log exists or if the last sync exceeds the threshold.
 */
export async function isStale(
  source: string,
  formatId: string,
  thresholdDays?: number,
): Promise<boolean> {
  const threshold = thresholdDays ?? DEFAULT_THRESHOLDS[source] ?? 7

  const log = await prisma.dataSyncLog.findUnique({
    where: { source_formatId: { source, formatId } },
  })

  if (!log) return true
  if (log.status === "error") return true

  const ageDays = (Date.now() - log.lastSynced.getTime()) / MS_PER_DAY

  return ageDays > threshold
}

/**
 * Get the sync status for all data sources and formats.
 */
export async function getDataStatus(): Promise<
  { source: string; formatId: string; lastSynced: Date; status: string }[]
> {
  const logs = await prisma.dataSyncLog.findMany({
    orderBy: [{ source: "asc" }, { formatId: "asc" }],
  })

  return logs.map((log) => ({
    source: log.source,
    formatId: log.formatId,
    lastSynced: log.lastSynced,
    status: log.status,
  }))
}
