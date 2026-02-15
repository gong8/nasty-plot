import { NextRequest, NextResponse } from "next/server"
import { apiErrorResponse } from "../../../../../lib/api-error"
import { getSetsForPokemon } from "@nasty-plot/smogon-data"
import type { ApiResponse, SmogonSetData } from "@nasty-plot/core"
import { validateSearchParams } from "../../../../../lib/validation"
import { pokemonSetsSearchSchema } from "../../../../../lib/schemas/pokemon.schemas"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pokemonId: string }> },
) {
  const { pokemonId } = await params
  const [searchParams, error] = validateSearchParams(request.url, pokemonSetsSearchSchema)
  if (error) return error

  try {
    const sets = await getSetsForPokemon(searchParams.formatId, pokemonId)

    const response: ApiResponse<SmogonSetData[]> = { data: sets }
    return NextResponse.json(response, {
      headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=3600" },
    })
  } catch (err) {
    return apiErrorResponse(err, { code: "SETS_ERROR" })
  }
}
