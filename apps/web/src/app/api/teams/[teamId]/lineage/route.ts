import { NextResponse } from "next/server"
import { getLineageTree } from "@nasty-plot/teams"
import { apiErrorResponse } from "../../../../../lib/api-error"

export async function GET(_request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  try {
    const { teamId } = await params
    const result = await getLineageTree(teamId)
    return NextResponse.json(result)
  } catch (error) {
    return apiErrorResponse(error, { inferNotFound: true })
  }
}
