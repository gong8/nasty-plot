import { NextResponse } from "next/server"
import { importSampleTeamsFromPastes } from "@nasty-plot/teams"
import { apiErrorResponse, badRequestResponse } from "../../../../lib/api-error"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (!body.pastes || !Array.isArray(body.pastes) || !body.formatId) {
      return badRequestResponse("pastes (array) and formatId are required")
    }
    const teams = await importSampleTeamsFromPastes(body.pastes, body.formatId, body.source)
    return NextResponse.json(teams, { status: 201 })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
