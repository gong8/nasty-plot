import { NextResponse } from "next/server"
import { getMegaForm } from "@nasty-plot/pokemon-data"
import type { ApiResponse, PokemonSpecies } from "@nasty-plot/core"
import { notFoundResponse } from "../../../../../lib/api-error"
import { validateSearchParams } from "../../../../../lib/validation"
import { pokemonMegaFormSearchSchema } from "../../../../../lib/schemas/pokemon.schemas"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ pokemonId: string }> },
) {
  const { pokemonId } = await params
  const [searchParams, error] = validateSearchParams(request.url, pokemonMegaFormSearchSchema)
  if (error) return error

  const megaForm = getMegaForm(pokemonId, searchParams.item)

  if (!megaForm) {
    return notFoundResponse("Mega form")
  }

  const response: ApiResponse<PokemonSpecies> = { data: megaForm }
  return NextResponse.json(response)
}
