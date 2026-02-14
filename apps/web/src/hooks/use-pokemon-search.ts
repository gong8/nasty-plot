"use client"

import { useCallback } from "react"
import type { PokemonSpecies, PaginatedResponse } from "@nasty-plot/core"
import { fetchJson } from "@/lib/api-client"

export function usePokemonSearch(formatId?: string, limit = 10) {
  return useCallback(
    async (query: string): Promise<PokemonSpecies[]> => {
      if (!query.trim()) return []
      const params = new URLSearchParams({
        search: query,
        pageSize: String(limit),
      })
      if (formatId) params.set("formatId", formatId)
      const res = await fetchJson<PaginatedResponse<PokemonSpecies>>(`/api/pokemon?${params}`)
      return res.data
    },
    [formatId, limit],
  )
}
