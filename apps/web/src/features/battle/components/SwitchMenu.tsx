"use client";

import { cn } from "@/lib/utils";
import type { BattleActionSet } from "@nasty-plot/battle-engine";
import { Button } from "@/components/ui/button";
import { HealthBar } from "./HealthBar";
import { BattleSprite } from "./PokemonSprite";
import { ArrowLeft } from "lucide-react";

interface SwitchMenuProps {
  actions: BattleActionSet;
  onSwitch: (pokemonIndex: number) => void;
  onBack?: () => void;
  className?: string;
}

const STATUS_LABELS: Record<string, string> = {
  brn: "BRN",
  par: "PAR",
  slp: "SLP",
  frz: "FRZ",
  psn: "PSN",
  tox: "TOX",
};

const STATUS_COLORS: Record<string, string> = {
  brn: "text-red-500 bg-red-500/10",
  par: "text-yellow-500 bg-yellow-500/10",
  slp: "text-muted-foreground bg-muted-foreground/10",
  frz: "text-cyan-400 bg-cyan-400/10",
  psn: "text-purple-500 bg-purple-500/10",
  tox: "text-purple-600 bg-purple-600/10",
};

export function SwitchMenu({ actions, onSwitch, onBack, className }: SwitchMenuProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          {actions.forceSwitch ? "Choose a Pokemon to send out" : "Switch Pokemon"}
        </h3>
        {onBack && !actions.forceSwitch && (
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Button>
        )}
      </div>

      <div className="space-y-1.5">
        {actions.switches.map((sw) => (
          <button
            key={sw.index}
            onClick={() => onSwitch(sw.index)}
            disabled={sw.fainted}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-lg border",
              "transition-colors hover:bg-accent",
              "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent",
              sw.fainted && "line-through"
            )}
          >
            <BattleSprite
              speciesId={sw.speciesId}
              side="front"
              fainted={sw.fainted}
              size={40}
            />

            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{sw.name}</span>
                {sw.status && (
                  <span
                    className={cn(
                      "text-[10px] px-1 rounded font-semibold",
                      STATUS_COLORS[sw.status] || "text-muted-foreground"
                    )}
                  >
                    {STATUS_LABELS[sw.status] || sw.status.toUpperCase()}
                  </span>
                )}
              </div>
              <HealthBar hp={sw.hp} maxHp={sw.maxHp} showText={true} className="mt-1" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
