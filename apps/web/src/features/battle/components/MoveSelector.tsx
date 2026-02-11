"use client"

import { useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import { TYPE_COLORS, isLightTypeColor, type PokemonType } from "@nasty-plot/core"
import type { BattleActionSet, BattleFormat, BattlePokemon } from "@nasty-plot/battle-engine"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { ArrowLeftRight, Sparkles, Target, Swords, Wand2, Circle } from "lucide-react"
import { BattleSprite } from "./PokemonSprite"

/** Move targets that require the player to pick a specific target slot in doubles */
const TARGETABLE_MOVE_TARGETS = new Set([
  "normal", // Can hit any adjacent: either foe + ally
  "any", // Can hit any Pokemon on field including self
  "adjacentFoe", // Can hit either foe
  "adjacentAlly", // Can hit ally (auto-resolved in doubles since only 1 ally)
  "adjacentAllyOrSelf", // Can hit self or ally
])

function formatTargetType(target: string): string {
  switch (target) {
    case "normal":
      return "One adjacent"
    case "any":
      return "Any Pokemon"
    case "adjacentFoe":
      return "One opponent"
    case "adjacentAlly":
      return "Ally"
    case "adjacentAllyOrSelf":
      return "Self or ally"
    case "allAdjacent":
      return "All adjacent (including ally)"
    case "allAdjacentFoes":
      return "All opponents"
    case "self":
      return "Self"
    case "all":
      return "All Pokemon"
    default:
      return target
  }
}

const CATEGORY_ICONS = {
  Physical: Swords,
  Special: Wand2,
  Status: Circle,
} as const

/** Info needed for each slot in the target grid */
interface TargetSlotInfo {
  pokemon: BattlePokemon | null
  slot: number
  isFoe: boolean
  isSelectable: boolean
  isSelf: boolean
}

interface MoveSelectorProps {
  actions: BattleActionSet
  onMoveSelect: (moveIndex: number, tera?: boolean, targetSlot?: number) => void
  onSwitchClick: () => void
  canTera: boolean
  teraType?: PokemonType
  /** Battle format — doubles enables target selection for single-target moves */
  format?: BattleFormat
  /** Which active slot this selector is for in doubles (0 or 1) */
  activeSlot?: number
  /** Opponent active Pokemon (p2 side) */
  opponentActive?: (BattlePokemon | null)[]
  /** Player active Pokemon (p1 side) */
  playerActive?: (BattlePokemon | null)[]
  className?: string
}

export function MoveSelector({
  actions,
  onMoveSelect,
  onSwitchClick,
  canTera,
  teraType,
  format,
  activeSlot,
  opponentActive,
  playerActive,
  className,
}: MoveSelectorProps) {
  /** Index (0-based) of the move pending target selection, or null */
  const [pendingMoveIndex, setPendingMoveIndex] = useState<number | null>(null)
  /** Whether the pending move should also terastallize */
  const [pendingTera, setPendingTera] = useState(false)
  /** Global tera toggle — applies to whichever move is clicked next */
  const [teraActive, setTeraActive] = useState(false)

  const isDoubles = format === "doubles"

  const needsTargetSelection = useCallback(
    (moveTarget: string): boolean => {
      return isDoubles && TARGETABLE_MOVE_TARGETS.has(moveTarget)
    },
    [isDoubles],
  )

  const handleMoveClick = useCallback(
    (zeroIndex: number) => {
      const move = actions.moves[zeroIndex]
      if (!move || move.disabled) return

      const useTera = teraActive && canTera

      if (needsTargetSelection(move.target)) {
        // adjacentAlly has only one valid target — auto-resolve
        if (move.target === "adjacentAlly") {
          const allySlot = (activeSlot ?? 0) === 0 ? -2 : -1
          onMoveSelect(zeroIndex + 1, useTera || undefined, allySlot)
          setTeraActive(false)
          return
        }
        setPendingMoveIndex(zeroIndex)
        setPendingTera(useTera)
      } else {
        onMoveSelect(zeroIndex + 1, useTera || undefined)
        setTeraActive(false)
      }
    },
    [actions.moves, needsTargetSelection, onMoveSelect, teraActive, canTera, activeSlot],
  )

  const handleTargetSelect = useCallback(
    (targetSlot: number) => {
      if (pendingMoveIndex === null) return
      onMoveSelect(pendingMoveIndex + 1, pendingTera || undefined, targetSlot)
      setPendingMoveIndex(null)
      setPendingTera(false)
      setTeraActive(false)
    },
    [pendingMoveIndex, pendingTera, onMoveSelect],
  )

  const cancelTargetSelection = useCallback(() => {
    setPendingMoveIndex(null)
    setPendingTera(false)
  }, [])

  if (actions.forceSwitch) {
    return null // SwitchMenu handles forced switches
  }

  // Build 2x2 grid slots for the target modal
  // @pkmn/sim target slots: positive (1,2) = foe slots, negative (-1,-2) = self/ally slots
  const allySlot = (activeSlot ?? 0) === 0 ? -2 : -1
  const selfSlot = (activeSlot ?? 0) === 0 ? -1 : -2
  const mySlotIndex = activeSlot ?? 0
  const allySlotIndex = mySlotIndex === 0 ? 1 : 0

  const pendingMove = pendingMoveIndex !== null ? actions.moves[pendingMoveIndex] : null
  const pendingTarget = pendingMove?.target ?? ""

  // Determine which slots are selectable based on the move's target type
  const isSlotSelectable = (isFoe: boolean, isSelf: boolean): boolean => {
    if (!pendingMove) return false
    switch (pendingTarget) {
      case "normal":
        return isFoe || (!isSelf && !isFoe) // foes + ally
      case "adjacentFoe":
        return isFoe
      case "any":
        return true // all slots
      case "adjacentAllyOrSelf":
        return !isFoe // self + ally
      default:
        return false
    }
  }

  const gridSlots: [TargetSlotInfo, TargetSlotInfo, TargetSlotInfo, TargetSlotInfo] = [
    // Top row: opponent side (p2a, p2b)
    {
      pokemon: opponentActive?.[0] ?? null,
      slot: 1,
      isFoe: true,
      isSelectable: isSlotSelectable(true, false),
      isSelf: false,
    },
    {
      pokemon: opponentActive?.[1] ?? null,
      slot: 2,
      isFoe: true,
      isSelectable: isSlotSelectable(true, false),
      isSelf: false,
    },
    // Bottom row: player side — ordered so self is on left, ally on right
    // (from player perspective, slot 0 = left, slot 1 = right)
    {
      pokemon: playerActive?.[mySlotIndex] ?? null,
      slot: selfSlot,
      isFoe: false,
      isSelectable: isSlotSelectable(false, true),
      isSelf: true,
    },
    {
      pokemon: playerActive?.[allySlotIndex] ?? null,
      slot: allySlot,
      isFoe: false,
      isSelectable: isSlotSelectable(false, false),
      isSelf: false,
    },
  ]

  return (
    <div className={cn("space-y-0", className)}>
      <TooltipProvider>
        <div className="grid grid-cols-2 gap-2">
          {actions.moves.map((move, i) => {
            const color = TYPE_COLORS[move.type] || "#A8A878"
            const light = isLightTypeColor(color)
            const isDamaging = move.category !== "Status" && move.basePower > 0
            const CategoryIcon = CATEGORY_ICONS[move.category] || Circle

            return (
              <div key={move.id} className="relative">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleMoveClick(i)}
                      disabled={move.disabled}
                      className={cn(
                        "relative w-full px-3 py-2 rounded-lg font-semibold text-sm",
                        "transition-all hover:brightness-110 active:scale-[0.98]",
                        "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100",
                        "shadow-sm",
                        light
                          ? "text-gray-900 border border-black/10"
                          : "text-white border border-white/20",
                      )}
                      style={{
                        backgroundColor: move.disabled ? "#666" : color,
                      }}
                    >
                      {/* Move name + PP */}
                      <div className="flex justify-between items-center">
                        <span className="flex items-center gap-1 truncate">
                          {move.name}
                          {isDoubles && needsTargetSelection(move.target) && !move.disabled && (
                            <Target className="h-3 w-3 opacity-50 shrink-0" />
                          )}
                        </span>
                        <span className="text-[10px] opacity-70 font-mono shrink-0 ml-1">
                          {move.pp}/{move.maxPp}
                        </span>
                      </div>

                      {/* Stats row: Category icon, BP, Accuracy, Type */}
                      <div className="flex items-center gap-1.5 mt-1 text-[10px] opacity-80">
                        <CategoryIcon className="h-3 w-3 shrink-0" />
                        {isDamaging && <span className="font-mono">{move.basePower} BP</span>}
                        <span className="font-mono">
                          {move.accuracy === true ? "—" : `${move.accuracy}%`}
                        </span>
                        <span className="uppercase tracking-wider ml-auto">{move.type}</span>
                      </div>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={6}>
                    <div className="space-y-1 py-0.5">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-semibold">{move.name}</span>
                        <span className="text-muted-foreground">·</span>
                        <span>{move.category}</span>
                      </div>
                      {isDoubles && (
                        <div className="text-xs text-muted-foreground">
                          Target: {formatTargetType(move.target)}
                        </div>
                      )}
                      {move.description && (
                        <p className="text-muted-foreground max-w-[220px] text-xs">
                          {move.description}
                        </p>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>
            )
          })}

          {/* Row 3: Switch + Tera, inside the same 2-col grid */}
          <Button
            variant="outline"
            size="sm"
            className={cn("gap-1.5 h-auto py-2", !(canTera && teraType) && "col-span-2")}
            onClick={onSwitchClick}
            disabled={actions.switches.length === 0}
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            Switch
          </Button>

          {canTera && teraType && (
            <button
              onClick={() => setTeraActive((prev) => !prev)}
              className={cn(
                "flex items-center justify-center gap-2 rounded-lg text-sm font-semibold py-2 px-3",
                "transition-all border",
                teraActive
                  ? "bg-pink-500/20 border-pink-500 text-pink-400 ring-2 ring-pink-400/30"
                  : "bg-transparent border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Tera {teraType}
            </button>
          )}
        </div>
      </TooltipProvider>

      {/* Target selection modal */}
      <Dialog
        open={pendingMoveIndex !== null}
        onOpenChange={(open) => !open && cancelTargetSelection()}
      >
        <DialogContent showCloseButton={false} className="sm:max-w-sm p-4">
          <DialogHeader className="pb-0">
            <DialogTitle className="text-base">
              {pendingMove && (
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: TYPE_COLORS[pendingMove.type] || "#A8A878" }}
                  />
                  {pendingMove.name}
                </span>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {pendingMove && formatTargetType(pendingMove.target)} — pick a target
            </DialogDescription>
          </DialogHeader>

          {/* 2x2 battlefield grid */}
          <div className="space-y-2">
            {/* Opponent label */}
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-center">
              Opponent
            </div>

            {/* Top row: foes */}
            <div className="grid grid-cols-2 gap-2">
              {gridSlots.slice(0, 2).map((info) => (
                <TargetCard key={`foe-${info.slot}`} info={info} onSelect={handleTargetSelect} />
              ))}
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 border-t border-dashed" />
              <span className="text-[10px] text-muted-foreground font-medium">VS</span>
              <div className="flex-1 border-t border-dashed" />
            </div>

            {/* Bottom row: player side */}
            <div className="grid grid-cols-2 gap-2">
              {gridSlots.slice(2).map((info) => (
                <TargetCard key={`ally-${info.slot}`} info={info} onSelect={handleTargetSelect} />
              ))}
            </div>

            {/* Player label */}
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-center">
              Your side
            </div>
          </div>

          <Button variant="ghost" size="sm" onClick={cancelTargetSelection} className="w-full mt-1">
            Cancel
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** Single slot in the 2x2 target grid */
function TargetCard({
  info,
  onSelect,
}: {
  info: TargetSlotInfo
  onSelect: (slot: number) => void
}) {
  const { pokemon, slot, isFoe, isSelectable, isSelf } = info

  if (!pokemon || pokemon.fainted) {
    return (
      <div className="flex flex-col items-center gap-1 p-2 rounded-lg border border-dashed border-muted-foreground/20 opacity-40">
        <div className="w-12 h-12 flex items-center justify-center text-muted-foreground text-xs">
          {pokemon?.fainted ? "Fainted" : "Empty"}
        </div>
      </div>
    )
  }

  const hpPercent = pokemon.maxHp > 0 ? (pokemon.hp / pokemon.maxHp) * 100 : 0
  const hpColor = hpPercent > 50 ? "bg-green-500" : hpPercent > 20 ? "bg-yellow-500" : "bg-red-500"

  return (
    <button
      onClick={() => isSelectable && onSelect(slot)}
      disabled={!isSelectable}
      className={cn(
        "flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all",
        isSelectable &&
          isFoe &&
          "border-red-500/40 hover:border-red-500 hover:bg-red-500/10 cursor-pointer",
        isSelectable &&
          !isFoe &&
          "border-blue-500/40 hover:border-blue-500 hover:bg-blue-500/10 cursor-pointer",
        !isSelectable && "border-transparent opacity-40 cursor-not-allowed",
      )}
    >
      <BattleSprite
        speciesId={pokemon.speciesId || pokemon.name}
        side={isFoe ? "front" : "back"}
        size={48}
      />

      {/* Name + role badge */}
      <div className="flex items-center gap-1">
        <span className="text-xs font-semibold truncate max-w-[80px]">{pokemon.name}</span>
        {isSelf && (
          <span className="text-[9px] px-1 py-px rounded bg-primary/15 text-primary font-medium">
            You
          </span>
        )}
      </div>

      {/* HP bar */}
      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", hpColor)}
          style={{ width: `${hpPercent}%` }}
        />
      </div>

      {/* Type badges */}
      <div className="flex gap-0.5">
        {pokemon.types.map((t) => (
          <span
            key={t}
            className={`text-[9px] px-1 py-px rounded font-medium ${isLightTypeColor(TYPE_COLORS[t] || "#A8A878") ? "text-gray-900" : "text-white"}`}
            style={{ backgroundColor: TYPE_COLORS[t] || "#A8A878" }}
          >
            {t}
          </span>
        ))}
      </div>
    </button>
  )
}
