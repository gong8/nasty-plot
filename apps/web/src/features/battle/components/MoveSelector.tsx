"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { TYPE_COLORS, type PokemonType } from "@nasty-plot/core";
import type { BattleActionSet, BattleFormat } from "@nasty-plot/battle-engine";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ArrowLeftRight, Sparkles, Target, Swords, Wand2, Circle } from "lucide-react";

/** Move targets that require the player to pick a specific target slot in doubles */
const TARGETABLE_MOVE_TARGETS = new Set(["normal", "any", "adjacentFoe"]);

const CATEGORY_ICONS = {
  Physical: Swords,
  Special: Wand2,
  Status: Circle,
} as const;

interface MoveSelectorProps {
  actions: BattleActionSet;
  onMoveSelect: (moveIndex: number, tera?: boolean, targetSlot?: number) => void;
  onSwitchClick: () => void;
  canTera: boolean;
  teraType?: PokemonType;
  /** Battle format — doubles enables target selection for single-target moves */
  format?: BattleFormat;
  /** Which active slot this selector is for in doubles (0 or 1) */
  activeSlot?: number;
  className?: string;
}

export function MoveSelector({
  actions,
  onMoveSelect,
  onSwitchClick,
  canTera,
  teraType,
  format,
  activeSlot,
  className,
}: MoveSelectorProps) {
  /** Index (0-based) of the move pending target selection, or null */
  const [pendingMoveIndex, setPendingMoveIndex] = useState<number | null>(null);
  /** Whether the pending move should also terastallize */
  const [pendingTera, setPendingTera] = useState(false);
  /** Per-move tera toggle state: which move index has tera enabled */
  const [teraOnMove, setTeraOnMove] = useState<number | null>(null);

  const isDoubles = format === "doubles";

  const needsTargetSelection = useCallback(
    (moveTarget: string): boolean => {
      return isDoubles && TARGETABLE_MOVE_TARGETS.has(moveTarget);
    },
    [isDoubles],
  );

  const handleMoveClick = useCallback(
    (zeroIndex: number) => {
      const move = actions.moves[zeroIndex];
      if (!move || move.disabled) return;

      const useTera = teraOnMove === zeroIndex;

      if (needsTargetSelection(move.target)) {
        setPendingMoveIndex(zeroIndex);
        setPendingTera(useTera);
      } else {
        onMoveSelect(zeroIndex + 1, useTera || undefined);
        setTeraOnMove(null);
      }
    },
    [actions.moves, needsTargetSelection, onMoveSelect, teraOnMove],
  );

  const handleTargetSelect = useCallback(
    (targetSlot: number) => {
      if (pendingMoveIndex === null) return;
      onMoveSelect(pendingMoveIndex + 1, pendingTera || undefined, targetSlot);
      setPendingMoveIndex(null);
      setPendingTera(false);
      setTeraOnMove(null);
    },
    [pendingMoveIndex, pendingTera, onMoveSelect],
  );

  const cancelTargetSelection = useCallback(() => {
    setPendingMoveIndex(null);
    setPendingTera(false);
  }, []);

  const toggleTeraOnMove = useCallback((moveIndex: number) => {
    setTeraOnMove((prev) => (prev === moveIndex ? null : moveIndex));
  }, []);

  if (actions.forceSwitch) {
    return null; // SwitchMenu handles forced switches
  }

  // Build the list of available targets for the pending move
  const targetOptions: { label: string; slot: number }[] = [];
  if (pendingMoveIndex !== null && isDoubles) {
    const move = actions.moves[pendingMoveIndex];
    if (move) {
      const target = move.target;
      targetOptions.push({ label: "Left Foe", slot: -1 });
      targetOptions.push({ label: "Right Foe", slot: -2 });
      if (target === "any") {
        const allySlot = activeSlot === 0 ? 2 : 1;
        targetOptions.push({ label: "Ally", slot: allySlot });
      }
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <TooltipProvider>
        <div className="grid grid-cols-2 gap-2">
          {actions.moves.map((move, i) => {
            const color = TYPE_COLORS[move.type] || "#A8A878";
            const isDamaging = move.category !== "Status" && move.basePower > 0;
            const isPending = pendingMoveIndex === i;
            const isTeraActive = teraOnMove === i;
            const CategoryIcon = CATEGORY_ICONS[move.category] || Circle;

            return (
              <div key={move.id} className="relative">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleMoveClick(i)}
                      disabled={move.disabled}
                      className={cn(
                        "relative w-full px-3 py-2 rounded-lg text-white font-semibold text-sm",
                        "transition-all hover:brightness-110 active:scale-[0.98]",
                        "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100",
                        "border border-white/20 shadow-sm",
                        isPending && "ring-2 ring-white ring-offset-2 ring-offset-background",
                        isTeraActive && "ring-2 ring-pink-400 ring-offset-1 ring-offset-background",
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
                        {isDamaging && (
                          <span className="font-mono">{move.basePower} BP</span>
                        )}
                        <span className="font-mono">
                          {move.accuracy === true ? "—" : `${move.accuracy}%`}
                        </span>
                        <span className="uppercase tracking-wider ml-auto">{move.type}</span>
                      </div>

                      {/* Per-move Tera toggle */}
                      {canTera && teraType && !move.disabled && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleTeraOnMove(i);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleTeraOnMove(i);
                            }
                          }}
                          className={cn(
                            "absolute top-1 right-1 p-0.5 rounded-sm transition-all cursor-pointer",
                            isTeraActive
                              ? "bg-pink-500/80 text-white"
                              : "bg-black/20 text-white/50 hover:text-white/80"
                          )}
                          title={`Tera ${teraType}`}
                        >
                          <Sparkles className="h-3 w-3" />
                        </span>
                      )}
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
                        <div className="text-xs text-muted-foreground capitalize">
                          Target: {move.target}
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

                {/* Target selection: inline row below the move in doubles */}
                {isPending && targetOptions.length > 0 && (
                  <div className="mt-1">
                    <div className="flex gap-1">
                      {targetOptions.map((opt) => (
                        <button
                          key={opt.slot}
                          onClick={() => handleTargetSelect(opt.slot)}
                          className={cn(
                            "flex-1 px-2 py-1.5 text-xs font-medium rounded-md",
                            "transition-colors border",
                            opt.slot < 0
                              ? "bg-red-500/15 text-red-600 border-red-500/30 hover:bg-red-500/25 dark:text-red-400"
                              : "bg-blue-500/15 text-blue-600 border-blue-500/30 hover:bg-blue-500/25 dark:text-blue-400",
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                      <button
                        onClick={cancelTargetSelection}
                        className="px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-md border border-border"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </TooltipProvider>

      {/* Bottom row: switch button only (tera is now per-move) */}
      <div className="flex gap-2">
        {canTera && teraType && teraOnMove !== null && (
          <div className="flex items-center gap-1 text-xs text-pink-500 dark:text-pink-400">
            <Sparkles className="h-3 w-3" />
            Tera {teraType} active
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          className="flex-1 gap-1.5 ml-auto"
          onClick={onSwitchClick}
          disabled={actions.switches.length === 0}
        >
          <ArrowLeftRight className="h-3.5 w-3.5" />
          Switch
        </Button>
      </div>
    </div>
  );
}
