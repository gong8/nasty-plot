"use client"

import { useState, useRef } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { PokemonSprite, TypeBadge } from "@nasty-plot/ui"
import {
  POKEMON_TYPES,
  type PaginatedResponse,
  type PokemonSpecies,
  type PokemonType,
  type FormatDefinition,
  type ApiResponse,
} from "@nasty-plot/core"

function getBaseStatTotal(stats: PokemonSpecies["baseStats"]): number {
  return stats.hp + stats.atk + stats.def + stats.spa + stats.spd + stats.spe
}

type SortMode = "usage" | "name" | "bst" | "dex"

export default function PokemonBrowserPage() {
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<PokemonType | null>(null)
  const [formatId, setFormatId] = useState<string>("")
  const [sortBy, setSortBy] = useState<SortMode>("dex")
  const [page, setPage] = useState(1)
  const pageSize = 50

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  function handleSearchChange(value: string) {
    setSearch(value)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setDebouncedSearch(value)
      setPage(1)
    }, 300)
  }

  // Fetch formats for the selector
  const { data: formatsData } = useQuery<ApiResponse<FormatDefinition[]>>({
    queryKey: ["formats"],
    queryFn: () => fetch("/api/formats").then((r) => r.json()),
  })

  // Fetch Pokemon with all filters
  const params = new URLSearchParams()
  if (debouncedSearch) params.set("search", debouncedSearch)
  if (typeFilter) params.set("type", typeFilter)
  if (formatId) params.set("format", formatId)
  params.set("sort", sortBy)
  params.set("page", String(page))
  params.set("pageSize", String(pageSize))

  const { data: pokemonData, isLoading } = useQuery<PaginatedResponse<PokemonSpecies>>({
    queryKey: ["pokemon", debouncedSearch, typeFilter, formatId, sortBy, page],
    queryFn: () => fetch(`/api/pokemon?${params}`).then((r) => r.json()),
  })

  const totalPages = pokemonData ? Math.ceil(pokemonData.total / pageSize) : 0

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
              {formatsData?.data.map((format) => (
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
        {isLoading ? (
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
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {pokemonData?.data.map((pokemon) => (
              <Link key={pokemon.id} href={`/pokemon/${pokemon.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardContent className="p-4 flex flex-col items-center gap-2">
                    <PokemonSprite pokemonId={pokemon.id} num={pokemon.num} size={80} />
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </main>
    </div>
  )
}
