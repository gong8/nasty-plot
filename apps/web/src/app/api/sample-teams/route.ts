import { NextResponse } from "next/server"
import { createSampleTeam, listSampleTeams } from "@nasty-plot/teams"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const formatId = searchParams.get("formatId") || undefined
    const archetype = searchParams.get("archetype") || undefined
    const search = searchParams.get("search") || undefined
    const teams = await listSampleTeams({ formatId, archetype, search })
    return NextResponse.json(teams)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (!body.name || !body.formatId || !body.paste) {
      return NextResponse.json({ error: "name, formatId, and paste are required" }, { status: 400 })
    }
    const team = await createSampleTeam({
      name: body.name,
      formatId: body.formatId,
      paste: body.paste,
      archetype: body.archetype,
      source: body.source,
      sourceUrl: body.sourceUrl,
    })
    return NextResponse.json(team, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
