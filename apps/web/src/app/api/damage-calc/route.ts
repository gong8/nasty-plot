import { NextRequest, NextResponse } from "next/server"
import { calculateDamage } from "@nasty-plot/damage-calc"
import type { DamageCalcInput, ApiResponse, DamageCalcResult, ApiError } from "@nasty-plot/core"
import { apiErrorResponse } from "../../../lib/api-error"

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as DamageCalcInput

    if (!body.attacker?.pokemonId || !body.defender?.pokemonId || !body.move) {
      return NextResponse.json(
        {
          error: "Missing required fields: attacker.pokemonId, defender.pokemonId, move",
          code: "INVALID_INPUT",
        } satisfies ApiError,
        { status: 400 },
      )
    }

    const result = calculateDamage(body)

    return NextResponse.json({ data: result } satisfies ApiResponse<DamageCalcResult>)
  } catch (error) {
    return apiErrorResponse(error, { fallback: "Calculation failed", code: "CALC_ERROR" })
  }
}
