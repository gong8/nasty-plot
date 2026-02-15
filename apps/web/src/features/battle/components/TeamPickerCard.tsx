"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@nasty-plot/ui"
import { PokemonSpriteRow } from "@/components/PokemonSpriteRow"
import type { TeamPickerSource } from "./TeamPicker"

interface TeamPickerCardProps {
  team: {
    id: string
    name: string
    source: TeamPickerSource
    archetype?: string | null
    pokemonIds: string[]
  }
  selected: boolean
  onSelect: () => void
}

export function TeamPickerCard({ team, selected, onSelect }: TeamPickerCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-lg border p-3 text-left transition-colors hover:bg-accent/50",
        selected && "ring-2 ring-primary border-primary bg-primary/5",
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-sm font-medium truncate">{team.name}</span>
        <div className="flex items-center gap-1 shrink-0">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {team.source === "saved" ? "Saved" : "Sample"}
          </Badge>
          {team.archetype && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {team.archetype}
            </Badge>
          )}
        </div>
      </div>
      <PokemonSpriteRow pokemonIds={team.pokemonIds} size={40} className="justify-center gap-0.5" />
    </button>
  )
}
