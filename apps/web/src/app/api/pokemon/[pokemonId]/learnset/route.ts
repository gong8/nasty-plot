import { NextResponse } from "next/server"
import { getSpecies, getLearnset, getMove } from "@nasty-plot/pokemon-data"
import { getFormatLearnset } from "@nasty-plot/formats"
import type { ApiResponse, MoveData } from "@nasty-plot/core"
import { notFoundResponse } from "../../../../../lib/api-error"
import { validateSearchParams } from "../../../../../lib/validation"
import { pokemonLearnsetSearchSchema } from "../../../../../lib/schemas/pokemon.schemas"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ pokemonId: string }> },
) {
  const { pokemonId } = await params
  const [searchParams, error] = validateSearchParams(request.url, pokemonLearnsetSearchSchema)
  if (error) return error

  const species = getSpecies(pokemonId)

  if (!species) {
    return notFoundResponse("Pokemon")
  }

  const moveIds = searchParams.formatId
    ? await getFormatLearnset(pokemonId, searchParams.formatId)
    : await getLearnset(pokemonId)

  const moves = moveIds
    .map(getMove)
    .filter((move): move is MoveData => move !== undefined)
    .filter(
      (move) => !searchParams.type || move.type.toLowerCase() === searchParams.type.toLowerCase(),
    )
    .filter(
      (move) =>
        !searchParams.category ||
        move.category.toLowerCase() === searchParams.category.toLowerCase(),
    )
    .sort((a, b) => a.name.localeCompare(b.name))

  const response: ApiResponse<MoveData[]> = { data: moves }
  return NextResponse.json(response)
}
