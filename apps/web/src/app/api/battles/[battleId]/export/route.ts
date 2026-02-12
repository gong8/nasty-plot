import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@nasty-plot/db"
import { formatShowdownLog, formatShowdownReplayJSON } from "@nasty-plot/battle-engine"

export async function GET(req: NextRequest, { params }: { params: Promise<{ battleId: string }> }) {
  const { battleId } = await params
  const { searchParams } = new URL(req.url)
  const format = searchParams.get("format") || "showdown"

  const battle = await prisma.battle.findUnique({
    where: { id: battleId },
    select: {
      id: true,
      formatId: true,
      gameType: true,
      mode: true,
      team1Name: true,
      team2Name: true,
      team1Paste: true,
      team2Paste: true,
      winnerId: true,
      turnCount: true,
      protocolLog: true,
      createdAt: true,
    },
  })

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
