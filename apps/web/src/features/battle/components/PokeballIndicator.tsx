"use client"

import type { BattlePokemon } from "@nasty-plot/battle-engine"
import { cn } from "@/lib/utils"

interface PokeballIndicatorProps {
  team: BattlePokemon[]
  teamSize?: number
  className?: string
}

function getPokeballColor(pokemon?: BattlePokemon): string {
  if (!pokemon) return "bg-muted-foreground/30" // Unknown/empty slot
  if (pokemon.fainted) return "bg-red-500/60 dark:bg-red-600/60"
  if (pokemon.status) return "bg-yellow-500 dark:bg-yellow-400"
  return "bg-green-500 dark:bg-green-400"
}

export function PokeballIndicator({ team, teamSize = 6, className }: PokeballIndicatorProps) {
  const balls = Array.from({ length: teamSize }, (_, i) => team[i])

  return (
    <div className={cn("flex gap-1.5", className)}>
      {balls.map((pokemon, i) => (
        <div
          key={i}
          className={cn(
            "w-3 h-3 rounded-full border border-black/20 dark:border-white/20 transition-colors duration-300",
            getPokeballColor(pokemon),
          )}
          title={
            pokemon
              ? `${pokemon.name}${pokemon.fainted ? " (fainted)" : pokemon.status ? ` (${pokemon.status})` : ""}`
              : "Unknown"
          }
        />
      ))}
    </div>
  )
}
