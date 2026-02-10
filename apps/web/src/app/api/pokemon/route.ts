import { NextResponse } from "next/server"
import { getAllSpecies } from "@nasty-plot/pokemon-data"
import { getFormatPokemon } from "@nasty-plot/formats"
import type { PaginatedResponse, PokemonSpecies, PokemonType } from "@nasty-plot/core"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const search = searchParams.get("search") ?? ""
  const typeFilter = searchParams.get("type") as PokemonType | null
  const formatId = searchParams.get("format")
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10))
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "50", 10)))

  let species: PokemonSpecies[]

  if (formatId) {
    species = getFormatPokemon(formatId)
  } else {
    species = getAllSpecies()
  }

  if (search) {
    const lower = search.toLowerCase()
    species = species.filter((s) => s.name.toLowerCase().includes(lower))
  }

  if (typeFilter) {
    species = species.filter((s) => s.types.includes(typeFilter))
  }

  const total = species.length
  const start = (page - 1) * pageSize
  const data = species.slice(start, start + pageSize)

  const response: PaginatedResponse<PokemonSpecies> = {
    data,
    total,
    page,
    pageSize,
  }

  return NextResponse.json(response)
}
