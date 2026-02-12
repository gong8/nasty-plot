"use client"

import { useState, useMemo } from "react"
import { Input } from "@/components/ui/input"
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
  const [search, setSearch] = useState("")
  const [open, setOpen] = useState(false)

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

  const { commonMoves, otherFilteredMoves } = useMemo(() => {
    let available = learnset.filter((m) => !otherMoves.has(m.toLowerCase()))
    if (search) {
      const lower = search.toLowerCase()
      available = available.filter((m) => m.toLowerCase().includes(lower))
    }

    if (!popularity?.moves?.length) {
      return { commonMoves: [] as string[], otherFilteredMoves: available.slice(0, 20) }
    }

    const availableSet = new Set(available)

    const common = popularity.moves
      .filter((m) => availableSet.has(m.name))
      .slice(0, 12)
      .map((m) => m.name)

    const commonSet = new Set(common)
    const other = available.filter((m) => !commonSet.has(m)).slice(0, 20)

    return { commonMoves: common, otherFilteredMoves: other }
  }, [search, learnset, otherMoves, popularity])

  const isDuplicate = value && otherMoves.has(value.toLowerCase())

  const popularityMap = useMemo(() => {
    if (!popularity?.moves?.length) return null
    return new Map(popularity.moves.map((m) => [m.name, m.usagePercent]))
  }, [popularity])

  return (
    <div className="relative">
      <Input
        placeholder={`Move ${index + 1}`}
        value={open ? search : value}
        onChange={(e) => {
          setSearch(e.target.value)
          if (!open) setOpen(true)
        }}
        onFocus={() => {
          setSearch(value)
          setOpen(true)
        }}
        onBlur={() => {
          // Delay to allow click
          setTimeout(() => setOpen(false), 150)
        }}
        className={`${compact ? "h-8 text-sm " : ""}${isDuplicate ? "border-destructive" : ""}`}
      />
      {isDuplicate && <p className="text-[10px] text-destructive mt-0.5">Duplicate move</p>}
      {open && (commonMoves.length > 0 || otherFilteredMoves.length > 0) && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-[200px] overflow-y-auto">
          {commonMoves.length > 0 && (
            <>
              <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50">
                Common
              </div>
              {commonMoves.map((move) => (
                <button
                  key={move}
                  className="w-full px-3 py-1.5 text-sm text-left hover:bg-accent transition-colors flex items-center justify-between"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    onChange(move)
                    setSearch(move)
                    setOpen(false)
                  }}
                >
                  <span>{move}</span>
                  {popularityMap && (
                    <span className="text-xs text-muted-foreground">
                      {popularityMap.get(move)?.toFixed(1)}%
                    </span>
                  )}
                </button>
              ))}
            </>
          )}
          {otherFilteredMoves.length > 0 && (
            <>
              {commonMoves.length > 0 && (
                <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50">
                  All Moves
                </div>
              )}
              {otherFilteredMoves.map((move) => (
                <button
                  key={move}
                  className="w-full px-3 py-1.5 text-sm text-left hover:bg-accent transition-colors"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    onChange(move)
                    setSearch(move)
                    setOpen(false)
                  }}
                >
                  {move}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
