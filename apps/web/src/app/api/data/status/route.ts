import { NextResponse } from "next/server"
import { prisma } from "@nasty-plot/db"
import { apiErrorResponse } from "../../../../lib/api-error"

export async function GET() {
  try {
    const logs = await prisma.dataSyncLog.findMany({
      orderBy: [{ source: "asc" }, { formatId: "asc" }],
    })
    const status = logs.map((log) => ({
      source: log.source,
      formatId: log.formatId,
      lastSynced: log.lastSynced,
      status: log.status,
    }))

    return NextResponse.json({ data: status })
  } catch (err) {
    return apiErrorResponse(err, { code: "STATUS_ERROR" })
  }
}
