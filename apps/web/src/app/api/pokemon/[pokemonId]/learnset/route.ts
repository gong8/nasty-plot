import { NextResponse } from "next/server"
import { getSpecies, getLearnset, getMove } from "@nasty-plot/pokemon-data"
import { getFormatLearnset } from "@nasty-plot/formats"
import type { ApiResponse, MoveData } from "@nasty-plot/core"
import { notFoundResponse } from "../../../../../lib/api-error"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ pokemonId: string }> },
) {
  const { pokemonId } = await params
  const { searchParams } = new URL(request.url)
  const formatId = searchParams.get("formatId")

  const species = getSpecies(pokemonId)

  if (!species) {
    return notFoundResponse("Pokemon")
  }

  const moveIds = formatId
    ? await getFormatLearnset(pokemonId, formatId)
    : await getLearnset(pokemonId)
  const moves = moveIds
    .map(getMove)
    .filter((move): move is MoveData => move !== undefined)
    .sort((a, b) => a.name.localeCompare(b.name))

  const response: ApiResponse<MoveData[]> = { data: moves }
  return NextResponse.json(response)
}
