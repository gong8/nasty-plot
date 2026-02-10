import { NextResponse } from "next/server"
import { getSpecies, getLearnset } from "@nasty-plot/pokemon-data"
import type { ApiResponse, PokemonSpecies } from "@nasty-plot/core"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const species = getSpecies(id)

  if (!species) {
    return NextResponse.json({ error: "Pokemon not found", code: "NOT_FOUND" }, { status: 404 })
  }

  const learnset = await getLearnset(id)

  const response: ApiResponse<PokemonSpecies & { learnset: string[] }> = {
    data: { ...species, learnset },
  }

  return NextResponse.json(response)
}
