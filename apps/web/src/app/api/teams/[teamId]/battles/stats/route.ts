import { NextResponse } from "next/server"
import { computeTeamBattleAnalytics, type BattleRecord } from "@nasty-plot/battle-engine"
import { getTeamBattleStats } from "@nasty-plot/battle-engine/db"
import { apiErrorResponse, notFoundResponse } from "../../../../../../lib/api-error"

type BattleRecordWithTeams = BattleRecord & { team1Id?: string | null; team2Id?: string | null }

export async function GET(_request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  try {
    const { teamId } = await params

    const battles = await getTeamBattleStats(teamId)
    if (!battles) {
      return notFoundResponse("Team")
    }

    const analytics = computeTeamBattleAnalytics(
      teamId,
      battles as unknown as BattleRecordWithTeams[],
    )

    return NextResponse.json(analytics)
  } catch (error) {
    return apiErrorResponse(error)
  }
}
