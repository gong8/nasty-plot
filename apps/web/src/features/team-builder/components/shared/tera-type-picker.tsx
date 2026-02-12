"use client"

import { POKEMON_TYPES, TYPE_COLORS, isLightTypeColor, type PokemonType } from "@nasty-plot/core"

interface TeraTypePickerProps {
  value?: PokemonType
  onChange: (type: PokemonType) => void
}

export function TeraTypePicker({ value, onChange }: TeraTypePickerProps) {
  return (
    <div className="grid grid-cols-6 gap-1">
      {POKEMON_TYPES.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`rounded px-1 py-0.5 text-[10px] font-medium transition-all ${
            isLightTypeColor(TYPE_COLORS[t]) ? "text-gray-900" : "text-white"
          } ${
            value === t
              ? "ring-2 ring-offset-1 ring-primary scale-105"
              : "opacity-70 hover:opacity-100"
          }`}
          style={{ backgroundColor: TYPE_COLORS[t] }}
        >
          {t}
        </button>
      ))}
    </div>
  )
}
