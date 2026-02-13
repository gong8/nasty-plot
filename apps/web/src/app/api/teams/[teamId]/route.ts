import { NextResponse } from "next/server"
import { getTeam, updateTeam, deleteTeam } from "@nasty-plot/teams"
import { apiErrorResponse } from "../../../../lib/api-error"

export async function GET(_request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  try {
    const { teamId } = await params
    const team = await getTeam(teamId)
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }
    return NextResponse.json(team)
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  try {
    const { teamId } = await params
    const body = await request.json()
    const team = await updateTeam(teamId, body)
    return NextResponse.json(team)
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  try {
    const { teamId } = await params
    await deleteTeam(teamId)
    return NextResponse.json({ success: true })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
