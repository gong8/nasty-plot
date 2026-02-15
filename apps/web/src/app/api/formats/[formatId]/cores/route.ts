import { NextRequest, NextResponse } from "next/server"
import { apiErrorResponse } from "../../../../../lib/api-error"
import { getTopCores } from "@nasty-plot/smogon-data"
import { enrichWithSpeciesData } from "@nasty-plot/pokemon-data"
import { validateSearchParams } from "../../../../../lib/validation"
import { formatCoresSearchSchema } from "../../../../../lib/schemas/format.schemas"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ formatId: string }> },
) {
  const { formatId } = await params
  const [searchParams, error] = validateSearchParams(request.url, formatCoresSearchSchema)
  if (error) return error

  try {
    const cores = await getTopCores(formatId, {
      pokemonId: searchParams.pokemonId,
      limit: searchParams.limit,
    })

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
  } catch (err) {
    return apiErrorResponse(err, { code: "CORES_ERROR" })
  }
}
