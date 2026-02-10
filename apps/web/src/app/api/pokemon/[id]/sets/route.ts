import { NextRequest, NextResponse } from "next/server"
import { getSetsForPokemon } from "@nasty-plot/smogon-data"
import type { ApiResponse, SmogonSetData } from "@nasty-plot/core"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: pokemonId } = await params
  const searchParams = request.nextUrl.searchParams
  const format = searchParams.get("format")

  if (!format) {
    return NextResponse.json(
      {
        error: "Missing required query parameter: format",
        code: "MISSING_FORMAT",
        suggestion: "Add ?format=gen9ou to the request URL",
      },
      { status: 400 },
    )
  }

  try {
    const sets = await getSetsForPokemon(format, pokemonId)

    const response: ApiResponse<SmogonSetData[]> = { data: sets }
    return NextResponse.json(response)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message, code: "SETS_ERROR" }, { status: 500 })
  }
}
