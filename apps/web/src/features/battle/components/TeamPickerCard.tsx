"use client"

import { getSpriteUrl } from "@nasty-plot/pokemon-data"
import { Badge } from "@/components/ui/badge"
import { cn } from "@nasty-plot/ui"

interface TeamPickerCardProps {
  team: {
    id: string
    name: string
    source: "saved" | "sample"
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
      <div className="flex gap-0.5 justify-center">
        {team.pokemonIds.map((id) => {
          const url = getSpriteUrl(id, { gen: "gen5ani" })
          return (
            <div
              key={id}
              className="flex items-center justify-center"
              style={{ width: 40, height: 40 }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={id}
                className="max-w-full max-h-full object-contain"
                style={{ imageRendering: "pixelated" }}
              />
            </div>
          )
        })}
      </div>
    </button>
  )
}
