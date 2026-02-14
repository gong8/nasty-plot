import { NextResponse } from "next/server"
import { restoreTeam } from "@nasty-plot/teams"
import { entityErrorResponse } from "../../../../../lib/api-error"

export async function POST(_request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  try {
    const { teamId } = await params
    await restoreTeam(teamId)
    return NextResponse.json({ success: true })
  } catch (error) {
    return entityErrorResponse(error)
  }
}
