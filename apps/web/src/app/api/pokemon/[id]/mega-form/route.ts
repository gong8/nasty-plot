import { NextResponse } from "next/server"
import { getMegaForm } from "@nasty-plot/pokemon-data"
import type { ApiResponse, PokemonSpecies } from "@nasty-plot/core"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const itemId = searchParams.get("item")

  if (!itemId) {
    return NextResponse.json(
      { error: "Missing ?item= query parameter", code: "BAD_REQUEST" },
      { status: 400 },
    )
  }

  const megaForm = getMegaForm(id, itemId)

  if (!megaForm) {
    return NextResponse.json(
      { error: "No Mega form for this combination", code: "NOT_FOUND" },
      { status: 404 },
    )
  }

  const response: ApiResponse<PokemonSpecies> = { data: megaForm }
  return NextResponse.json(response)
}
