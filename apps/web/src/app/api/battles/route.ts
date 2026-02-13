import { NextRequest, NextResponse } from "next/server"
import { apiErrorResponse } from "../../../lib/api-error"
import { prisma } from "@nasty-plot/db"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get("page") || "1", 10)
  const limit = parseInt(searchParams.get("limit") || "20", 10)
  const teamId = searchParams.get("teamId")
  const skip = (page - 1) * limit

  const where = teamId ? { OR: [{ team1Id: teamId }, { team2Id: teamId }] } : {}

  const [battles, total] = await Promise.all([
    prisma.battle.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        formatId: true,
        gameType: true,
        mode: true,
        aiDifficulty: true,
        team1Name: true,
        team2Name: true,
        team1Id: true,
        team2Id: true,
        batchId: true,
        winnerId: true,
        turnCount: true,
        createdAt: true,
      },
    }),
    prisma.battle.count({ where }),
  ])

  return NextResponse.json({ battles, total, page, limit })
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
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const battle = await prisma.battle.create({
      data: {
        formatId,
        gameType: gameType || "singles",
        mode,
        aiDifficulty: aiDifficulty || null,
        team1Paste,
        team1Name: team1Name || "Player",
        team2Paste,
        team2Name: team2Name || "Opponent",
        team1Id: team1Id || null,
        team2Id: team2Id || null,
        winnerId: winnerId || null,
        turnCount: turnCount || 0,
        protocolLog,
        commentary: commentary ? JSON.stringify(commentary) : null,
        chatSessionId: chatSessionId || null,
        turns: turns?.length
          ? {
              create: turns.map(
                (t: {
                  turnNumber: number
                  team1Action: string
                  team2Action: string
                  stateSnapshot: string
                  winProbTeam1?: number
                }) => ({
                  turnNumber: t.turnNumber,
                  team1Action: t.team1Action,
                  team2Action: t.team2Action,
                  stateSnapshot: t.stateSnapshot,
                  winProbTeam1: t.winProbTeam1 ?? null,
                }),
              ),
            }
          : undefined,
      },
    })

    return NextResponse.json(battle, { status: 201 })
  } catch (err) {
    console.error("[POST /api/battles]", err)
    return apiErrorResponse(err, { fallback: "Failed to save battle" })
  }
}
