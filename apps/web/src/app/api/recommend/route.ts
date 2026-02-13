import { NextRequest, NextResponse } from "next/server"
import { getRecommendations } from "@nasty-plot/recommendations"
import type { ApiResponse, Recommendation, ApiError } from "@nasty-plot/core"
import { apiErrorResponse } from "../../../lib/api-error"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { teamId, limit, weights } = body as {
      teamId: string
      limit?: number
      weights?: { usage: number; coverage: number }
    }

    if (!teamId) {
      return NextResponse.json(
        { error: "Missing required field: teamId", code: "INVALID_INPUT" } satisfies ApiError,
        { status: 400 },
      )
    }

    const recommendations = await getRecommendations(teamId, limit ?? 10, weights)

    return NextResponse.json({
      data: recommendations,
    } satisfies ApiResponse<Recommendation[]>)
  } catch (error) {
    return apiErrorResponse(error, {
      fallback: "Recommendations failed",
      code: "RECOMMEND_ERROR",
      inferNotFound: true,
    })
  }
}
