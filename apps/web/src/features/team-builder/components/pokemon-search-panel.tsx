"use client"

import type { PokemonSpecies } from "@nasty-plot/core"
import { PokemonSearchSelector } from "@nasty-plot/ui"
import { usePokemonSearch } from "@/hooks/use-pokemon-search"

interface PokemonSearchPanelProps {
  onSelect: (pokemon: PokemonSpecies) => void
  formatId?: string
}

export function PokemonSearchPanel({ onSelect, formatId }: PokemonSearchPanelProps) {
  const handleSearch = usePokemonSearch(formatId)

  return <PokemonSearchSelector onSelect={onSelect} onSearch={handleSearch} />
}
