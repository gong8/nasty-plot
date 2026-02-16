import { NextRequest, NextResponse } from "next/server"
import { apiErrorResponse } from "../../../lib/api-error"
import { listBattles, createBattle, type CreateBattleData } from "@nasty-plot/battle-engine/db"
import { validateBody, validateSearchParams } from "../../../lib/validation"
import { battleCreateSchema, battleListSearchSchema } from "../../../lib/schemas/battle.schemas"

export async function GET(req: NextRequest) {
  const [params, error] = validateSearchParams(req.url, battleListSearchSchema)
  if (error) return error

  try {
    const result = await listBattles({
      page: params.page,
      limit: params.limit,
      teamId: params.teamId,
    })

    return NextResponse.json(result)
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const [body, error] = await validateBody(req, battleCreateSchema)
    if (error) return error

    const battle = await createBattle(body as CreateBattleData)

    return NextResponse.json(battle, { status: 201 })
  } catch (err) {
    return apiErrorResponse(err, { fallback: "Failed to save battle" })
  }
}
