"use client";

import {
  Shield,
  Swords,
  Zap,
  Gauge,
  TriangleAlert,
  Eraser,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TypeBadge } from "@/shared/components/type-badge";
import type { PokemonType } from "@/shared/types";
import type { CorePokemon, RoleDefinition } from "../hooks/use-guided-builder";

interface RoleSelectorProps {
  role: RoleDefinition;
  candidates: {
    pokemonId: string;
    pokemonName?: string;
    usagePercent: number;
    rank: number;
  }[];
  selected: CorePokemon | null;
  onSelect: (pokemon: CorePokemon | null) => void;
  disabledIds: Set<string>;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  shield: Shield,
  swords: Swords,
  zap: Zap,
  gauge: Gauge,
  "triangle-alert": TriangleAlert,
  eraser: Eraser,
};

// Heuristic type mapping for common Pokemon (shared with core-picker)
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
  return id
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

// Role-specific filtering: pick candidates that match the role
function filterForRole(
  candidates: RoleSelectorProps["candidates"],
  roleId: string,
  disabledIds: Set<string>
): RoleSelectorProps["candidates"] {
  const available = candidates.filter((c) => !disabledIds.has(c.pokemonId));

  // For role-based filtering, we use type heuristics
  // In production this would use actual base stats and movepools
  const roleTypeAffinity: Record<string, PokemonType[]> = {
    "physical-wall": ["Steel", "Ground", "Rock"],
    "special-wall": ["Fairy", "Water", "Psychic"],
    "physical-attacker": ["Fighting", "Ground", "Dragon"],
    "special-attacker": ["Fire", "Electric", "Psychic"],
    "speed-control": ["Electric", "Flying", "Dragon"],
    "hazard-setter": ["Ground", "Rock", "Steel"],
    "hazard-removal": ["Flying", "Normal", "Water"],
  };

  const preferred = roleTypeAffinity[roleId] ?? [];

  // Sort: preferred types first, then by usage
  const scored = available.map((c) => {
    const types = estimateTypes(c.pokemonId);
    const typeBonus = types.some((t) => preferred.includes(t)) ? 10 : 0;
    return { ...c, score: typeBonus + c.usagePercent };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 5);
}

export function RoleSelector({
  role,
  candidates,
  selected,
  onSelect,
  disabledIds,
}: RoleSelectorProps) {
  const Icon = ICON_MAP[role.icon] ?? Shield;
  const filtered = filterForRole(candidates, role.id, disabledIds);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {role.label}
          {selected && (
            <Badge variant="secondary" className="ml-auto text-xs font-normal">
              {selected.pokemonName}
            </Badge>
          )}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{role.description}</p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap gap-2">
          {filtered.map((c) => {
            const name = c.pokemonName || formatPokemonName(c.pokemonId);
            const types = estimateTypes(c.pokemonId);
            const isSelected = selected?.pokemonId === c.pokemonId;

            return (
              <button
                key={c.pokemonId}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all",
                  isSelected
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:border-primary/50 hover:bg-accent"
                )}
                onClick={() => onSelect(isSelected ? null : {
                  pokemonId: c.pokemonId,
                  pokemonName: name,
                  types,
                  usagePercent: c.usagePercent,
                })}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-bold uppercase">
                  {c.pokemonId.slice(0, 2)}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{name}</span>
                  <div className="flex gap-0.5">
                    {types.map((t) => (
                      <TypeBadge key={t} type={t} size="sm" />
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground py-2">
              No suitable candidates available. Try selecting fewer core Pokemon.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
