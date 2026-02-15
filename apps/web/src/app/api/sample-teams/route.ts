import { NextResponse } from "next/server"
import { createSampleTeam, listSampleTeams } from "@nasty-plot/teams"
import type { SampleTeamData } from "@nasty-plot/teams"
import type { PaginatedResponse } from "@nasty-plot/core"
import { apiErrorResponse } from "../../../lib/api-error"
import { validateBody, validateSearchParams } from "../../../lib/validation"
import {
  sampleTeamCreateSchema,
  sampleTeamListSearchSchema,
} from "../../../lib/schemas/sample-team.schemas"

export async function GET(request: Request) {
  try {
    const [params, error] = validateSearchParams(request.url, sampleTeamListSearchSchema)
    if (error) return error

    const { teams, total } = await listSampleTeams({
      formatId: params.formatId,
      archetype: params.archetype,
      search: params.search,
      page: params.page,
      pageSize: params.pageSize,
    })

    const response: PaginatedResponse<SampleTeamData> = {
      data: teams,
      total,
      page: params.page,
      pageSize: params.pageSize,
    }
    return NextResponse.json(response)
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const [body, error] = await validateBody(request, sampleTeamCreateSchema)
    if (error) return error

    const team = await createSampleTeam(body)
    return NextResponse.json(team, { status: 201 })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
