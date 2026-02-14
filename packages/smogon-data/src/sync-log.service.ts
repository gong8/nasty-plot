import { prisma } from "@nasty-plot/db"

export async function upsertSyncLog(
  source: string,
  formatId: string,
  message: string,
  status = "success",
): Promise<void> {
  await prisma.dataSyncLog.upsert({
    where: { source_formatId: { source, formatId } },
    update: { lastSynced: new Date(), status, message },
    create: {
      source,
      formatId,
      lastSynced: new Date(),
      status,
      message,
    },
  })
}

export async function getSyncLogs(): Promise<
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
