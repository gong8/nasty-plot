import { NextResponse } from "next/server"
import { getFormat, getFormatPokemon } from "@nasty-plot/formats"
import type { PaginatedResponse, PokemonSpecies } from "@nasty-plot/core"
import { notFoundResponse } from "../../../../../lib/api-error"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const format = getFormat(id)

  if (!format) {
    return notFoundResponse("Format")
  }

  const { searchParams } = new URL(request.url)
  const search = searchParams.get("search") ?? ""
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10))
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "50", 10)))

  let species: PokemonSpecies[] = getFormatPokemon(id)

  if (search) {
    const lower = search.toLowerCase()
    species = species.filter((s) => s.name.toLowerCase().includes(lower))
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
