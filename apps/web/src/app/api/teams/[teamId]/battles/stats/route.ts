import { NextRequest, NextResponse } from "next/server"
import { computeTeamBattleAnalytics } from "@nasty-plot/battle-engine"
import { getTeamBattleStats } from "@nasty-plot/battle-engine/db"
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
