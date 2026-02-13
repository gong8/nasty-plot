"use client"

import { useCallback } from "react"
import { type PokemonSpecies, type PaginatedResponse } from "@nasty-plot/core"
import { PokemonSearchSelector } from "@nasty-plot/ui"
import { fetchJson } from "@/lib/api-client"

interface PokemonSearchPanelProps {
  onSelect: (pokemon: PokemonSpecies) => void
  formatId?: string
}

export function PokemonSearchPanel({ onSelect, formatId }: PokemonSearchPanelProps) {
  const handleSearch = useCallback(
    async (query: string): Promise<PokemonSpecies[]> => {
      let url = `/api/pokemon?search=${encodeURIComponent(query)}`
      if (formatId) url += `&formatId=${encodeURIComponent(formatId)}`
      try {
        const json = await fetchJson<PaginatedResponse<PokemonSpecies>>(url)
        return json.data ?? []
      } catch {
        return []
      }
    },
    [formatId],
  )

  return <PokemonSearchSelector onSelect={onSelect} onSearch={handleSearch} />
}
