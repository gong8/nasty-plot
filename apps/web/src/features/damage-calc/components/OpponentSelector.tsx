"use client"

import { useState, useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { X, Search, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { PokemonSprite, PokemonSearchSelector } from "@nasty-plot/ui"
import type { PokemonSpecies } from "@nasty-plot/core"
import { fetchApiData } from "@/lib/api-client"
import { usePokemonSearch } from "@/hooks/use-pokemon-search"

const MAX_OPPONENTS = 15

interface OpponentSelectorProps {
  selectedIds: string[]
  onSelectionChange: (ids: string[]) => void
  formatId?: string
}

export function OpponentSelector({
  selectedIds,
  onSelectionChange,
  formatId,
}: OpponentSelectorProps) {
  const [open, setOpen] = useState(false)

  const searchPokemon = usePokemonSearch(formatId, 20)
  const handleSearch = useCallback(
    async (query: string): Promise<PokemonSpecies[]> => {
      const results = await searchPokemon(query)
      const selectedSet = new Set(selectedIds)
      return results.filter((r) => !selectedSet.has(r.id))
    },
    [searchPokemon, selectedIds],
  )

  // Fetch details for all selected IDs so we can render chips with names and sprites
  const { data: selectedDetails = [] } = useQuery({
    queryKey: ["pokemon-details", selectedIds],
    queryFn: async () => {
      const results = await Promise.all(
        selectedIds.map(async (id) => {
          try {
            return await fetchApiData<PokemonSpecies>(`/api/pokemon/${id}`)
          } catch {
            return null
          }
        }),
      )
      return results.filter((r): r is PokemonSpecies => r !== null)
    },
    enabled: selectedIds.length > 0,
    staleTime: Infinity,
  })

  function addOpponent(pokemon: PokemonSpecies) {
    if (selectedIds.length >= MAX_OPPONENTS) return
    if (selectedIds.includes(pokemon.id)) return
    onSelectionChange([...selectedIds, pokemon.id])
    setOpen(false)
  }

  function removeOpponent(id: string) {
    onSelectionChange(selectedIds.filter((sid) => sid !== id))
  }

  function resetToDefaults() {
    onSelectionChange([])
  }

  // Build a lookup from selectedDetails for rendering chips in selectedIds order
  const detailsMap = new Map(selectedDetails.map((d) => [d.id, d]))

  return (
    <div className="flex flex-col gap-2">
      {/* Selected opponent chips */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedIds.map((id) => {
            const detail = detailsMap.get(id)
            return (
              <div
                key={id}
                className="flex items-center gap-1.5 rounded-full bg-muted pl-1 pr-2 py-0.5"
              >
                <PokemonSprite pokemonId={id} size={24} />
                <span className="text-xs">{detail?.name ?? id}</span>
                <button
                  onClick={() => removeOpponent(id)}
                  className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Controls row */}
      <div className="flex items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={selectedIds.length >= MAX_OPPONENTS}
              className="gap-1.5"
            >
              <Search className="h-3.5 w-3.5" />
              Add opponent...
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-2" align="start" side="bottom" avoidCollisions>
            <PokemonSearchSelector
              onSelect={addOpponent}
              onSearch={handleSearch}
              placeholder="Search Pokemon..."
              maxHeight="200px"
            />
          </PopoverContent>
        </Popover>

        {selectedIds.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetToDefaults}
            className="gap-1.5 text-muted-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset to Defaults
          </Button>
        )}

        <span className="text-xs text-muted-foreground ml-auto">
          {selectedIds.length}/{MAX_OPPONENTS}
        </span>
      </div>
    </div>
  )
}
