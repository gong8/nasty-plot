import { NextResponse } from "next/server"
import { importSampleTeamsFromPastes } from "@nasty-plot/teams"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (!body.pastes || !Array.isArray(body.pastes) || !body.formatId) {
      return NextResponse.json(
        { error: "pastes (array) and formatId are required" },
        { status: 400 },
      )
    }
    const teams = await importSampleTeamsFromPastes(body.pastes, body.formatId, body.source)
    return NextResponse.json(teams, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
