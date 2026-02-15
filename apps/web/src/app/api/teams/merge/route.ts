import { NextResponse } from "next/server"
import { mergeTeams } from "@nasty-plot/teams"
import { entityErrorResponse } from "../../../../lib/api-error"
import { validateBody } from "../../../../lib/validation"
import { teamMergeSchema } from "../../../../lib/schemas/team.schemas"

export async function POST(request: Request) {
  try {
    const [body, error] = await validateBody(request, teamMergeSchema)
    if (error) return error

    const result = await mergeTeams(body.teamAId, body.teamBId, body.decisions, {
      name: body.name,
      branchName: body.branchName,
      notes: body.notes,
    })
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return entityErrorResponse(error)
  }
}
