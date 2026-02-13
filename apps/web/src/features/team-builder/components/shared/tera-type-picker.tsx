"use client"

import { POKEMON_TYPES, type PokemonType } from "@nasty-plot/core"
import { TypeGrid } from "@nasty-plot/ui"

interface TeraTypePickerProps {
  value?: PokemonType
  onChange: (type: PokemonType) => void
}

export function TeraTypePicker({ value, onChange }: TeraTypePickerProps) {
  return (
    <TypeGrid
      types={POKEMON_TYPES}
      selectedType={value}
      onSelect={onChange}
      columns={6}
      className="gap-1"
      badgeClassName="rounded"
    />
  )
}
