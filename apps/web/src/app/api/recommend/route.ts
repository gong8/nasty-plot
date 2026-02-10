import { NextRequest, NextResponse } from "next/server";
import { getRecommendations } from "@nasty-plot/recommendations";
import type { ApiResponse, Recommendation, ApiError } from "@nasty-plot/core";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { teamId, limit, weights } = body as {
      teamId: string;
      formatId?: string;
      limit?: number;
      weights?: { usage: number; coverage: number };
    };

    if (!teamId) {
      return NextResponse.json(
        { error: "Missing required field: teamId", code: "INVALID_INPUT" } satisfies ApiError,
        { status: 400 }
      );
    }

    const recommendations = await getRecommendations(
      teamId,
      limit ?? 10,
      weights ?? undefined
    );

    return NextResponse.json({
      data: recommendations,
    } satisfies ApiResponse<Recommendation[]>);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Recommendations failed";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json(
      { error: message, code: status === 404 ? "NOT_FOUND" : "RECOMMEND_ERROR" } satisfies ApiError,
      { status }
    );
  }
}
