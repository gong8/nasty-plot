"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BattleSprite } from "./PokemonSprite";
import type { BattlePokemon, BattleFormat } from "@nasty-plot/battle-engine";
import { Check } from "lucide-react";

interface TeamPreviewProps {
  playerTeam: BattlePokemon[];
  opponentTeam: BattlePokemon[];
  format: BattleFormat;
  onSubmit: (leadOrder: number[]) => void;
  className?: string;
}

export function TeamPreview({
  playerTeam,
  opponentTeam,
  format,
  onSubmit,
  className,
}: TeamPreviewProps) {
  // Singles: click to select lead (position 1)
  // Doubles/VGC: click to select up to 4, then pick 2 leads
  const [selectedLead, setSelectedLead] = useState<number | null>(null);

  const handleSelect = (index: number) => {
    setSelectedLead(index);
  };

  const handleSubmit = () => {
    if (selectedLead === null) return;

    // Build lead order: selected first, then rest in order
    const order: number[] = [selectedLead + 1];
    for (let i = 0; i < playerTeam.length; i++) {
      if (i !== selectedLead) {
        order.push(i + 1);
      }
    }
    onSubmit(order);
  };

  return (
    <div className={cn("space-y-6", className)}>
      <div className="text-center">
        <h2 className="text-lg font-bold">Team Preview</h2>
        <p className="text-sm text-muted-foreground">
          Select your lead Pokemon
        </p>
      </div>

      {/* Opponent team */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-2">Opponent&apos;s Team</h3>
        <div className="flex gap-3 justify-center flex-wrap">
          {opponentTeam.map((pokemon, i) => (
            <div
              key={i}
              className="flex flex-col items-center gap-1 p-2 rounded-lg bg-muted/50"
            >
              <BattleSprite speciesId={pokemon.speciesId || pokemon.name} side="front" size={64} />
              <span className="text-xs font-medium">{pokemon.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-4">
        <div className="flex-1 border-t" />
        <span className="text-xs text-muted-foreground font-semibold">VS</span>
        <div className="flex-1 border-t" />
      </div>

      {/* Player team */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-2">Your Team</h3>
        <div className="flex gap-3 justify-center flex-wrap">
          {playerTeam.map((pokemon, i) => (
            <button
              key={i}
              onClick={() => handleSelect(i)}
              className={cn(
                "flex flex-col items-center gap-1 p-2 rounded-lg",
                "transition-all border-2",
                selectedLead === i
                  ? "border-primary bg-primary/10 shadow-md"
                  : "border-transparent hover:bg-accent"
              )}
            >
              <div className="relative">
                <BattleSprite speciesId={pokemon.speciesId || pokemon.name} side="back" size={64} />
                {selectedLead === i && (
                  <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                    <Check className="h-3 w-3" />
                  </div>
                )}
              </div>
              <span className="text-xs font-medium">{pokemon.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-center">
        <Button
          onClick={handleSubmit}
          disabled={selectedLead === null}
          size="lg"
        >
          Start Battle
        </Button>
      </div>
    </div>
  );
}
