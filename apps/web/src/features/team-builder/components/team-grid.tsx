"use client"

import { Plus } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TYPE_COLORS, isLightTypeColor, type PokemonType, type TeamData } from "@nasty-plot/core"
import { PokemonSprite } from "@nasty-plot/ui"
import { cn } from "@/lib/utils"

interface TeamGridProps {
  team: TeamData
  selectedSlot: number | null
  onSelectSlot: (position: number) => void
  onAddSlot: () => void
  layout?: "grid" | "vertical"
}

export function TeamGrid({
  team,
  selectedSlot,
  onSelectSlot,
  onAddSlot,
  layout = "grid",
}: TeamGridProps) {
  const filledSlots = team.slots
  const emptyCount = 6 - filledSlots.length

  const isVertical = layout === "vertical"

  return (
    <div
      className={cn(
        isVertical ? "space-y-3" : "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6",
      )}
    >
      {filledSlots.map((slot) => (
        <Card
          key={slot.position}
          className={cn(
            "cursor-pointer transition-all hover:shadow-md dark:hover:shadow-[0_0_15px_var(--color-glow-primary)] border-primary/20",
            selectedSlot === slot.position &&
              "ring-2 ring-primary shadow-md dark:shadow-[0_0_15px_var(--color-glow-primary)]",
            isVertical ? "flex flex-row items-center overflow-hidden" : "",
          )}
          onClick={() => onSelectSlot(slot.position)}
        >
          <CardContent
            className={cn(
              "p-3 w-full",
              isVertical ? "flex items-center gap-4 py-2 px-3" : "flex flex-col items-center gap-2",
            )}
          >
            <div className="shrink-0">
              <PokemonSprite pokemonId={slot.pokemonId} size={isVertical ? 40 : 48} />
            </div>

            <div
              className={cn(
                "flex flex-col min-w-0",
                isVertical ? "flex-1 items-start" : "items-center w-full",
              )}
            >
              <span className="text-sm font-medium truncate w-full text-foreground/90">
                {slot.nickname || slot.species?.name || slot.pokemonId}
              </span>

              <div className="flex gap-1 mt-1">
                {slot.species?.types?.map((t: PokemonType) => (
                  <Badge
                    key={t}
                    className={cn(
                      "text-[10px] px-1.5 py-0 font-normal border-0",
                      isLightTypeColor(TYPE_COLORS[t]) ? "text-gray-900" : "text-white",
                    )}
                    style={{ backgroundColor: TYPE_COLORS[t] }}
                  >
                    {t}
                  </Badge>
                ))}
              </div>

              {isVertical && (
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground w-full">
                  {slot.item && <span className="truncate max-w-[80px]">{slot.item}</span>}
                  {slot.item && slot.ability && <span>•</span>}
                  {slot.ability && <span className="truncate max-w-[100px]">{slot.ability}</span>}
                </div>
              )}
            </div>

            {!isVertical && slot.item && (
              <span className="text-xs text-muted-foreground truncate w-full text-center">
                {slot.item}
              </span>
            )}
            {!isVertical && slot.ability && (
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
          className={cn(
            "cursor-pointer border-dashed transition-all hover:shadow-md hover:border-primary/50 bg-muted/20",
            isVertical ? "h-16 flex items-center justify-center" : "",
          )}
          onClick={onAddSlot}
        >
          <CardContent
            className={cn(
              "flex items-center justify-center p-3 text-muted-foreground",
              isVertical ? "gap-2 w-full py-0" : "flex-col gap-2 min-h-[140px]",
            )}
          >
            <div
              className={cn(
                "flex items-center justify-center rounded-full bg-muted",
                isVertical ? "h-8 w-8" : "h-12 w-12",
              )}
            >
              <Plus className={cn("text-muted-foreground", isVertical ? "h-4 w-4" : "h-6 w-6")} />
            </div>
            <span className="text-sm font-medium">Add Pokemon</span>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
