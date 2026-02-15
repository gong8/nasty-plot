import { NextResponse } from "next/server"
import { listFormats } from "@nasty-plot/formats"
import type { ApiResponse, FormatDefinition } from "@nasty-plot/core"

export async function GET() {
  const formats = listFormats()
  const response: ApiResponse<FormatDefinition[]> = { data: formats }
  return NextResponse.json(response, {
    headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=3600" },
  })
}
