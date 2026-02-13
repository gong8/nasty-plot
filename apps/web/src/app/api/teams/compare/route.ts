import { NextResponse } from "next/server"
import { getTeam, compareTeams } from "@nasty-plot/teams"
import { apiErrorResponse } from "../../../../lib/api-error"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const a = searchParams.get("a")
    const b = searchParams.get("b")

    if (!a || !b) {
      return NextResponse.json({ error: "Both 'a' and 'b' query params required" }, { status: 400 })
    }

    const teamA = await getTeam(a)
    if (!teamA) {
      return NextResponse.json({ error: `Team '${a}' not found` }, { status: 404 })
    }

    const teamB = await getTeam(b)
    if (!teamB) {
      return NextResponse.json({ error: `Team '${b}' not found` }, { status: 404 })
    }

    const result = await compareTeams(teamA, teamB)
    return NextResponse.json(result)
  } catch (error) {
    return apiErrorResponse(error, { inferNotFound: true })
  }
}
