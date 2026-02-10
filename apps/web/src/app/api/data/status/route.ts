import { NextResponse } from "next/server";
import { getDataStatus } from "@nasty-plot/data-pipeline";
import type { ApiResponse } from "@nasty-plot/core";

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
