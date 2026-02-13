import { NextResponse } from "next/server"
import { forkTeam } from "@nasty-plot/teams"
import { apiErrorResponse } from "../../../../../lib/api-error"

export async function POST(request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  try {
    const { teamId } = await params
    const body = await request.json()
    const result = await forkTeam(teamId, body)
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return apiErrorResponse(error, { inferNotFound: true })
  }
}
