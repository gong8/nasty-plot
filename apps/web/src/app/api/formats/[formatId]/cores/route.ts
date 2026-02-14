import { NextRequest, NextResponse } from "next/server"
import { apiErrorResponse } from "../../../../../lib/api-error"
import { parseIntQueryParam } from "@nasty-plot/core"
import { getTopCores } from "@nasty-plot/smogon-data"
import { enrichWithSpeciesData } from "@nasty-plot/pokemon-data"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ formatId: string }> },
) {
  const { formatId } = await params
  const searchParams = request.nextUrl.searchParams
  const pokemonId = searchParams.get("pokemonId") ?? undefined
  const limit = parseIntQueryParam(searchParams.get("limit"), 20, 1, 100)

  try {
    const cores = await getTopCores(formatId, { pokemonId, limit })

    const enriched = cores.map((core) => {
      const { pokemonName: pokemonAName } = enrichWithSpeciesData(core.pokemonAId)
      const { pokemonName: pokemonBName } = enrichWithSpeciesData(core.pokemonBId)
      return {
        pokemonAId: core.pokemonAId,
        pokemonAName: pokemonAName ?? core.pokemonAId,
        pokemonBId: core.pokemonBId,
        pokemonBName: pokemonBName ?? core.pokemonBId,
        correlationPercent: core.correlationPercent,
      }
    })

    return NextResponse.json({ data: enriched })
  } catch (error) {
    return apiErrorResponse(error, { code: "CORES_ERROR" })
  }
}
