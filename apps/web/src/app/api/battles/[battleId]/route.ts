import { NextRequest, NextResponse } from "next/server"
import { getBattle, deleteBattle } from "@nasty-plot/battle-engine/db"
import { apiErrorResponse, notFoundResponse } from "../../../../lib/api-error"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ battleId: string }> },
) {
  try {
    const { battleId } = await params
    const battle = await getBattle(battleId)

    if (!battle) {
      return notFoundResponse("Battle")
    }

    return NextResponse.json(battle)
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ battleId: string }> },
) {
  const { battleId } = await params
  try {
    await deleteBattle(battleId)
    return NextResponse.json({ success: true })
  } catch {
    return notFoundResponse("Battle")
  }
}
