"use client"

import type { BattlePokemon } from "@nasty-plot/battle-engine"
import { getIconUrl } from "@nasty-plot/pokemon-data"
import { cn } from "@nasty-plot/ui"
import { CircleHelp } from "lucide-react"

interface PokeballIndicatorProps {
  team: BattlePokemon[]
  teamSize?: number
  vertical?: boolean
  className?: string
}

function PokemonIcon({ pokemon }: { pokemon?: BattlePokemon }) {
  if (!pokemon) {
    // Unrevealed opponent Pokemon — placeholder
    return (
      <div className="w-[28px] h-[24px] flex items-center justify-center opacity-40">
        <CircleHelp className="w-3.5 h-3.5 text-muted-foreground" />
      </div>
    )
  }

  const icon = getIconUrl(pokemon.pokemonId || pokemon.name)

  return (
    <div
      className={cn(
        "w-[28px] h-[24px] overflow-hidden shrink-0",
        pokemon.fainted && "grayscale opacity-40",
        pokemon.status && !pokemon.fainted && "brightness-90 sepia-[0.3]",
      )}
      title={
        pokemon.name +
        (pokemon.fainted ? " (fainted)" : pokemon.status ? ` (${pokemon.status})` : "")
      }
    >
      <div
        style={{
          width: 40,
          height: 30,
          imageRendering: "pixelated" as const,
          background: `transparent url(${icon.url}) no-repeat scroll ${icon.left}px ${icon.top}px`,
          transform: "scale(0.7)",
          transformOrigin: "top left",
        }}
      />
    </div>
  )
}

export function PokeballIndicator({
  team,
  teamSize = 6,
  vertical = false,
  className,
}: PokeballIndicatorProps) {
  const slots = Array.from({ length: teamSize }, (_, i) => team[i])

  return (
    <div className={cn("flex gap-0.5 items-center", vertical && "flex-col", className)}>
      {slots.map((pokemon, i) => (
        <PokemonIcon key={i} pokemon={pokemon} />
      ))}
    </div>
  )
}
