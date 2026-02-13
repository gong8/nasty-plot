"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { cn } from "./utils"
import { PokemonSprite } from "./pokemon-sprite"
import { TypeBadge } from "./type-badge"
import type { PokemonSpecies, PokemonType } from "@nasty-plot/core"

const MIN_SEARCH_LENGTH = 2
const DEBOUNCE_MS = 250

interface PokemonSearchSelectorProps {
  /** Called when a Pokemon is selected */
  onSelect: (pokemon: PokemonSpecies) => void
  /** Currently selected Pokemon ID (for highlighting) */
  selectedId?: string
  /** Placeholder text for the search input */
  placeholder?: string
  /** Async function that returns search results given a query string */
  onSearch: (query: string) => Promise<PokemonSpecies[]>
  /** Max height of the results area (CSS value). Defaults to "300px" */
  maxHeight?: string
  /** Additional className for the root container */
  className?: string
}

export function PokemonSearchSelector({
  onSelect,
  selectedId,
  placeholder = "Search Pokemon...",
  onSearch,
  maxHeight = "300px",
  className,
}: PokemonSearchSelectorProps) {
  const [search, setSearch] = useState("")
  const [results, setResults] = useState<PokemonSpecies[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchRef = useRef(search)
  searchRef.current = search

  const performSearch = useCallback(
    async (query: string) => {
      if (query.length < MIN_SEARCH_LENGTH) {
        setResults([])
        setIsLoading(false)
        return
      }
      setIsLoading(true)
      try {
        const data = await onSearch(query)
        // Only update if the query still matches
        if (searchRef.current === query) {
          setResults(data)
        }
      } catch {
        if (searchRef.current === query) {
          setResults([])
        }
      } finally {
        if (searchRef.current === query) {
          setIsLoading(false)
        }
      }
    },
    [onSearch],
  )

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    if (search.length < MIN_SEARCH_LENGTH) {
      setResults([])
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    debounceRef.current = setTimeout(() => {
      performSearch(search)
    }, DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [search, performSearch])

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="text"
          placeholder={placeholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
            "ring-offset-background placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "pl-9",
          )}
        />
      </div>
      <div className="overflow-y-auto" style={{ maxHeight }}>
        {isLoading && <p className="text-sm text-muted-foreground p-4 text-center">Searching...</p>}
        {!isLoading && search.length >= MIN_SEARCH_LENGTH && results.length === 0 && (
          <p className="text-sm text-muted-foreground p-4 text-center">No Pokemon found</p>
        )}
        <div className="flex flex-col gap-1">
          {results.map((pokemon) => {
            const bst = Object.values(pokemon.baseStats).reduce((a, b) => a + b, 0)
            const isSelected = selectedId === pokemon.id
            return (
              <button
                key={pokemon.id}
                onClick={() => onSelect(pokemon)}
                className={cn(
                  "flex items-center gap-3 rounded-md p-2 text-left hover:bg-accent transition-colors w-full",
                  isSelected && "bg-accent",
                )}
              >
                <PokemonSprite pokemonId={pokemon.id} size={32} className="shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{pokemon.name}</div>
                  <div className="flex gap-1 mt-0.5">
                    {pokemon.types.map((t: PokemonType) => (
                      <TypeBadge key={t} type={t} size="sm" />
                    ))}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">BST {bst}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
