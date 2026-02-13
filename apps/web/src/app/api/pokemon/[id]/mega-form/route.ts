import { NextResponse } from "next/server"
import { getMegaForm } from "@nasty-plot/pokemon-data"
import type { ApiResponse, PokemonSpecies } from "@nasty-plot/core"
import { badRequestResponse, notFoundResponse } from "../../../../../lib/api-error"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const itemId = searchParams.get("item")

  if (!itemId) {
    return badRequestResponse("Missing ?item= query parameter")
  }

  const megaForm = getMegaForm(id, itemId)

  if (!megaForm) {
    return notFoundResponse("Mega form")
  }

  const response: ApiResponse<PokemonSpecies> = { data: megaForm }
  return NextResponse.json(response)
}
