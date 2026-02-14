import { NextResponse } from "next/server"
import { getSyncLogs } from "@nasty-plot/smogon-data"
import { apiErrorResponse } from "../../../../lib/api-error"

export async function GET() {
  try {
    const status = await getSyncLogs()

    return NextResponse.json({ data: status })
  } catch (err) {
    return apiErrorResponse(err, { code: "STATUS_ERROR" })
  }
}
