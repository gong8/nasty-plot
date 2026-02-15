import { NextResponse } from "next/server"
import { createTeam, listTeams } from "@nasty-plot/teams"
import type { PaginatedResponse, TeamData } from "@nasty-plot/core"
import { apiErrorResponse } from "../../../lib/api-error"
import { validateBody, validateSearchParams } from "../../../lib/validation"
import { teamCreateSchema, teamListSearchSchema } from "../../../lib/schemas/team.schemas"

export async function GET(request: Request) {
  try {
    const [params, error] = validateSearchParams(request.url, teamListSearchSchema)
    if (error) return error

    const { teams, total } = await listTeams({
      formatId: params.formatId || undefined,
      includeArchived: params.includeArchived === "true",
      page: params.page,
      pageSize: params.pageSize,
    })

    const response: PaginatedResponse<TeamData> = {
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
    const [body, error] = await validateBody(request, teamCreateSchema)
    if (error) return error

    const team = await createTeam(body)
    return NextResponse.json(team, { status: 201 })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
