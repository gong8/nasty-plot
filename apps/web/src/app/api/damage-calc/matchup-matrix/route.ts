import { NextRequest, NextResponse } from "next/server"
import { calculateMatchupMatrix } from "@nasty-plot/damage-calc"
import { getTeam } from "@nasty-plot/teams"
import { getUsageStats } from "@nasty-plot/smogon-data"
import type { ApiResponse, MatchupMatrixEntry } from "@nasty-plot/core"
import { apiErrorResponse, notFoundResponse } from "../../../../lib/api-error"
import { validateBody } from "../../../../lib/validation"
import { matchupMatrixSchema } from "../../../../lib/schemas/battle.schemas"

export async function POST(request: NextRequest) {
  try {
    const [body, error] = await validateBody(request, matchupMatrixSchema)
    if (error) return error

    const team = await getTeam(body.teamId)

    if (!team) {
      return notFoundResponse("Team")
    }

    // Resolve threat IDs: use provided or top usage Pokemon
    let resolvedThreats = body.threatIds ?? []
    if (resolvedThreats.length === 0) {
      const usageEntries = await getUsageStats(body.formatId, { limit: 10 })
      resolvedThreats = usageEntries.map((e) => e.pokemonId)
    }

    if (resolvedThreats.length === 0) {
      return NextResponse.json({
        data: [],
      } satisfies ApiResponse<MatchupMatrixEntry[][]>)
    }

    const matrix = calculateMatchupMatrix(team.slots, resolvedThreats, body.formatId)

    return NextResponse.json({
      data: matrix,
    } satisfies ApiResponse<MatchupMatrixEntry[][]>)
  } catch (err) {
    return apiErrorResponse(err, {
      fallback: "Matrix calculation failed",
      code: "CALC_ERROR",
    })
  }
}
