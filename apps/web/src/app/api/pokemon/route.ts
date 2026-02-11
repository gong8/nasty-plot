import { NextResponse } from "next/server"
import { getAllSpecies } from "@nasty-plot/pokemon-data"
import { getFormatPokemon } from "@nasty-plot/formats"
import { getUsageStats } from "@nasty-plot/smogon-data"
import type { PaginatedResponse, PokemonSpecies, PokemonType } from "@nasty-plot/core"

type SortMode = "usage" | "name" | "bst" | "dex"

function getBaseStatTotal(stats: PokemonSpecies["baseStats"]): number {
  return stats.hp + stats.atk + stats.def + stats.spa + stats.spd + stats.spe
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const search = searchParams.get("search") ?? ""
  const typeFilter = searchParams.get("type") as PokemonType | null
  const formatId = searchParams.get("format")
  const sort = (searchParams.get("sort") as SortMode) ?? "dex"
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

  // Sort
  if (sort === "usage" && formatId) {
    const usageStats = await getUsageStats(formatId, { limit: 9999 })
    const rankMap = new Map<string, number>()
    for (const entry of usageStats) {
      rankMap.set(entry.pokemonId, entry.rank)
    }
    species.sort((a, b) => {
      const rankA = rankMap.get(a.id) ?? Infinity
      const rankB = rankMap.get(b.id) ?? Infinity
      return rankA - rankB
    })
  } else if (sort === "name") {
    species.sort((a, b) => a.name.localeCompare(b.name))
  } else if (sort === "bst") {
    species.sort((a, b) => getBaseStatTotal(b.baseStats) - getBaseStatTotal(a.baseStats))
  }
  // "dex" = default order from getAllSpecies/getFormatPokemon

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
