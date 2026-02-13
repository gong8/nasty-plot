"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { X, Search, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { PokemonSprite } from "@nasty-plot/ui"
import type { PaginatedResponse, PokemonSpecies } from "@nasty-plot/core"
import { fetchJson, fetchApiData } from "@/lib/api-client"

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
  const [search, setSearch] = useState("")

  // Fetch search results for the popover
  const { data: results = [] } = useQuery({
    queryKey: ["pokemon-search", search],
    queryFn: async () => {
      if (!search || search.length < 2) return []
      const formatParam = formatId ? `&format=${encodeURIComponent(formatId)}` : ""
      try {
        const json = await fetchJson<PaginatedResponse<PokemonSpecies>>(
          `/api/pokemon?search=${encodeURIComponent(search)}&pageSize=20${formatParam}`,
        )
        return json.data
      } catch {
        return []
      }
    },
    enabled: search.length >= 2,
  })

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

  const selectedSet = new Set(selectedIds)

  // Filter out already-selected Pokemon from search results
  const filteredResults = results.filter((r) => !selectedSet.has(r.id))

  function addOpponent(id: string) {
    if (selectedIds.length >= MAX_OPPONENTS) return
    if (selectedSet.has(id)) return
    onSelectionChange([...selectedIds, id])
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
          <PopoverContent className="w-[280px] p-0" align="start" side="bottom" avoidCollisions>
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Search Pokemon..."
                value={search}
                onValueChange={setSearch}
              />
              <CommandList className="max-h-[200px] overflow-y-auto">
                <CommandEmpty>
                  {search.length < 2 ? "Type at least 2 characters..." : "No Pokemon found."}
                </CommandEmpty>
                <CommandGroup>
                  {filteredResults.map((pokemon) => (
                    <CommandItem
                      key={pokemon.id}
                      value={pokemon.id}
                      onSelect={() => {
                        addOpponent(pokemon.id)
                        setSearch("")
                        setOpen(false)
                      }}
                    >
                      <PokemonSprite pokemonId={pokemon.id} size={24} className="mr-2" />
                      <span>{pokemon.name}</span>
                      <Badge variant="secondary" className="ml-auto text-[10px]">
                        {pokemon.types.join("/")}
                      </Badge>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
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
