import { NextRequest, NextResponse } from "next/server";
import { calculateDamage } from "@/modules/damage-calc/services/calc.service";
import type { DamageCalcInput, ApiResponse, DamageCalcResult, ApiError } from "@/shared/types";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as DamageCalcInput;

    if (!body.attacker?.pokemonId || !body.defender?.pokemonId || !body.move) {
      return NextResponse.json(
        { error: "Missing required fields: attacker.pokemonId, defender.pokemonId, move", code: "INVALID_INPUT" } satisfies ApiError,
        { status: 400 }
      );
    }

    const result = calculateDamage(body);

    return NextResponse.json({ data: result } satisfies ApiResponse<DamageCalcResult>);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Calculation failed";
    return NextResponse.json(
      { error: message, code: "CALC_ERROR" } satisfies ApiError,
      { status: 500 }
    );
  }
}
