import { NextResponse } from "next/server"
import { listFormats } from "@nasty-plot/formats"
import type { ApiResponse, FormatDefinition } from "@nasty-plot/core"
import { apiErrorResponse } from "../../../lib/api-error"

export async function GET() {
  try {
    const formats = listFormats()
    const response: ApiResponse<FormatDefinition[]> = { data: formats }
    return NextResponse.json(response, {
      headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=3600" },
    })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
