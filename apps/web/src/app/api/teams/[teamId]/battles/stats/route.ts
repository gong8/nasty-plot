import { NextRequest, NextResponse } from "next/server"
import { getTeamBattleStats, computeTeamBattleAnalytics } from "@nasty-plot/battle-engine"
import { notFoundResponse } from "../../../../../../lib/api-error"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params

  const battles = await getTeamBattleStats(teamId)
  if (!battles) {
    return notFoundResponse("Team")
  }

  const analytics = computeTeamBattleAnalytics(teamId, battles)

  return NextResponse.json(analytics)
}
