import { NextResponse } from "next/server"
import { analyzeTeam } from "@nasty-plot/analysis"
import type { ApiResponse, TeamAnalysis } from "@nasty-plot/core"
import { apiErrorResponse } from "../../../../../lib/api-error"

export async function GET(_request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  try {
    const { teamId } = await params

    const analysis = await analyzeTeam(teamId)

    return NextResponse.json({ data: analysis } satisfies ApiResponse<TeamAnalysis>)
  } catch (error) {
    return apiErrorResponse(error, {
      fallback: "Analysis failed",
      code: "ANALYSIS_ERROR",
      inferNotFound: true,
    })
  }
}
