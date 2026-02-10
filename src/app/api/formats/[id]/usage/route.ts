import { NextRequest, NextResponse } from "next/server";
import {
  getUsageStats,
  getUsageStatsCount,
} from "@/modules/smogon-data/services/usage-stats.service";
import type { PaginatedResponse, UsageStatsEntry } from "@/shared/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: formatId } = await params;
  const searchParams = request.nextUrl.searchParams;
  const limit = Math.min(
    Math.max(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 1),
    200
  );
  const page = Math.max(
    parseInt(searchParams.get("page") ?? "1", 10) || 1,
    1
  );

  try {
    const [data, total] = await Promise.all([
      getUsageStats(formatId, { limit, page }),
      getUsageStatsCount(formatId),
    ]);

    const response: PaginatedResponse<UsageStatsEntry> = {
      data,
      total,
      page,
      pageSize: limit,
    };

    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: message, code: "USAGE_STATS_ERROR" },
      { status: 500 }
    );
  }
}
