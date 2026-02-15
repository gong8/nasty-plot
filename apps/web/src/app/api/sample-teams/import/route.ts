import { NextResponse } from "next/server"
import { importSampleTeamsFromPastes } from "@nasty-plot/teams"
import { apiErrorResponse } from "../../../../lib/api-error"
import { validateBody } from "../../../../lib/validation"
import { sampleTeamImportSchema } from "../../../../lib/schemas/sample-team.schemas"

export async function POST(request: Request) {
  try {
    const [body, error] = await validateBody(request, sampleTeamImportSchema)
    if (error) return error

    const teams = await importSampleTeamsFromPastes(body.pastes, body.formatId, body.source)
    return NextResponse.json(teams, { status: 201 })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
