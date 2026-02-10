import { NextResponse } from "next/server";
import { getAllFormats } from "@/modules/formats";
import type { ApiResponse, FormatDefinition } from "@/shared/types";

export async function GET() {
  const formats = getAllFormats();
  const response: ApiResponse<FormatDefinition[]> = { data: formats };
  return NextResponse.json(response);
}
