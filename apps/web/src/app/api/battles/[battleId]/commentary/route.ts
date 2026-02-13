import { NextRequest, NextResponse } from "next/server"
import { apiErrorResponse } from "../../../../../lib/api-error"
import { getBattleCommentary, updateBattleCommentary } from "@nasty-plot/battle-engine"

export async function PUT(req: NextRequest, { params }: { params: Promise<{ battleId: string }> }) {
  const { battleId } = await params

  try {
    const { turn, text } = await req.json()

    if (typeof turn !== "number" || typeof text !== "string") {
      return NextResponse.json({ error: "Invalid turn or text" }, { status: 400 })
    }

    const battle = await getBattleCommentary(battleId)

    if (!battle) {
      return NextResponse.json({ error: "Battle not found" }, { status: 404 })
    }

    const existing: Record<string, string> = battle.commentary ? JSON.parse(battle.commentary) : {}

    existing[String(turn)] = text

    const updated = await updateBattleCommentary(battleId, JSON.stringify(existing))

    return NextResponse.json({
      commentary: JSON.parse(updated.commentary!),
    })
  } catch (err) {
    console.error("[PUT /api/battles/commentary]", err)
    return apiErrorResponse(err, { fallback: "Failed to save commentary" })
  }
}
