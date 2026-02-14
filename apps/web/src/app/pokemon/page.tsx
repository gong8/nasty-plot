"use client"

import { useState, useRef } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { DataStateRenderer } from "@/components/data-state-renderer"
import { Pagination } from "@/components/pagination"
import { PokemonSprite, TypeBadge } from "@nasty-plot/ui"
import {
  getBaseStatTotal,
  POKEMON_TYPES,
  type PaginatedResponse,
  type PokemonSpecies,
  type PokemonType,
} from "@nasty-plot/core"
import { useFormats } from "@/features/battle/hooks/use-formats"
import type { SortMode } from "@/features/pokemon/types"
import { fetchJson } from "@/lib/api-client"

const DEBOUNCE_MS = 300
const PAGE_SIZE = 50

export default function PokemonBrowserPage() {
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<PokemonType | null>(null)
  const [formatId, setFormatId] = useState<string>("")
  const [sortBy, setSortBy] = useState<SortMode>("dex")
  const [page, setPage] = useState(1)

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  function handleSearchChange(value: string) {
    setSearch(value)
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearch(value)
      setPage(1)
    }, DEBOUNCE_MS)
  }

  // Fetch formats for the selector
  const { data: formats } = useFormats()

  // Fetch Pokemon with all filters
  const params = new URLSearchParams()
  if (debouncedSearch) params.set("search", debouncedSearch)
  if (typeFilter) params.set("type", typeFilter)
  if (formatId) params.set("formatId", formatId)
  params.set("sort", sortBy)
  params.set("page", String(page))
  params.set("pageSize", String(PAGE_SIZE))

  const { data: pokemonData, isLoading } = useQuery<PaginatedResponse<PokemonSpecies>>({
    queryKey: ["pokemon", debouncedSearch, typeFilter, formatId, sortBy, page],
    queryFn: () => fetchJson(`/api/pokemon?${params}`),
  })

  const totalPages = pokemonData ? Math.ceil(pokemonData.total / PAGE_SIZE) : 0

  return (
    <div className="flex flex-col">
      <main className="flex-1 container mx-auto px-4 py-6">
        <h1 className="text-3xl font-bold font-display mb-2">Pokemon</h1>
        <p className="text-muted-foreground mb-6">Know your options. Know your threats.</p>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <Input
            placeholder="Search Pokemon..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-64"
          />

          <Select
            value={formatId}
            onValueChange={(val) => {
              const newFormat = val === "all" ? "" : val
              setFormatId(newFormat)
              setSortBy(newFormat ? "usage" : "dex")
              setPage(1)
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Formats" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Formats</SelectItem>
              {formats.map((format) => (
                <SelectItem key={format.id} value={format.id}>
                  {format.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={sortBy}
            onValueChange={(val) => {
              setSortBy(val as SortMode)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="usage" disabled={!formatId}>
                Usage
              </SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="bst">BST</SelectItem>
              <SelectItem value="dex">Dex #</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Type filter badges */}
        <div className="flex flex-wrap gap-1.5 mb-6">
          <span
            className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold cursor-pointer transition-opacity ${
              typeFilter === null
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:opacity-80"
            }`}
            onClick={() => {
              setTypeFilter(null)
              setPage(1)
            }}
          >
            All
          </span>
          {POKEMON_TYPES.map((type) => (
            <TypeBadge
              key={type}
              type={type}
              size="sm"
              className={typeFilter !== null && typeFilter !== type ? "opacity-40" : ""}
              onClick={() => {
                setTypeFilter(typeFilter === type ? null : type)
                setPage(1)
              }}
            />
          ))}
        </div>

        {/* Results count */}
        {pokemonData && (
          <p className="text-sm text-muted-foreground mb-4">
            Showing {pokemonData.data.length} of {pokemonData.total} Pokemon
          </p>
        )}

        {/* Pokemon grid */}
        <DataStateRenderer
          data={pokemonData ?? null}
          loading={isLoading}
          isEmpty={(d) => d.data.length === 0}
          loadingContent={
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {Array.from({ length: 20 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4 flex flex-col items-center gap-2">
                    <Skeleton className="w-20 h-20 rounded-md" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-16" />
                  </CardContent>
                </Card>
              ))}
            </div>
          }
          emptyContent={
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-12 w-12 text-muted-foreground/50 mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                />
              </svg>
              <p className="text-muted-foreground text-sm">
                No Pokemon match your filters. Try adjusting your search or type filter.
              </p>
            </div>
          }
        >
          {(pokemonData) => (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {pokemonData.data.map((pokemon) => (
                <Link key={pokemon.id} href={`/pokemon/${pokemon.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                    <CardContent className="p-4 flex flex-col items-center gap-2">
                      <PokemonSprite pokemonId={pokemon.id} size={80} />
                      <span className="font-medium text-sm text-center leading-tight">
                        {pokemon.name}
                      </span>
                      <div className="flex gap-1">
                        {pokemon.types.map((type) => (
                          <TypeBadge key={type} type={type} size="sm" />
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        BST: {getBaseStatTotal(pokemon.baseStats)}
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </DataStateRenderer>

        {/* Pagination */}
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} className="mt-8" />
      </main>
    </div>
  )
}
