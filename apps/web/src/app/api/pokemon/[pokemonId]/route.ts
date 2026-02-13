import { NextResponse } from "next/server"
import { getSpecies, getLearnset } from "@nasty-plot/pokemon-data"
import type { ApiResponse, PokemonSpecies } from "@nasty-plot/core"
import { notFoundResponse } from "../../../../lib/api-error"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ pokemonId: string }> },
) {
  const { pokemonId } = await params
  const species = getSpecies(pokemonId)

  if (!species) {
    return notFoundResponse("Pokemon")
  }

  const learnset = await getLearnset(pokemonId)

  const response: ApiResponse<PokemonSpecies & { learnset: string[] }> = {
    data: { ...species, learnset },
  }

  return NextResponse.json(response)
}
