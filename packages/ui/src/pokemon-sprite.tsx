"use client"

import { useState } from "react"
import { Sprites } from "@pkmn/img"
import { cn } from "./utils"

interface PokemonSpriteProps {
  pokemonId: string
  size?: number
  className?: string
}

export function PokemonSprite({ pokemonId, size = 96, className }: PokemonSpriteProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const spriteData = Sprites.getPokemon(pokemonId, { gen: "gen5" })

  if (error) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted rounded-md text-muted-foreground text-xs",
          className,
        )}
        style={{ width: size, height: size }}
      >
        ?
      </div>
    )
  }

  return (
    <div className={cn("relative", className)} style={{ width: size, height: size }}>
      {loading && <div className="absolute inset-0 rounded-md bg-muted animate-pulse" />}
      <img
        src={spriteData.url}
        alt={pokemonId}
        width={size}
        height={size}
        className={cn("pixelated", loading && "opacity-0")}
        onLoad={() => setLoading(false)}
        onError={() => {
          setLoading(false)
          setError(true)
        }}
      />
    </div>
  )
}
