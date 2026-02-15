import { NextResponse } from "next/server"
import { forkTeam } from "@nasty-plot/teams"
import { entityErrorResponse } from "../../../../../lib/api-error"
import { validateBody } from "../../../../../lib/validation"
import { teamForkSchema } from "../../../../../lib/schemas/team.schemas"

export async function POST(request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  try {
    const { teamId } = await params
    const [body, error] = await validateBody(request, teamForkSchema)
    if (error) return error

    const result = await forkTeam(teamId, body)
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return entityErrorResponse(error)
  }
}
