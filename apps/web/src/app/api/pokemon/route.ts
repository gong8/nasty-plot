import { NextResponse } from "next/server"
import {
  listSpecies,
  listSpeciesByName,
  listSpeciesByBst,
  getTypeIndex,
} from "@nasty-plot/pokemon-data"
import { getFormatPokemon } from "@nasty-plot/formats"
import { getUsageStats } from "@nasty-plot/smogon-data"
import { type PaginatedResponse, type PokemonSpecies, type PokemonType } from "@nasty-plot/core"
import type { SortMode } from "@/features/pokemon/types"
import { apiErrorResponse } from "../../../lib/api-error"
import { validateSearchParams } from "../../../lib/validation"
import { pokemonSearchSchema } from "../../../lib/schemas/pokemon.schemas"

export async function GET(request: Request) {
  const [params, error] = validateSearchParams(request.url, pokemonSearchSchema)
  if (error) return error

  try {
    const { search, type: typeFilter, formatId, sort, page, pageSize } = params

    const hasSearch = search.length > 0
    const hasTypeFilter = !!typeFilter
    const isUsageSort = (sort as SortMode) === "usage" && !!formatId

    // --- Step 1: Get the base species list ---
    // For format-filtered queries we must use getFormatPokemon (applies bans).
    // For unfiltered queries, use pre-sorted cached lists when possible.
    let species: PokemonSpecies[]

    if (formatId) {
      species = getFormatPokemon(formatId)
    } else if (!hasSearch && !hasTypeFilter) {
      // Fast path: no search/filter, use pre-sorted cached lists directly
      if (sort === "name") {
        species = listSpeciesByName()
      } else if (sort === "bst") {
        species = listSpeciesByBst()
      } else {
        species = listSpecies()
      }
    } else if (hasTypeFilter && !hasSearch) {
      // Fast path: type filter only, use pre-built type index
      species = getTypeIndex().get(typeFilter as PokemonType) ?? []
    } else {
      species = listSpecies()
    }

    // --- Step 2: Apply search filter ---
    if (hasSearch) {
      const lower = search.toLowerCase()
      species = species.filter((s) => s.name.toLowerCase().includes(lower))
    }

    // --- Step 3: Apply type filter (if not already applied via index) ---
    if (hasTypeFilter && (formatId || hasSearch)) {
      species = species.filter((s) => s.types.includes(typeFilter as PokemonType))
    }

    // --- Step 4: Sort ---
    // Skip sorting if we already used a pre-sorted list (no format, no search, no type filter)
    const usedPreSorted = !formatId && !hasSearch && !hasTypeFilter && !isUsageSort
    if (!usedPreSorted) {
      if (isUsageSort) {
        // Fetch only the page-worth of usage stats we need for ranking
        const usageStats = await getUsageStats(formatId!, { limit: 200 })
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
        species.sort((a, b) => {
          const bstA =
            a.baseStats.hp +
            a.baseStats.atk +
            a.baseStats.def +
            a.baseStats.spa +
            a.baseStats.spd +
            a.baseStats.spe
          const bstB =
            b.baseStats.hp +
            b.baseStats.atk +
            b.baseStats.def +
            b.baseStats.spa +
            b.baseStats.spd +
            b.baseStats.spe
          return bstB - bstA
        })
      }
    }

    // --- Step 5: Paginate ---
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
  } catch (error) {
    return apiErrorResponse(error)
  }
}
