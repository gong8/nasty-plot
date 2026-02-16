"use client"

import { useState } from "react"
import { getSpriteUrl } from "@nasty-plot/pokemon-data/browser"
import type { SpriteOptions } from "@nasty-plot/pokemon-data/browser"
import { cn } from "./utils"

export interface PokemonSpriteProps {
  pokemonId: string
  size?: number
  className?: string
  /** Sprite facing direction — "front" for opponent, "back" for player. Defaults to "front". */
  side?: "front" | "back"
  /** Whether the Pokemon has fainted — applies grayscale + reduced opacity. */
  fainted?: boolean
  /** Additional CSS class for battle animations (e.g. shake, flinch). */
  animationClass?: string
  /** Whether to use animated sprites (gen5ani) instead of static (gen5). */
  animated?: boolean
  /** Whether the Pokemon is shiny. */
  shiny?: boolean
}

export function PokemonSprite({
  pokemonId,
  size = 96,
  className,
  side,
  fainted = false,
  animationClass,
  animated = false,
  shiny = false,
}: PokemonSpriteProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const spriteOptions: SpriteOptions = {
    gen: animated ? "gen5ani" : "gen5",
    shiny,
  }
  if (side) {
    spriteOptions.side = side
  }

  const url = getSpriteUrl(pokemonId, spriteOptions)

  if (error) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted rounded-md text-muted-foreground text-xs",
          fainted && "grayscale opacity-40",
          className,
        )}
        style={{ width: size, height: size }}
      >
        ?
      </div>
    )
  }

  return (
    <div
      className={cn(
        "relative flex items-center justify-center",
        fainted && "grayscale opacity-40",
        animationClass,
        className,
      )}
      style={{ width: size, height: size }}
    >
      {loading && <div className="absolute inset-0 rounded-md bg-muted animate-pulse" />}
      <img
        src={url}
        alt={pokemonId}
        width={size}
        height={size}
        className={cn(
          "pixelated max-w-full max-h-full object-contain",
          loading && "opacity-0",
          fainted && "translate-y-2",
        )}
        style={{ imageRendering: "pixelated" }}
        onLoad={() => setLoading(false)}
        onError={() => {
          setLoading(false)
          setError(true)
        }}
      />
    </div>
  )
}
