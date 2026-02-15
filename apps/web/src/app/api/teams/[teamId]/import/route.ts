import { NextResponse } from "next/server"
import { importIntoTeam } from "@nasty-plot/teams"
import { apiErrorResponse } from "../../../../../lib/api-error"
import { validateBody } from "../../../../../lib/validation"
import { teamImportSchema } from "../../../../../lib/schemas/team.schemas"

export async function POST(request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  try {
    const { teamId } = await params
    const [body, error] = await validateBody(request, teamImportSchema)
    if (error) return error

    const team = await importIntoTeam(teamId, body.paste)
    return NextResponse.json(team)
  } catch (error) {
    return apiErrorResponse(error)
  }
}
