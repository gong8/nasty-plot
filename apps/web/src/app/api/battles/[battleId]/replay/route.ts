import { NextRequest, NextResponse } from "next/server"
import { getBattleReplay } from "@nasty-plot/battle-engine"
import { notFoundResponse } from "../../../../../lib/api-error"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ battleId: string }> },
) {
  const { battleId } = await params
  const battle = await getBattleReplay(battleId)

  if (!battle) {
    return notFoundResponse("Battle")
  }

  return NextResponse.json(battle)
}
