import { NextResponse } from "next/server"
import { getAllFormats } from "@nasty-plot/formats"
import type { ApiResponse, FormatDefinition } from "@nasty-plot/core"

export async function GET() {
  const formats = getAllFormats()
  const response: ApiResponse<FormatDefinition[]> = { data: formats }
  return NextResponse.json(response)
}
