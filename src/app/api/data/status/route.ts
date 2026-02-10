import { NextResponse } from "next/server";
import { getDataStatus } from "@/modules/data-pipeline/services/staleness.service";
import type { ApiResponse } from "@/shared/types";

export async function GET() {
  try {
    const status = await getDataStatus();

    const response: ApiResponse<typeof status> = { data: status };
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: message, code: "STATUS_ERROR" },
      { status: 500 }
    );
  }
}
