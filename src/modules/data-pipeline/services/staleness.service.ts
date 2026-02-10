import { prisma } from "@/shared/services/prisma";

const DEFAULT_THRESHOLDS: Record<string, number> = {
  "smogon-stats": 30,
  "smogon-sets": 7,
};

/**
 * Check if a data source for a specific format is stale (needs refresh).
 * Returns true if no sync log exists or if the last sync exceeds the threshold.
 */
export async function isStale(
  source: string,
  formatId: string,
  thresholdDays?: number
): Promise<boolean> {
  const threshold = thresholdDays ?? DEFAULT_THRESHOLDS[source] ?? 7;

  const log = await prisma.dataSyncLog.findUnique({
    where: { source_formatId: { source, formatId } },
  });

  if (!log) return true;
  if (log.status === "error") return true;

  const ageMs = Date.now() - log.lastSynced.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  return ageDays > threshold;
}

/**
 * Get the sync status for all data sources and formats.
 */
export async function getDataStatus(): Promise<
  { source: string; formatId: string; lastSynced: Date; status: string }[]
> {
  const logs = await prisma.dataSyncLog.findMany({
    orderBy: [{ source: "asc" }, { formatId: "asc" }],
  });

  return logs.map((log: { source: string; formatId: string; lastSynced: Date; status: string }) => ({
    source: log.source,
    formatId: log.formatId,
    lastSynced: log.lastSynced,
    status: log.status,
  }));
}
