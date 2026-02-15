import { NextRequest, NextResponse } from "next/server"
import { calculateDamage } from "@nasty-plot/damage-calc"
import type { ApiResponse, DamageCalcResult } from "@nasty-plot/core"
import { apiErrorResponse } from "../../../lib/api-error"
import { validateBody } from "../../../lib/validation"
import { damageCalcSchema } from "../../../lib/schemas/battle.schemas"

export async function POST(request: NextRequest) {
  try {
    const [body, error] = await validateBody(request, damageCalcSchema)
    if (error) return error

    const result = calculateDamage(body)

    return NextResponse.json({ data: result } satisfies ApiResponse<DamageCalcResult>)
  } catch (err) {
    return apiErrorResponse(err, { fallback: "Calculation failed", code: "CALC_ERROR" })
  }
}
