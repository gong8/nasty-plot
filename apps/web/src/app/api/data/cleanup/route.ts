import { NextResponse } from "next/server"
import { cleanupEmptyTeams } from "@nasty-plot/teams"

export async function POST() {
  try {
    const deletedCount = await cleanupEmptyTeams()
    return NextResponse.json({
      data: { deletedTeams: deletedCount },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
