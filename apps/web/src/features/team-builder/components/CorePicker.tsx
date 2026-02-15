"use client"

import { Check } from "lucide-react"
import { TypeBadge, PokemonCard } from "@nasty-plot/ui"
import { formatUsagePercent, type PokemonType, type UsageStatsEntry } from "@nasty-plot/core"
import type { GuidedPokemonPick } from "../hooks/use-guided-builder"

interface CorePickerProps {
  pokemon: UsageStatsEntry[]
  selected: GuidedPokemonPick[]
  onToggle: (pokemon: GuidedPokemonPick) => void
  maxPicks?: number
}

export function CorePicker({ pokemon, selected, onToggle, maxPicks = 3 }: CorePickerProps) {
  const selectedIds = new Set(selected.map((p) => p.pokemonId))
  const atMax = selected.length >= maxPicks

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Pick {maxPicks === 1 ? "1 Pokemon" : `1-${maxPicks} Pokemon`} as your team core
        </p>
        <p className="text-sm font-medium">
          {selected.length} / {maxPicks} selected
        </p>
      </div>

      {/* Type synergy preview */}
      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 p-3 bg-muted/50 rounded-lg">
          <span className="text-xs font-medium text-muted-foreground mr-1">Types:</span>
          {[...new Set(selected.flatMap((p) => p.types))].map((type) => (
            <TypeBadge key={type} type={type} size="sm" />
          ))}
        </div>
      )}

      {/* Pokemon grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {pokemon.map((p) => {
          const isSelected = selectedIds.has(p.pokemonId)
          const disabled = !isSelected && atMax
          const displayName = p.pokemonName || p.pokemonId
          const types: PokemonType[] = p.types ?? ["Normal"]

          return (
            <PokemonCard
              key={p.pokemonId}
              pokemonId={p.pokemonId}
              name={displayName}
              types={types}
              selected={isSelected}
              disabled={disabled}
              onClick={() => {
                onToggle({
                  pokemonId: p.pokemonId,
                  pokemonName: displayName,
                  types,
                  usagePercent: p.usagePercent,
                })
              }}
              className="relative"
            >
              {isSelected && (
                <div className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </div>
              )}
              <span className="text-[10px] text-muted-foreground">
                {formatUsagePercent(p.usagePercent)} usage
              </span>
            </PokemonCard>
          )
        })}
      </div>
    </div>
  )
}
