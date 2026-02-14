import { NextRequest, NextResponse } from "next/server"
import { apiErrorResponse } from "../../../../../lib/api-error"
import { getUsageStats, getUsageStatsCount } from "@nasty-plot/smogon-data"
import { enrichWithSpeciesData } from "@nasty-plot/pokemon-data"
import { parseIntQueryParam, type PaginatedResponse, type UsageStatsEntry } from "@nasty-plot/core"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ formatId: string }> },
) {
  const { formatId } = await params
  const searchParams = request.nextUrl.searchParams
  const limit = parseIntQueryParam(searchParams.get("limit"), 50, 1, 200)
  const page = parseIntQueryParam(searchParams.get("page"), 1, 1, Number.MAX_SAFE_INTEGER)

  try {
    const [data, total] = await Promise.all([
      getUsageStats(formatId, { limit, page }),
      getUsageStatsCount(formatId),
    ])

    const enriched: UsageStatsEntry[] = data.map((entry) => {
      const speciesData = enrichWithSpeciesData(entry.pokemonId)
      return {
        ...entry,
        pokemonName: speciesData.pokemonName ?? entry.pokemonId,
        types: (speciesData.types as UsageStatsEntry["types"]) ?? [],
        num: speciesData.num,
      }
    })

    const response: PaginatedResponse<UsageStatsEntry> = {
      data: enriched,
      total,
      page,
      pageSize: limit,
    }

    return NextResponse.json(response)
  } catch (err) {
    return apiErrorResponse(err, { code: "USAGE_STATS_ERROR" })
  }
}
