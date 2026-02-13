import { NextRequest, NextResponse } from "next/server"
import {
  getBattleForExport,
  formatShowdownLog,
  formatShowdownReplayJSON,
} from "@nasty-plot/battle-engine"

export async function GET(req: NextRequest, { params }: { params: Promise<{ battleId: string }> }) {
  const { battleId } = await params
  const { searchParams } = new URL(req.url)
  const format = searchParams.get("format") || "showdown"

  const battle = await getBattleForExport(battleId)

  if (!battle) {
    return NextResponse.json({ error: "Battle not found" }, { status: 404 })
  }

  if (format === "json") {
    const json = formatShowdownReplayJSON(battle)
    return NextResponse.json(json)
  }

  // Default: raw Showdown log
  const log = formatShowdownLog(battle)
  return new NextResponse(log, {
    headers: {
      "Content-Type": "text/plain",
      "Content-Disposition": `attachment; filename=battle-${battleId}.log`,
    },
  })
}
