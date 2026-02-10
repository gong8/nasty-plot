"use client";

import { cn } from "@/lib/utils";
import { TYPE_COLORS } from "@nasty-plot/core";
import type { PokemonType } from "@nasty-plot/core";
import type { BattleActionSet } from "@nasty-plot/battle-engine";
import { Button } from "@/components/ui/button";
import { ArrowLeftRight, Sparkles } from "lucide-react";

interface MoveSelectorProps {
  actions: BattleActionSet;
  onMoveSelect: (moveIndex: number, tera?: boolean) => void;
  onSwitchClick: () => void;
  canTera: boolean;
  teraType?: PokemonType;
  className?: string;
}

export function MoveSelector({
  actions,
  onMoveSelect,
  onSwitchClick,
  canTera,
  teraType,
  className,
}: MoveSelectorProps) {
  if (actions.forceSwitch) {
    return null; // SwitchMenu handles forced switches
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="grid grid-cols-2 gap-2">
        {actions.moves.map((move, i) => {
          const color = TYPE_COLORS[move.type] || "#A8A878";
          return (
            <button
              key={move.id}
              onClick={() => onMoveSelect(i + 1)}
              disabled={move.disabled}
              className={cn(
                "relative px-3 py-2.5 rounded-lg text-white font-semibold text-sm",
                "transition-all hover:brightness-110 active:scale-[0.98]",
                "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100",
                "border border-white/20 shadow-sm"
              )}
              style={{
                backgroundColor: move.disabled ? "#666" : color,
              }}
            >
              <div className="flex justify-between items-center">
                <span>{move.name}</span>
                <span className="text-xs opacity-75">
                  {move.pp}/{move.maxPp}
                </span>
              </div>
              <div className="text-[10px] uppercase tracking-wider opacity-60 text-left mt-0.5">
                {move.type}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex gap-2">
        {canTera && teraType && (
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1.5"
            onClick={() => {
              // Tera + pick a move - for now, tera with first enabled move
              const firstEnabled = actions.moves.findIndex((m) => !m.disabled);
              if (firstEnabled >= 0) {
                onMoveSelect(firstEnabled + 1, true);
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
