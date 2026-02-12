import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@nasty-plot/db"
import { computeTeamBattleAnalytics } from "@nasty-plot/battle-engine"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params

  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { id: true } })
  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 })
  }

  const battles = await prisma.battle.findMany({
    where: { OR: [{ team1Id: teamId }, { team2Id: teamId }] },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      formatId: true,
      gameType: true,
      mode: true,
      team1Name: true,
      team2Name: true,
      team1Paste: true,
      team2Paste: true,
      team1Id: true,
      team2Id: true,
      winnerId: true,
      turnCount: true,
      protocolLog: true,
      createdAt: true,
    },
  })

  const analytics = computeTeamBattleAnalytics(teamId, battles)

  return NextResponse.json(analytics)
}
