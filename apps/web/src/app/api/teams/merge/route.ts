import { NextResponse } from "next/server"
import { mergeTeams } from "@nasty-plot/teams"
import { apiErrorResponse, badRequestResponse } from "../../../../lib/api-error"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { teamAId, teamBId, decisions, name, branchName, notes } = body

    if (!teamAId || !teamBId || !decisions) {
      return badRequestResponse("teamAId, teamBId, and decisions are required")
    }

    const result = await mergeTeams(teamAId, teamBId, decisions, {
      name,
      branchName,
      notes,
    })
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return apiErrorResponse(error, { inferNotFound: true })
  }
}
