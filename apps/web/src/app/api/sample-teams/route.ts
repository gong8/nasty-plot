import { NextResponse } from "next/server"
import { createSampleTeam, listSampleTeams } from "@nasty-plot/teams"
import { apiErrorResponse, badRequestResponse } from "../../../lib/api-error"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const formatId = searchParams.get("formatId") || undefined
    const archetype = searchParams.get("archetype") || undefined
    const search = searchParams.get("search") || undefined
    const teams = await listSampleTeams({ formatId, archetype, search })
    return NextResponse.json(teams)
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (!body.name || !body.formatId || !body.paste) {
      return badRequestResponse("name, formatId, and paste are required")
    }
    const team = await createSampleTeam({
      name: body.name,
      formatId: body.formatId,
      paste: body.paste,
      archetype: body.archetype,
      source: body.source,
      sourceUrl: body.sourceUrl,
    })
    return NextResponse.json(team, { status: 201 })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
