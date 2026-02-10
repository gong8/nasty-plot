"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TYPE_COLORS, type PokemonSpecies, type PokemonType } from "@nasty-plot/core";

interface PokemonSearchPanelProps {
  onSelect: (pokemon: PokemonSpecies) => void;
}

export function PokemonSearchPanel({ onSelect }: PokemonSearchPanelProps) {
  const [search, setSearch] = useState("");

  const { data: results = [], isLoading } = useQuery<PokemonSpecies[]>({
    queryKey: ["pokemon-search", search],
    queryFn: async () => {
      if (!search || search.length < 2) return [];
      const res = await fetch(`/api/pokemon?search=${encodeURIComponent(search)}`);
      if (!res.ok) return [];
      const json = await res.json();
      return json.data ?? [];
    },
    enabled: search.length >= 2,
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search Pokemon..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>
      <ScrollArea className="h-[300px]">
        {isLoading && (
          <p className="text-sm text-muted-foreground p-4 text-center">
            Searching...
          </p>
        )}
        {!isLoading && search.length >= 2 && results.length === 0 && (
          <p className="text-sm text-muted-foreground p-4 text-center">
            No Pokemon found
          </p>
        )}
        <div className="flex flex-col gap-1">
          {results.map((pokemon) => {
            const bst = Object.values(pokemon.baseStats).reduce(
              (a, b) => a + b,
              0
            );
            return (
              <button
                key={pokemon.id}
                onClick={() => onSelect(pokemon)}
                className="flex items-center gap-3 rounded-md p-2 text-left hover:bg-accent transition-colors w-full"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded bg-muted text-[10px] font-bold uppercase shrink-0">
                  {pokemon.id.slice(0, 3)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {pokemon.name}
                  </div>
                  <div className="flex gap-1 mt-0.5">
                    {pokemon.types.map((t: PokemonType) => (
                      <Badge
                        key={t}
                        className="text-[9px] px-1 py-0 text-white"
                        style={{ backgroundColor: TYPE_COLORS[t] }}
                      >
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  BST {bst}
                </span>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
