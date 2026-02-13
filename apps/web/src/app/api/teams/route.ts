import { NextResponse } from "next/server"
import { createTeam, listTeams } from "@nasty-plot/teams"
import type { TeamCreateInput } from "@nasty-plot/core"
import { apiErrorResponse, badRequestResponse } from "../../../lib/api-error"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const formatId = searchParams.get("formatId") || undefined
    const includeArchived = searchParams.get("includeArchived")
    const teams = await listTeams({
      formatId,
      includeArchived: includeArchived === "true",
    })
    return NextResponse.json(teams)
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const body: TeamCreateInput = await request.json()
    if (!body.name || !body.formatId) {
      return badRequestResponse("name and formatId are required")
    }
    const team = await createTeam(body)
    return NextResponse.json(team, { status: 201 })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
