import { NextResponse } from "next/server"
import { computeTeamBattleAnalytics } from "@nasty-plot/battle-engine"
import { getTeamBattleStats } from "@nasty-plot/battle-engine/db"
import { apiErrorResponse, notFoundResponse } from "../../../../../../lib/api-error"

export async function GET(_request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  try {
    const { teamId } = await params

    const battles = await getTeamBattleStats(teamId)
    if (!battles) {
      return notFoundResponse("Team")
    }

    const analytics = computeTeamBattleAnalytics(teamId, battles)

    return NextResponse.json(analytics)
  } catch (error) {
    return apiErrorResponse(error)
  }
}
