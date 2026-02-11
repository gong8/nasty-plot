import { NextRequest, NextResponse } from "next/server"
import { getTopCores } from "@nasty-plot/smogon-data"
import { getSpecies } from "@nasty-plot/pokemon-data"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: formatId } = await params
  const searchParams = request.nextUrl.searchParams
  const pokemonId = searchParams.get("pokemonId") ?? undefined
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") ?? "20", 10) || 20, 1), 100)

  try {
    const cores = await getTopCores(formatId, { pokemonId, limit })

    const enriched = cores.map((core) => {
      const speciesA = getSpecies(core.pokemonAId)
      const speciesB = getSpecies(core.pokemonBId)
      return {
        pokemonAId: core.pokemonAId,
        pokemonAName: speciesA?.name ?? core.pokemonAId,
        pokemonBId: core.pokemonBId,
        pokemonBName: speciesB?.name ?? core.pokemonBId,
        correlationPercent: core.correlationPercent,
      }
    })

    return NextResponse.json({ data: enriched })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message, code: "CORES_ERROR" }, { status: 500 })
  }
}
