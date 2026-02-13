import { NextRequest, NextResponse } from "next/server"
import { loggedApiErrorResponse, badRequestResponse } from "../../../lib/api-error"
import { listBattles, createBattle } from "@nasty-plot/battle-engine/db"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get("page") || "1", 10)
  const limit = parseInt(searchParams.get("limit") || "20", 10)
  const teamId = searchParams.get("teamId")

  const result = await listBattles({ page, limit, teamId })

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      formatId,
      gameType,
      mode = "play",
      aiDifficulty,
      team1Paste,
      team1Name,
      team2Paste,
      team2Name,
      team1Id,
      team2Id,
      winnerId,
      turnCount,
      protocolLog,
      commentary,
      turns,
      chatSessionId,
    } = body

    if (!formatId || !team1Paste || !team2Paste || !protocolLog) {
      return badRequestResponse("Missing required fields")
    }

    const battle = await createBattle({
      formatId,
      gameType,
      mode,
      aiDifficulty,
      team1Paste,
      team1Name,
      team2Paste,
      team2Name,
      team1Id,
      team2Id,
      winnerId,
      turnCount,
      protocolLog,
      commentary,
      turns,
      chatSessionId,
    })

    return NextResponse.json(battle, { status: 201 })
  } catch (err) {
    return loggedApiErrorResponse("[POST /api/battles]", err, { fallback: "Failed to save battle" })
  }
}
