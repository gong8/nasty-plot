import { NextRequest, NextResponse } from "next/server"
import { apiErrorResponse } from "../../../../../lib/api-error"
import { getUsageStats, getUsageStatsCount } from "@nasty-plot/smogon-data"
import { getSpecies } from "@nasty-plot/pokemon-data"
import type { PaginatedResponse, UsageStatsEntry } from "@nasty-plot/core"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: formatId } = await params
  const searchParams = request.nextUrl.searchParams
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 1), 200)
  const page = Math.max(parseInt(searchParams.get("page") ?? "1", 10) || 1, 1)

  try {
    const [data, total] = await Promise.all([
      getUsageStats(formatId, { limit, page }),
      getUsageStatsCount(formatId),
    ])

    // Enrich each entry with species data from the dex
    const enriched: UsageStatsEntry[] = data.map((entry) => {
      const species = getSpecies(entry.pokemonId)
      return {
        ...entry,
        pokemonName: species?.name ?? entry.pokemonId,
        types: (species?.types as UsageStatsEntry["types"]) ?? [],
        num: species?.num,
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
