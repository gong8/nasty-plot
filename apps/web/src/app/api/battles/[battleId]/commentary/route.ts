import { NextRequest, NextResponse } from "next/server"
import { apiErrorResponse, notFoundResponse } from "../../../../../lib/api-error"
import { getBattleCommentary, updateBattleCommentary } from "@nasty-plot/battle-engine/db"
import { validateBody } from "../../../../../lib/validation"
import { battleCommentaryUpdateSchema } from "../../../../../lib/schemas/battle.schemas"

export async function PUT(req: NextRequest, { params }: { params: Promise<{ battleId: string }> }) {
  const { battleId } = await params

  try {
    const [body, error] = await validateBody(req, battleCommentaryUpdateSchema)
    if (error) return error

    const battle = await getBattleCommentary(battleId)

    if (!battle) {
      return notFoundResponse("Battle")
    }

    const commentaryByTurn: Record<string, string> = battle.commentary
      ? JSON.parse(battle.commentary)
      : {}

    commentaryByTurn[String(body.turn)] = body.text

    const updated = await updateBattleCommentary(battleId, JSON.stringify(commentaryByTurn))

    return NextResponse.json({
      commentary: JSON.parse(updated.commentary!),
    })
  } catch (err) {
    return apiErrorResponse(err, {
      fallback: "Failed to save commentary",
    })
  }
}
