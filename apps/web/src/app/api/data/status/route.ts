import { NextResponse } from "next/server"
import { getDataStatus } from "@nasty-plot/data-pipeline"
import type { ApiResponse } from "@nasty-plot/core"
import { apiErrorResponse } from "../../../../lib/api-error"

export async function GET() {
  try {
    const status = await getDataStatus()

    const response: ApiResponse<typeof status> = { data: status }
    return NextResponse.json(response)
  } catch (err) {
    return apiErrorResponse(err, { code: "STATUS_ERROR" })
  }
}
