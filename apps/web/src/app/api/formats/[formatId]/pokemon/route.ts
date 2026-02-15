import { NextResponse } from "next/server"
import { getFormat, getFormatPokemon } from "@nasty-plot/formats"
import { type PaginatedResponse, type PokemonSpecies } from "@nasty-plot/core"
import { notFoundResponse } from "../../../../../lib/api-error"
import { validateSearchParams } from "../../../../../lib/validation"
import { formatPokemonSearchSchema } from "../../../../../lib/schemas/format.schemas"

export async function GET(request: Request, { params }: { params: Promise<{ formatId: string }> }) {
  const { formatId } = await params
  const format = getFormat(formatId)

  if (!format) {
    return notFoundResponse("Format")
  }

  const [searchParams, error] = validateSearchParams(request.url, formatPokemonSearchSchema)
  if (error) return error

  let species: PokemonSpecies[] = getFormatPokemon(formatId)

  if (searchParams.search) {
    const lower = searchParams.search.toLowerCase()
    species = species.filter((s) => s.name.toLowerCase().includes(lower))
  }

  const total = species.length
  const start = (searchParams.page - 1) * searchParams.pageSize
  const data = species.slice(start, start + searchParams.pageSize)

  const response: PaginatedResponse<PokemonSpecies> = {
    data,
    total,
    page: searchParams.page,
    pageSize: searchParams.pageSize,
  }

  return NextResponse.json(response)
}
