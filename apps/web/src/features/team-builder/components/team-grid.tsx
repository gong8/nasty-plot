"use client"

import { Plus } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TYPE_COLORS, isLightTypeColor, type PokemonType, type TeamData } from "@nasty-plot/core"
import { PokemonSprite } from "@nasty-plot/ui"

interface TeamGridProps {
  team: TeamData
  selectedSlot: number | null
  onSelectSlot: (position: number) => void
  onAddSlot: () => void
}

export function TeamGrid({ team, selectedSlot, onSelectSlot, onAddSlot }: TeamGridProps) {
  const filledSlots = team.slots
  const emptyCount = 6 - filledSlots.length

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {filledSlots.map((slot) => (
        <Card
          key={slot.position}
          className={`cursor-pointer transition-all hover:shadow-md dark:hover:shadow-[0_0_15px_var(--color-glow-primary)] ${
            selectedSlot === slot.position
              ? "ring-2 ring-primary shadow-md dark:shadow-[0_0_15px_var(--color-glow-primary)]"
              : ""
          }`}
          onClick={() => onSelectSlot(slot.position)}
        >
          <CardContent className="flex flex-col items-center gap-2 p-3">
            {slot.species?.num ? (
              <PokemonSprite pokemonId={slot.pokemonId} num={slot.species.num} size={48} />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-xs font-bold uppercase">
                {slot.pokemonId.slice(0, 3)}
              </div>
            )}
            <span className="text-sm font-medium truncate w-full text-center">
              {slot.nickname || slot.species?.name || slot.pokemonId}
            </span>
            <div className="flex gap-1">
              {slot.species?.types?.map((t: PokemonType) => (
                <Badge
                  key={t}
                  className={`text-[10px] px-1.5 py-0 ${isLightTypeColor(TYPE_COLORS[t]) ? "text-gray-900" : "text-white"}`}
                  style={{ backgroundColor: TYPE_COLORS[t] }}
                >
                  {t}
                </Badge>
              ))}
            </div>
            {slot.item && (
              <span className="text-xs text-muted-foreground truncate w-full text-center">
                {slot.item}
              </span>
            )}
            {slot.ability && (
              <span className="text-xs text-muted-foreground truncate w-full text-center">
                {slot.ability}
              </span>
            )}
          </CardContent>
        </Card>
      ))}
      {Array.from({ length: emptyCount }).map((_, i) => (
        <Card
          key={`empty-${i}`}
          className="cursor-pointer border-dashed transition-all hover:shadow-md hover:border-primary"
          onClick={onAddSlot}
        >
          <CardContent className="flex flex-col items-center justify-center gap-2 p-3 min-h-[140px]">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Plus className="h-6 w-6 text-muted-foreground" />
            </div>
            <span className="text-sm text-muted-foreground">Add Pokemon</span>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
