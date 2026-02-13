import { NextResponse } from "next/server"
import { getSampleTeam, deleteSampleTeam } from "@nasty-plot/teams"
import { apiErrorResponse, notFoundResponse } from "../../../../lib/api-error"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sampleTeamId: string }> },
) {
  try {
    const { sampleTeamId } = await params
    const team = await getSampleTeam(sampleTeamId)
    if (!team) {
      return notFoundResponse("Sample team")
    }
    return NextResponse.json(team)
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ sampleTeamId: string }> },
) {
  try {
    const { sampleTeamId } = await params
    await deleteSampleTeam(sampleTeamId)
    return NextResponse.json({ success: true })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
