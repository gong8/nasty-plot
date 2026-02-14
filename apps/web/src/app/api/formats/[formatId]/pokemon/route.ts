import { NextResponse } from "next/server"
import { getFormat, getFormatPokemon } from "@nasty-plot/formats"
import { parseIntQueryParam, type PaginatedResponse, type PokemonSpecies } from "@nasty-plot/core"
import { notFoundResponse } from "../../../../../lib/api-error"

export async function GET(request: Request, { params }: { params: Promise<{ formatId: string }> }) {
  const { formatId } = await params
  const format = getFormat(formatId)

  if (!format) {
    return notFoundResponse("Format")
  }

  const { searchParams } = new URL(request.url)
  const search = searchParams.get("search") ?? ""
  const page = parseIntQueryParam(searchParams.get("page"), 1, 1, Number.MAX_SAFE_INTEGER)
  const pageSize = parseIntQueryParam(searchParams.get("pageSize"), 50, 1, 100)

  let species: PokemonSpecies[] = getFormatPokemon(formatId)

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
