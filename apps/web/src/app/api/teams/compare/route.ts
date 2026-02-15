import { NextResponse } from "next/server"
import { getTeam, compareTeams } from "@nasty-plot/teams"
import { entityErrorResponse, notFoundResponse } from "../../../../lib/api-error"
import { validateSearchParams } from "../../../../lib/validation"
import { teamCompareSearchSchema } from "../../../../lib/schemas/team.schemas"

export async function GET(request: Request) {
  try {
    const [params, error] = validateSearchParams(request.url, teamCompareSearchSchema)
    if (error) return error

    const [teamA, teamB] = await Promise.all([getTeam(params.a), getTeam(params.b)])

    if (!teamA) return notFoundResponse(`Team '${params.a}'`)
    if (!teamB) return notFoundResponse(`Team '${params.b}'`)

    const result = await compareTeams(teamA, teamB)
    return NextResponse.json(result)
  } catch (error) {
    return entityErrorResponse(error)
  }
}
