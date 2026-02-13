import { prisma } from "@nasty-plot/db"

export async function upsertSyncLog(
  source: string,
  formatId: string,
  message: string,
): Promise<void> {
  await prisma.dataSyncLog.upsert({
    where: { source_formatId: { source, formatId } },
    update: { lastSynced: new Date(), status: "success", message },
    create: {
      source,
      formatId,
      lastSynced: new Date(),
      status: "success",
      message,
    },
  })
}
