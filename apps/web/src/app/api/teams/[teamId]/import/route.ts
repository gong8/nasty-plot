import { NextResponse } from "next/server"
import { importIntoTeam } from "@nasty-plot/teams"
import { apiErrorResponse, badRequestResponse } from "../../../../../lib/api-error"

export async function POST(request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  try {
    const { teamId } = await params
    const body = await request.json()
    if (!body.paste) {
      return badRequestResponse("paste is required")
    }
    const team = await importIntoTeam(teamId, body.paste)
    return NextResponse.json(team)
  } catch (error) {
    return apiErrorResponse(error)
  }
}
