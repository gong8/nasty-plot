"use client"

import type { ReactNode, KeyboardEvent } from "react"
import type { PokemonType } from "@nasty-plot/core"
import { cn } from "./utils"
import { PokemonSprite } from "./pokemon-sprite"
import { TypeBadge } from "./type-badge"

interface PokemonCardProps {
  /** Pokemon ID (camelCase Showdown ID) */
  pokemonId: string
  /** Display name */
  name: string
  /** Pokemon types */
  types: PokemonType[]
  /** Optional metadata slot rendered below the type badges */
  children?: ReactNode
  /** Click handler */
  onClick?: () => void
  /** Whether the card is in a selected state */
  selected?: boolean
  /** Whether the card is disabled */
  disabled?: boolean
  /** Sprite size in pixels */
  spriteSize?: number
  /** Layout direction */
  layout?: "vertical" | "horizontal"
  /** Additional className for the outer card */
  className?: string
}

export function PokemonCard({
  pokemonId,
  name,
  types,
  children,
  onClick,
  selected = false,
  disabled = false,
  spriteSize = 64,
  layout = "vertical",
  className,
}: PokemonCardProps) {
  const isInteractive = !!onClick && !disabled
  const isHorizontal = layout === "horizontal"

  return (
    <div
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={isInteractive ? onClick : undefined}
      onKeyDown={
        isInteractive
          ? (e: KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onClick!()
              }
            }
          : undefined
      }
      className={cn(
        "bg-card dark:bg-glass-bg dark:backdrop-blur-xl text-card-foreground rounded-xl border dark:border-glass-border shadow-sm dark:shadow-none",
        "transition-all",
        isInteractive && "cursor-pointer hover:shadow-md hover:border-primary/50",
        selected && "ring-2 ring-primary bg-primary/5",
        disabled && "opacity-50 cursor-not-allowed",
        isHorizontal ? "flex items-center gap-4 p-3" : "flex flex-col items-center gap-1 p-3",
        className,
      )}
    >
      <div className="shrink-0">
        <PokemonSprite pokemonId={pokemonId} size={spriteSize} />
      </div>

      <div
        className={cn(
          "flex flex-col min-w-0",
          isHorizontal ? "flex-1 items-start" : "items-center w-full",
        )}
      >
        <span
          className={cn(
            "font-medium truncate w-full",
            isHorizontal ? "text-sm" : "text-xs text-center",
          )}
        >
          {name}
        </span>

        <div className="flex gap-0.5 mt-1">
          {types.map((t) => (
            <TypeBadge key={t} type={t} size="sm" />
          ))}
        </div>

        {children && <div className="mt-1 w-full">{children}</div>}
      </div>
    </div>
  )
}
