import { NextRequest, NextResponse } from "next/server"
import { apiErrorResponse } from "../../../../../lib/api-error"
import { getUsageStats, getUsageStatsCount } from "@nasty-plot/smogon-data"
import { enrichWithSpeciesData } from "@nasty-plot/pokemon-data"
import { type PaginatedResponse, type UsageStatsEntry } from "@nasty-plot/core"
import { validateSearchParams } from "../../../../../lib/validation"
import { formatUsageSearchSchema } from "../../../../../lib/schemas/format.schemas"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ formatId: string }> },
) {
  const { formatId } = await params
  const [searchParams, error] = validateSearchParams(request.url, formatUsageSearchSchema)
  if (error) return error

  try {
    const [data, total] = await Promise.all([
      getUsageStats(formatId, { limit: searchParams.limit, page: searchParams.page }),
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
      page: searchParams.page,
      pageSize: searchParams.limit,
    }

    return NextResponse.json(response, {
      headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=600" },
    })
  } catch (err) {
    return apiErrorResponse(err, { code: "USAGE_STATS_ERROR" })
  }
}
