import { NextResponse } from "next/server"
import { getTeam, compareTeams } from "@nasty-plot/teams"
import { apiErrorResponse, badRequestResponse, notFoundResponse } from "../../../../lib/api-error"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const a = searchParams.get("a")
    const b = searchParams.get("b")

    if (!a || !b) {
      return badRequestResponse("Both 'a' and 'b' query params required")
    }

    const teamA = await getTeam(a)
    if (!teamA) {
      return notFoundResponse(`Team '${a}'`)
    }

    const teamB = await getTeam(b)
    if (!teamB) {
      return notFoundResponse(`Team '${b}'`)
    }

    const result = await compareTeams(teamA, teamB)
    return NextResponse.json(result)
  } catch (error) {
    return apiErrorResponse(error, { inferNotFound: true })
  }
}
