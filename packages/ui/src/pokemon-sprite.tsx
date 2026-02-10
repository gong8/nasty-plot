"use client";

import { useState } from "react";
import { cn } from "./utils";

interface PokemonSpriteProps {
  pokemonId: string;
  num: number;
  size?: number;
  className?: string;
}

export function PokemonSprite({ pokemonId, num, size = 96, className }: PokemonSpriteProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${num}.png`;

  if (error) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted rounded-md text-muted-foreground text-xs",
          className
        )}
        style={{ width: size, height: size }}
      >
        ?
      </div>
    );
  }

  return (
    <div className={cn("relative", className)} style={{ width: size, height: size }}>
      {loading && (
        <div className="absolute inset-0 rounded-md bg-gray-200 dark:bg-gray-700 animate-pulse" />
      )}
      <img
        src={src}
        alt={pokemonId}
        width={size}
        height={size}
        className={cn("pixelated", loading && "opacity-0")}
        onLoad={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setError(true);
        }}
      />
    </div>
  );
}
