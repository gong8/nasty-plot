import { NextRequest, NextResponse } from "next/server";
import { getRecommendations } from "@nasty-plot/recommendations";
import type { ApiResponse, Recommendation, ApiError } from "@nasty-plot/core";

class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { teamId, limit, weights } = body as {
      teamId: string;
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
      weights
    );

    return NextResponse.json({
      data: recommendations,
    } satisfies ApiResponse<Recommendation[]>);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Recommendations failed";

    if (error instanceof NotFoundError || message.toLowerCase().includes("not found")) {
      return NextResponse.json(
        { error: message, code: "NOT_FOUND" } satisfies ApiError,
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: message, code: "RECOMMEND_ERROR" } satisfies ApiError,
      { status: 500 }
    );
  }
}
