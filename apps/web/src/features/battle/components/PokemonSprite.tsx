"use client";

import { useState } from "react";
import { Sprites } from "@pkmn/img";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface BattleSpriteProps {
  speciesId: string;
  /** Front = opponent's Pokemon, back = player's Pokemon */
  side: "front" | "back";
  fainted?: boolean;
  className?: string;
  size?: number;
  shiny?: boolean;
  /** Additional CSS class for battle animations (e.g. shake, flinch) */
  animationClass?: string;
}

export function BattleSprite({
  speciesId,
  side,
  fainted = false,
  className,
  size = 128,
  shiny = false,
  animationClass,
}: BattleSpriteProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Use @pkmn/img for Showdown-style sprites
  const spriteData = Sprites.getPokemon(speciesId, {
    gen: "gen5ani",
    side: side === "front" ? "p2" : "p1",
    shiny,
  });

  if (error) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted rounded-md text-muted-foreground text-xs",
          fainted && "grayscale opacity-40",
          className
        )}
        style={{ width: size, height: size }}
      >
        {speciesId}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex items-center justify-center",
        fainted && "grayscale opacity-40",
        animationClass,
        className
      )}
      style={{ width: size, height: size }}
    >
      {loading && (
        <Skeleton className="absolute inset-0 rounded-md" />
      )}
      <img
        src={spriteData.url}
        alt={speciesId}
        className={cn(
          "pixelated max-w-full max-h-full object-contain",
          loading && "opacity-0",
          fainted && "translate-y-2"
        )}
        style={{ imageRendering: "pixelated" }}
        onLoad={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setError(true);
        }}
      />
    </div>
  );
}
