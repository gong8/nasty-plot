"use client"

import { POKEMON_TYPES, type PokemonType } from "@nasty-plot/core"
import { cn, TypeBadge } from "@nasty-plot/ui"

interface TeraTypePickerProps {
  value?: PokemonType
  onChange: (type: PokemonType) => void
}

export function TeraTypePicker({ value, onChange }: TeraTypePickerProps) {
  return (
    <div className="grid grid-cols-6 gap-1">
      {POKEMON_TYPES.map((t) => (
        <TypeBadge
          key={t}
          type={t}
          size="sm"
          onClick={() => onChange(t)}
          className={cn(
            "rounded px-1 py-0.5 text-[10px] min-w-0 transition-all",
            value === t
              ? "ring-2 ring-offset-1 ring-primary scale-105"
              : "opacity-70 hover:opacity-100",
          )}
        />
      ))}
    </div>
  )
}
