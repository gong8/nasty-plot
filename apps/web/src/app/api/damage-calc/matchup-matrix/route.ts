import { NextRequest, NextResponse } from "next/server"
import { calculateMatchupMatrix } from "@nasty-plot/damage-calc"
import { getTeam } from "@nasty-plot/teams"
import { getUsageStats } from "@nasty-plot/smogon-data"
import type { ApiResponse, MatchupMatrixEntry } from "@nasty-plot/core"
import { apiErrorResponse, badRequestResponse, notFoundResponse } from "../../../../lib/api-error"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { teamId, threatIds, formatId } = body as {
      teamId: string
      threatIds?: string[]
      formatId: string
    }

    if (!teamId || !formatId) {
      return badRequestResponse("Missing required fields: teamId, formatId", "INVALID_INPUT")
    }

    const team = await getTeam(teamId)

    if (!team) {
      return notFoundResponse("Team")
    }

    // Resolve threat IDs: use provided or top usage Pokemon
    let resolvedThreats = threatIds ?? []
    if (resolvedThreats.length === 0) {
      const usageEntries = await getUsageStats(formatId, { limit: 10 })
      resolvedThreats = usageEntries.map((e) => e.pokemonId)
    }

    if (resolvedThreats.length === 0) {
      return NextResponse.json({
        data: [],
      } satisfies ApiResponse<MatchupMatrixEntry[][]>)
    }

    const matrix = calculateMatchupMatrix(team.slots, resolvedThreats, formatId)

    return NextResponse.json({
      data: matrix,
    } satisfies ApiResponse<MatchupMatrixEntry[][]>)
  } catch (error) {
    return apiErrorResponse(error, {
      fallback: "Matrix calculation failed",
      code: "CALC_ERROR",
    })
  }
}
