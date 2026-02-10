import { NextResponse } from "next/server";
import { analyzeTeam } from "@/modules/analysis/services/analysis.service";
import type { ApiResponse, TeamAnalysis, ApiError } from "@/shared/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;

    const analysis = await analyzeTeam(teamId);

    return NextResponse.json({ data: analysis } satisfies ApiResponse<TeamAnalysis>);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analysis failed";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json(
      { error: message, code: status === 404 ? "NOT_FOUND" : "ANALYSIS_ERROR" } satisfies ApiError,
      { status }
    );
  }
}
