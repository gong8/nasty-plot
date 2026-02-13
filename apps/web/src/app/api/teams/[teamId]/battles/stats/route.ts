import { NextRequest, NextResponse } from "next/server"
import { getTeamBattleStats, computeTeamBattleAnalytics } from "@nasty-plot/battle-engine"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params

  const battles = await getTeamBattleStats(teamId)
  if (!battles) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 })
  }

  const analytics = computeTeamBattleAnalytics(teamId, battles)

  return NextResponse.json(analytics)
}
