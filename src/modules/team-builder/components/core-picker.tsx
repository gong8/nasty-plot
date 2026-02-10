"use client";

import { Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TypeBadge } from "@/shared/components/type-badge";
import { PokemonSprite } from "@/shared/components/pokemon-sprite";
import type { PokemonType, UsageStatsEntry } from "@/shared/types";
import type { CorePokemon } from "../hooks/use-guided-builder";

interface CorePickerProps {
  pokemon: UsageStatsEntry[];
  selected: CorePokemon[];
  onToggle: (pokemon: CorePokemon) => void;
  maxPicks?: number;
}

export function CorePicker({ pokemon, selected, onToggle, maxPicks = 3 }: CorePickerProps) {
  const selectedIds = new Set(selected.map((p) => p.pokemonId));
  const atMax = selected.length >= maxPicks;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Pick {maxPicks === 1 ? "1 Pokemon" : `1-${maxPicks} Pokemon`} as your team core
        </p>
        <p className="text-sm font-medium">
          {selected.length} / {maxPicks} selected
        </p>
      </div>

      {/* Type synergy preview */}
      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 p-3 bg-muted/50 rounded-lg">
          <span className="text-xs font-medium text-muted-foreground mr-1">Types:</span>
          {[...new Set(selected.flatMap((p) => p.types))].map((type) => (
            <TypeBadge key={type} type={type} size="sm" />
          ))}
        </div>
      )}

      {/* Pokemon grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {pokemon.map((p) => {
          const isSelected = selectedIds.has(p.pokemonId);
          const disabled = !isSelected && atMax;
          const displayName = p.pokemonName || p.pokemonId;
          const types: PokemonType[] = p.types ?? ["Normal"];
          const dexNum = p.num ?? 0;

          return (
            <Card
              key={p.pokemonId}
              className={cn(
                "cursor-pointer transition-all",
                isSelected && "ring-2 ring-primary bg-primary/5",
                disabled && "opacity-50 cursor-not-allowed",
                !isSelected && !disabled && "hover:shadow-md hover:border-primary/50"
              )}
              onClick={() => {
                if (disabled) return;
                onToggle({
                  pokemonId: p.pokemonId,
                  pokemonName: displayName,
                  types,
                  usagePercent: p.usagePercent,
                });
              }}
            >
              <CardContent className="relative flex flex-col items-center gap-1 p-3">
                {isSelected && (
                  <div className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="h-3 w-3 text-primary-foreground" />
                  </div>
                )}
                {dexNum > 0 ? (
                  <PokemonSprite pokemonId={p.pokemonId} num={dexNum} size={64} />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-lg font-bold uppercase text-muted-foreground">
                    {p.pokemonId.slice(0, 2)}
                  </div>
                )}
                <span className="text-xs font-medium truncate w-full text-center">
                  {displayName}
                </span>
                <div className="flex gap-0.5">
                  {types.map((t) => (
                    <TypeBadge key={t} type={t} size="sm" />
                  ))}
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {p.usagePercent.toFixed(1)}% usage
                </span>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
