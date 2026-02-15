import { NextRequest, NextResponse } from "next/server"
import { getRecommendations } from "@nasty-plot/recommendations"
import type { ApiResponse, Recommendation } from "@nasty-plot/core"
import { apiErrorResponse } from "../../../lib/api-error"
import { validateBody } from "../../../lib/validation"
import { recommendSchema } from "../../../lib/schemas/data.schemas"

export async function POST(request: NextRequest) {
  try {
    const [body, error] = await validateBody(request, recommendSchema)
    if (error) return error

    const recommendations = await getRecommendations(body.teamId, body.limit ?? 10, body.weights)

    return NextResponse.json({
      data: recommendations,
    } satisfies ApiResponse<Recommendation[]>)
  } catch (err) {
    return apiErrorResponse(err, {
      fallback: "Recommendations failed",
      code: "RECOMMEND_ERROR",
      inferNotFound: true,
    })
  }
}
