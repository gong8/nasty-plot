import { NextResponse } from "next/server"
import { cleanupEmptyTeams } from "@nasty-plot/teams"
import { apiErrorResponse } from "../../../../lib/api-error"

export async function POST() {
  try {
    const deletedCount = await cleanupEmptyTeams()
    return NextResponse.json({
      data: { deletedTeams: deletedCount },
    })
  } catch (err) {
    return apiErrorResponse(err)
  }
}
