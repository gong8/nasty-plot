"use client";

import { Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TypeBadge } from "@/shared/components/type-badge";
import { PokemonSprite } from "@/shared/components/pokemon-sprite";
import type { PokemonType } from "@/shared/types";
import type { CorePokemon } from "../hooks/use-guided-builder";

interface CorePickerProps {
  pokemon: {
    pokemonId: string;
    pokemonName?: string;
    usagePercent: number;
    rank: number;
  }[];
  selected: CorePokemon[];
  onToggle: (pokemon: CorePokemon) => void;
  maxPicks?: number;
}

// Map pokemonId to approximate national dex number for sprite lookup.
// This is a best-effort mapping for common Pokemon; unknown ones get 0.
function estimateDexNum(pokemonId: string): number {
  // Common gen 9 OU Pokemon dex numbers
  const DEX_MAP: Record<string, number> = {
    greatTusk: 984, ironValiant: 1006, gholdengo: 1000, dragapult: 887,
    kingambit: 983, landorusTherian: 645, heatran: 485, ironMoth: 994,
    ironTreads: 990, garganacl: 968, clodsire: 980, toxapex: 748,
    gliscor: 472, slowking: 199, roaringMoon: 1005, ironBundle: 991,
    volcarona: 637, rotomWash: 479, zamazenta: 889, dragonite: 149,
    tyranitar: 248, ferrothorn: 598, clefable: 36, garchomp: 445,
    samurott: 503, skeledirge: 911, annihilape: 979, ironJugulis: 993,
    chiYu: 1004, tingLu: 1003, chienPao: 1002, woChien: 1001,
    palafin: 964, espathra: 956, flamigo: 973, dondozo: 977,
    tatsugiri: 978, ceruledge: 937, armarouge: 936, corviknight: 823,
    grimmsnarl: 861, tornadusTherian: 641, pelipper: 279,
    barraskewda: 847, weavile: 461, breloom: 286, manaphy: 490,
    serperior: 497, rillaboom: 812, amoonguss: 591, ursaluna: 901,
    scizor: 212, zapdos: 145, moltres: 146, suicune: 245,
    azumarill: 184, magnezone: 462, excadrill: 530, hawlucha: 701,
    cinderace: 815, urshifuRapidStrike: 892, urshifu: 892,
    ogerponWellspring: 1017, ogerponHearthflame: 1017,
    ogerponCornerstone: 1017, ogerpon: 1017,
  };
  return DEX_MAP[pokemonId] ?? 0;
}

// Simple heuristic for types based on common Pokemon
function estimateTypes(pokemonId: string): PokemonType[] {
  const TYPE_MAP: Record<string, PokemonType[]> = {
    greatTusk: ["Ground", "Fighting"], ironValiant: ["Fairy", "Fighting"],
    gholdengo: ["Steel", "Ghost"], dragapult: ["Dragon", "Ghost"],
    kingambit: ["Dark", "Steel"], landorusTherian: ["Ground", "Flying"],
    heatran: ["Fire", "Steel"], ironMoth: ["Fire", "Poison"],
    ironTreads: ["Ground", "Steel"], garganacl: ["Rock"],
    clodsire: ["Poison", "Ground"], toxapex: ["Poison", "Water"],
    gliscor: ["Ground", "Flying"], roaringMoon: ["Dragon", "Dark"],
    ironBundle: ["Ice", "Water"], volcarona: ["Bug", "Fire"],
    dragonite: ["Dragon", "Flying"], tyranitar: ["Rock", "Dark"],
    ferrothorn: ["Grass", "Steel"], clefable: ["Fairy"],
    garchomp: ["Dragon", "Ground"], skeledirge: ["Fire", "Ghost"],
    annihilape: ["Fighting", "Ghost"], corviknight: ["Flying", "Steel"],
    grimmsnarl: ["Dark", "Fairy"], pelipper: ["Water", "Flying"],
    weavile: ["Dark", "Ice"], breloom: ["Grass", "Fighting"],
    scizor: ["Bug", "Steel"], zapdos: ["Electric", "Flying"],
    excadrill: ["Ground", "Steel"], azumarill: ["Water", "Fairy"],
    magnezone: ["Electric", "Steel"], hawlucha: ["Fighting", "Flying"],
    slowking: ["Water", "Psychic"], rotomWash: ["Electric", "Water"],
  };
  return (TYPE_MAP[pokemonId] as PokemonType[]) ?? ["Normal"];
}

function formatPokemonName(id: string): string {
  // Convert camelCase to Title Case with spaces
  return id
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
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
          const displayName = p.pokemonName || formatPokemonName(p.pokemonId);
          const types = estimateTypes(p.pokemonId);
          const dexNum = estimateDexNum(p.pokemonId);

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
