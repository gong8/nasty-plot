import { NextResponse } from "next/server"
import { getTeam, updateTeam, deleteTeam } from "@nasty-plot/teams"
import { apiErrorResponse, notFoundResponse } from "../../../../lib/api-error"
import { validateBody } from "../../../../lib/validation"
import { teamUpdateSchema } from "../../../../lib/schemas/team.schemas"

export async function GET(_request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  try {
    const { teamId } = await params
    const team = await getTeam(teamId)
    if (!team) {
      return notFoundResponse("Team")
    }
    return NextResponse.json(team)
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  try {
    const { teamId } = await params
    const [body, error] = await validateBody(request, teamUpdateSchema)
    if (error) return error

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
