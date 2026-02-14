import { NextRequest, NextResponse } from "next/server"
import { apiErrorResponse, badRequestResponse } from "../../../../../lib/api-error"
import { getSetsForPokemon } from "@nasty-plot/smogon-data"
import type { ApiResponse, SmogonSetData } from "@nasty-plot/core"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pokemonId: string }> },
) {
  const { pokemonId } = await params
  const searchParams = request.nextUrl.searchParams
  const format = searchParams.get("formatId")

  if (!format) {
    return badRequestResponse("Missing required query parameter: format", "MISSING_FORMAT")
  }

  try {
    const sets = await getSetsForPokemon(format, pokemonId)

    const response: ApiResponse<SmogonSetData[]> = { data: sets }
    return NextResponse.json(response)
  } catch (error) {
    return apiErrorResponse(error, { code: "SETS_ERROR" })
  }
}
