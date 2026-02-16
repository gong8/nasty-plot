import { NextResponse } from "next/server"
import { getSpecies, getLearnset } from "@nasty-plot/pokemon-data"
import type { ApiResponse, PokemonSpecies } from "@nasty-plot/core"
import { apiErrorResponse, notFoundResponse } from "../../../../lib/api-error"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ pokemonId: string }> },
) {
  try {
    const { pokemonId } = await params
    const species = getSpecies(pokemonId)

    if (!species) {
      return notFoundResponse("Pokemon")
    }

    const learnset = await getLearnset(pokemonId)

    const response: ApiResponse<PokemonSpecies & { learnset: string[] }> = {
      data: { ...species, learnset },
    }

    return NextResponse.json(response, {
      headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=3600" },
    })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
