"use client"

import { useState, useMemo } from "react"
import { cn } from "./utils"
import type { MoveData, PokemonType } from "@nasty-plot/core"
import { TYPE_COLORS, isLightTypeColor } from "@nasty-plot/core"

const MAX_DISPLAYED_MOVES = 50
const BLUR_CLOSE_DELAY_MS = 150

const MOVE_CATEGORY_COLORS: Record<string, string> = {
  Physical: "text-red-500",
  Special: "text-blue-500",
}

const MOVE_CATEGORY_ABBREV: Record<string, string> = {
  Physical: "Phys",
  Special: "Spec",
}

interface MovePopularity {
  name: string
  usagePercent: number
}

interface MoveSelectorProps {
  /** Currently selected move name */
  value: string
  /** Called when a move is selected */
  onSelect: (moveName: string) => void
  /** Full list of MoveData objects to select from (e.g. from learnset API) */
  moves?: MoveData[]
  /** Simple list of move name strings (alternative to `moves`). Used when full MoveData is not available. */
  moveNames?: string[]
  /** Move popularity/usage data for highlighting common moves */
  popularity?: MovePopularity[]
  /** Maximum number of popular moves to show in "Common" section */
  maxCommonMoves?: number
  /** Moves to exclude from the dropdown (e.g. already-selected moves in other slots) */
  excludeMoves?: Set<string>
  /** Placeholder text */
  placeholder?: string
  /** Show move type, category, and power metadata (only when `moves` MoveData is provided) */
  showMetadata?: boolean
  /** Compact size variant */
  compact?: boolean
  /** Whether the selector is disabled */
  disabled?: boolean
  /** Additional className for the root container */
  className?: string
}

export function MoveSelector({
  value,
  onSelect,
  moves,
  moveNames,
  popularity,
  maxCommonMoves = 12,
  excludeMoves,
  placeholder = "Select move...",
  showMetadata = true,
  compact = false,
  disabled = false,
  className,
}: MoveSelectorProps) {
  const [search, setSearch] = useState("")
  const [open, setOpen] = useState(false)

  // Build a unified list of available move names, filtering out excluded moves
  const { commonMoves, filteredMoves } = useMemo(() => {
    // Get all available move names
    let available: string[]
    if (moves) {
      available = moves.map((m) => m.name)
    } else if (moveNames) {
      available = moveNames
    } else {
      return { commonMoves: [] as string[], filteredMoves: [] as string[] }
    }

    // Filter out excluded moves
    if (excludeMoves && excludeMoves.size > 0) {
      available = available.filter((m) => !excludeMoves.has(m.toLowerCase()))
    }

    // Apply search filter
    if (search) {
      const lower = search.toLowerCase()
      available = available.filter((m) => m.toLowerCase().includes(lower))
    }

    // Split into common and other
    if (!popularity?.length) {
      return {
        commonMoves: [] as string[],
        filteredMoves: available.slice(0, MAX_DISPLAYED_MOVES),
      }
    }

    const availableSet = new Set(available)
    const common = popularity
      .filter((m) => availableSet.has(m.name))
      .slice(0, maxCommonMoves)
      .map((m) => m.name)

    const commonSet = new Set(common)
    const other = available.filter((m) => !commonSet.has(m)).slice(0, MAX_DISPLAYED_MOVES)

    return { commonMoves: common, filteredMoves: other }
  }, [moves, moveNames, search, excludeMoves, popularity, maxCommonMoves])

  // Build a lookup map for move metadata
  const moveDataMap = useMemo(() => {
    if (!moves) return null
    return new Map(moves.map((m) => [m.name, m]))
  }, [moves])

  // Build popularity lookup
  const popularityMap = useMemo(() => {
    if (!popularity?.length) return null
    return new Map(popularity.map((m) => [m.name, m.usagePercent]))
  }, [popularity])

  const isDuplicate = value && excludeMoves?.has(value.toLowerCase())

  function handleSelect(moveName: string) {
    onSelect(moveName)
    setSearch(moveName)
    setOpen(false)
  }

  function renderMoveItem(moveName: string, showPopularity: boolean) {
    const moveData = moveDataMap?.get(moveName)
    return (
      <button
        key={moveName}
        className="w-full px-3 py-1.5 text-sm text-left hover:bg-accent transition-colors flex items-center justify-between gap-2"
        onMouseDown={(e) => {
          e.preventDefault()
          handleSelect(moveName)
        }}
      >
        <span className="flex-1 truncate">{moveName}</span>
        {showMetadata && moveData && (
          <>
            <span
              className={cn(
                "text-[10px] shrink-0",
                MOVE_CATEGORY_COLORS[moveData.category] ?? "text-muted-foreground",
              )}
            >
              {MOVE_CATEGORY_ABBREV[moveData.category] ?? "Stat"}
            </span>
            <span
              className="inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-medium shrink-0"
              style={{
                backgroundColor: TYPE_COLORS[moveData.type as PokemonType],
                color: isLightTypeColor(TYPE_COLORS[moveData.type as PokemonType])
                  ? "#111"
                  : "#fff",
              }}
            >
              {moveData.type}
            </span>
            {moveData.basePower > 0 && (
              <span className="text-[10px] text-muted-foreground shrink-0 w-6 text-right">
                {moveData.basePower}
              </span>
            )}
          </>
        )}
        {showPopularity && popularityMap && (
          <span className="text-xs text-muted-foreground shrink-0">
            {popularityMap.get(moveName)?.toFixed(1)}%
          </span>
        )}
      </button>
    )
  }

  return (
    <div className={cn("relative", className)}>
      <input
        type="text"
        placeholder={placeholder}
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
          setTimeout(() => setOpen(false), BLUR_CLOSE_DELAY_MS)
        }}
        disabled={disabled}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
          "ring-offset-background placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          compact && "h-8 text-sm",
          isDuplicate && "border-destructive",
        )}
      />
      {isDuplicate && <p className="text-[10px] text-destructive mt-0.5">Duplicate move</p>}
      {open && (commonMoves.length > 0 || filteredMoves.length > 0) && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-[200px] overflow-y-auto">
          {commonMoves.length > 0 && (
            <>
              <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50">
                Common
              </div>
              {commonMoves.map((move) => renderMoveItem(move, true))}
            </>
          )}
          {filteredMoves.length > 0 && (
            <>
              {commonMoves.length > 0 && (
                <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50">
                  All Moves
                </div>
              )}
              {filteredMoves.map((move) => renderMoveItem(move, false))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
