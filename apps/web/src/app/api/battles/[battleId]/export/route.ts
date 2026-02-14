import { NextRequest, NextResponse } from "next/server"
import {
  formatShowdownLog,
  formatShowdownReplayJSON,
  type BattleRecord,
} from "@nasty-plot/battle-engine"
import { getBattleForExport } from "@nasty-plot/battle-engine/db"
import { notFoundResponse } from "../../../../../lib/api-error"

export async function GET(req: NextRequest, { params }: { params: Promise<{ battleId: string }> }) {
  const { battleId } = await params
  const { searchParams } = new URL(req.url)
  const format = searchParams.get("format") || "showdown"

  const battle = await getBattleForExport(battleId)

  if (!battle) {
    return notFoundResponse("Battle")
  }

  const record = battle as unknown as BattleRecord

  if (format === "json") {
    const json = formatShowdownReplayJSON(record)
    return NextResponse.json(json)
  }

  // Default: raw Showdown log
  const log = formatShowdownLog(record)
  return new NextResponse(log, {
    headers: {
      "Content-Type": "text/plain",
      "Content-Disposition": `attachment; filename=battle-${battleId}.log`,
    },
  })
}
