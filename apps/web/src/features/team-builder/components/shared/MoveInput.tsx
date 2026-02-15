"use client"

import { useMemo } from "react"
import { MoveSelector } from "@nasty-plot/ui"
import type { PopularityData } from "../../hooks/use-popularity-data"

interface MoveInputProps {
  index: number
  value: string
  learnset: string[]
  selectedMoves: [string, string?, string?, string?]
  onChange: (val: string) => void
  popularity?: PopularityData
  compact?: boolean
}

export function MoveInput({
  index,
  value,
  learnset,
  selectedMoves,
  onChange,
  popularity,
  compact = false,
}: MoveInputProps) {
  // Moves already picked in other slots (exclude current slot's value)
  const otherMoves = useMemo(() => {
    const others = new Set<string>()
    for (let i = 0; i < 4; i++) {
      if (i !== index && selectedMoves[i]) {
        others.add(selectedMoves[i]!.toLowerCase())
      }
    }
    return others
  }, [selectedMoves, index])

  return (
    <MoveSelector
      value={value}
      onSelect={onChange}
      moveNames={learnset}
      popularity={popularity?.moves}
      excludeMoves={otherMoves}
      placeholder={`Move ${index + 1}`}
      compact={compact}
      showMetadata={false}
    />
  )
}
