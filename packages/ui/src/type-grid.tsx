"use client"

import type { PokemonType } from "@nasty-plot/core"
import { cn } from "./utils"
import { TypeBadge } from "./type-badge"

type TypeStatus = "selected" | "covered" | "weakness" | "neutral" | (string & {})

interface TypeGridProps {
  types: readonly PokemonType[]
  selectedType?: PokemonType
  onSelect?: (type: PokemonType) => void
  statusMap?: Partial<Record<PokemonType, TypeStatus>>
  columns?: number
  badgeClassName?: string
  className?: string
}

const statusStyles: Record<string, string> = {
  selected: "ring-2 ring-offset-1 ring-primary scale-105",
  covered: "opacity-100 ring-1 ring-green-400/50",
  weakness: "opacity-100 ring-1 ring-red-400/50",
  neutral: "opacity-40",
}

function getStatusClass(
  type: PokemonType,
  selectedType?: PokemonType,
  statusMap?: Partial<Record<PokemonType, TypeStatus>>,
): string {
  if (selectedType !== undefined) {
    return type === selectedType ? statusStyles.selected : "opacity-70 hover:opacity-100"
  }

  if (statusMap) {
    const status = statusMap[type]
    if (status && status in statusStyles) return statusStyles[status]
    if (status) return status
    return statusStyles.neutral
  }

  return ""
}

export function TypeGrid({
  types,
  selectedType,
  onSelect,
  statusMap,
  columns = 6,
  badgeClassName,
  className,
}: TypeGridProps) {
  return (
    <div
      className={cn("grid gap-1.5", className)}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {types.map((type) => (
        <TypeBadge
          key={type}
          type={type}
          size="sm"
          onClick={onSelect ? () => onSelect(type) : undefined}
          className={cn(
            "min-w-0 px-1 py-0.5 text-[10px]",
            getStatusClass(type, selectedType, statusMap),
            onSelect && "transition-all",
            badgeClassName,
          )}
        />
      ))}
    </div>
  )
}
