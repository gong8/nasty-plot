import { NextRequest, NextResponse } from "next/server"
import { cleanupEmptyTeams } from "@nasty-plot/teams"
import { apiErrorResponse } from "../../../../lib/api-error"

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  const expectedToken = process.env.SEED_SECRET
  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  console.warn(`[Cleanup] Team cleanup triggered at ${new Date().toISOString()}`)

  try {
    const deletedCount = await cleanupEmptyTeams()
    return NextResponse.json({
      data: { deletedTeams: deletedCount },
    })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
