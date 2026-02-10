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
import { ArrowLeftRight, Sparkles, Target } from "lucide-react";

/** Move targets that require the player to pick a specific target slot in doubles */
const TARGETABLE_MOVE_TARGETS = new Set(["normal", "any", "adjacentFoe"]);

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

  const isDoubles = format === "doubles";

  const needsTargetSelection = useCallback(
    (moveTarget: string): boolean => {
      return isDoubles && TARGETABLE_MOVE_TARGETS.has(moveTarget);
    },
    [isDoubles],
  );

  const handleMoveClick = useCallback(
    (zeroIndex: number, tera: boolean = false) => {
      const move = actions.moves[zeroIndex];
      if (!move || move.disabled) return;

      if (needsTargetSelection(move.target)) {
        setPendingMoveIndex(zeroIndex);
        setPendingTera(tera);
      } else {
        // No target selection needed -- fire immediately
        onMoveSelect(zeroIndex + 1, tera);
      }
    },
    [actions.moves, needsTargetSelection, onMoveSelect],
  );

  const handleTargetSelect = useCallback(
    (targetSlot: number) => {
      if (pendingMoveIndex === null) return;
      onMoveSelect(pendingMoveIndex + 1, pendingTera || undefined, targetSlot);
      setPendingMoveIndex(null);
      setPendingTera(false);
    },
    [pendingMoveIndex, pendingTera, onMoveSelect],
  );

  const cancelTargetSelection = useCallback(() => {
    setPendingMoveIndex(null);
    setPendingTera(false);
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

      // Foe targets: always available for normal/any/adjacentFoe
      targetOptions.push({ label: "Left Foe", slot: -1 });
      targetOptions.push({ label: "Right Foe", slot: -2 });

      // "any" can also target ally slots
      if (target === "any") {
        // Ally slot: the other active position (not the one making the choice)
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
            return (
              <div key={move.id} className="relative">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleMoveClick(i)}
                      disabled={move.disabled}
                      className={cn(
                        "relative w-full px-3 py-2.5 rounded-lg text-white font-semibold text-sm",
                        "transition-all hover:brightness-110 active:scale-[0.98]",
                        "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100",
                        "border border-white/20 shadow-sm",
                        isPending && "ring-2 ring-white ring-offset-2 ring-offset-background",
                      )}
                      style={{
                        backgroundColor: move.disabled ? "#666" : color,
                      }}
                    >
                      <div className="flex justify-between items-center">
                        <span className="flex items-center gap-1">
                          {move.name}
                          {isDoubles && needsTargetSelection(move.target) && !move.disabled && (
                            <Target className="h-3 w-3 opacity-50" />
                          )}
                        </span>
                        <span className="text-xs opacity-75">
                          {move.pp}/{move.maxPp}
                        </span>
                      </div>
                      <div className="text-[10px] uppercase tracking-wider opacity-60 text-left mt-0.5">
                        {move.type}
                      </div>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={6}>
                    <div className="space-y-1 py-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{move.category}</span>
                        {isDamaging && (
                          <>
                            <span className="text-muted-foreground">|</span>
                            <span>BP: {move.basePower}</span>
                          </>
                        )}
                        <span className="text-muted-foreground">|</span>
                        <span>
                          Acc: {move.accuracy === true ? "\u2014" : `${move.accuracy}%`}
                        </span>
                      </div>
                      {isDoubles && (
                        <div className="text-xs text-muted-foreground capitalize">
                          Target: {move.target}
                        </div>
                      )}
                      {move.description && (
                        <p className="text-muted-foreground max-w-[220px]">
                          {move.description}
                        </p>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>

                {/* Target selection overlay for this move */}
                {isPending && targetOptions.length > 0 && (
                  <div className="absolute inset-x-0 -bottom-1 translate-y-full z-10">
                    <div className="bg-popover border rounded-lg shadow-lg p-1.5 space-y-1">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-1 font-medium">
                        Choose target
                      </div>
                      <div className="flex gap-1">
                        {targetOptions.map((opt) => (
                          <button
                            key={opt.slot}
                            onClick={() => handleTargetSelect(opt.slot)}
                            className={cn(
                              "flex-1 px-2 py-1.5 text-xs font-medium rounded-md",
                              "transition-colors",
                              opt.slot < 0
                                ? "bg-red-500/15 text-red-600 hover:bg-red-500/25 dark:text-red-400"
                                : "bg-blue-500/15 text-blue-600 hover:bg-blue-500/25 dark:text-blue-400",
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={cancelTargetSelection}
                        className="w-full text-[10px] text-muted-foreground hover:text-foreground transition-colors py-0.5"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </TooltipProvider>

      <div className="flex gap-2">
        {canTera && teraType && (
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1.5"
            onClick={() => {
              const firstEnabled = actions.moves.findIndex((m) => !m.disabled);
              if (firstEnabled >= 0) {
                handleMoveClick(firstEnabled, true);
              }
            }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Tera {teraType}
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          className="flex-1 gap-1.5"
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
