import { NextResponse } from "next/server"
import { getTeam, compareTeams } from "@nasty-plot/teams"
import {
  badRequestResponse,
  entityErrorResponse,
  notFoundResponse,
} from "../../../../lib/api-error"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const teamAId = searchParams.get("a")
    const teamBId = searchParams.get("b")

    if (!teamAId || !teamBId) {
      return badRequestResponse("Both 'a' and 'b' query params required")
    }

    const [teamA, teamB] = await Promise.all([getTeam(teamAId), getTeam(teamBId)])

    if (!teamA) return notFoundResponse(`Team '${teamAId}'`)
    if (!teamB) return notFoundResponse(`Team '${teamBId}'`)

    const result = await compareTeams(teamA, teamB)
    return NextResponse.json(result)
  } catch (error) {
    return entityErrorResponse(error)
  }
}
