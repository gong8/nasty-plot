import { NextResponse } from "next/server"
import { mergeTeams } from "@nasty-plot/teams"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { teamAId, teamBId, decisions, name, branchName, notes } = body

    if (!teamAId || !teamBId || !decisions) {
      return NextResponse.json(
        { error: "teamAId, teamBId, and decisions are required" },
        { status: 400 },
      )
    }

    const result = await mergeTeams(teamAId, teamBId, decisions, {
      name,
      branchName,
      notes,
    })
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    if (message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
