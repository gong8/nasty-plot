"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  NATURE_DATA,
  TYPE_COLORS,
  STAT_LABELS,
  STAT_COLORS,
  MAX_TOTAL_EVS,
  MAX_SINGLE_EV,
} from "@/shared/constants";
import { calculateAllStats, getTotalEvs } from "@/shared/lib/stat-calc";
import type {
  NatureName,
  PokemonSpecies,
  PokemonType,
  StatName,
  StatsTable,
  TeamSlotData,
  TeamSlotInput,
} from "@/shared/types";
import { POKEMON_TYPES, NATURES, STATS } from "@/shared/types";
import { PokemonSearchPanel } from "./pokemon-search-panel";

interface SlotEditorProps {
  slot: TeamSlotData | null;
  teamId: string;
  nextPosition: number;
  onSave: (data: TeamSlotInput) => void;
  onRemove: () => void;
  isNew?: boolean;
}

export function SlotEditor({
  slot,
  teamId,
  nextPosition,
  onSave,
  onRemove,
  isNew = false,
}: SlotEditorProps) {
  const [pokemonId, setPokemonId] = useState(slot?.pokemonId ?? "");
  const [ability, setAbility] = useState(slot?.ability ?? "");
  const [item, setItem] = useState(slot?.item ?? "");
  const [nature, setNature] = useState<NatureName>(slot?.nature ?? "Hardy");
  const [teraType, setTeraType] = useState<PokemonType | undefined>(
    slot?.teraType
  );
  const [level, setLevel] = useState(slot?.level ?? 100);
  const [moves, setMoves] = useState<[string, string?, string?, string?]>(
    slot?.moves ?? ["", undefined, undefined, undefined]
  );
  const [evs, setEvs] = useState<StatsTable>(
    slot?.evs ?? { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }
  );
  const [ivs, setIvs] = useState<StatsTable>(
    slot?.ivs ?? { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }
  );

  // Reset form when slot changes
  useEffect(() => {
    setPokemonId(slot?.pokemonId ?? "");
    setAbility(slot?.ability ?? "");
    setItem(slot?.item ?? "");
    setNature(slot?.nature ?? "Hardy");
    setTeraType(slot?.teraType);
    setLevel(slot?.level ?? 100);
    setMoves(slot?.moves ?? ["", undefined, undefined, undefined]);
    setEvs(
      slot?.evs ?? { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }
    );
    setIvs(
      slot?.ivs ?? { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }
    );
  }, [slot]);

  // Fetch pokemon species data for the selected pokemonId
  const { data: speciesData } = useQuery<PokemonSpecies>({
    queryKey: ["pokemon", pokemonId],
    queryFn: async () => {
      const res = await fetch(`/api/pokemon/${pokemonId}`);
      if (!res.ok) throw new Error("Not found");
      const json = await res.json();
      return json.data;
    },
    enabled: !!pokemonId,
  });

  // Fetch learnset for move search
  const { data: learnset = [] } = useQuery<string[]>({
    queryKey: ["learnset", pokemonId],
    queryFn: async () => {
      const res = await fetch(`/api/pokemon/${pokemonId}/learnset`);
      if (!res.ok) return [];
      const json = await res.json();
      const moves = json.data ?? [];
      return moves.map((m: { name: string }) => m.name);
    },
    enabled: !!pokemonId,
  });

  const abilities = useMemo(() => {
    if (!speciesData?.abilities) return [];
    return Object.values(speciesData.abilities);
  }, [speciesData]);

  // Calculated stats
  const calculatedStats = useMemo(() => {
    if (!speciesData) return null;
    return calculateAllStats(speciesData.baseStats, ivs, evs, level, nature);
  }, [speciesData, ivs, evs, level, nature]);

  const evTotal = getTotalEvs(evs);
  const evRemaining = MAX_TOTAL_EVS - evTotal;

  const handleEvChange = useCallback(
    (stat: StatName, value: number) => {
      setEvs((prev) => {
        const currentOther = getTotalEvs(prev) - prev[stat];
        const maxForStat = Math.min(MAX_SINGLE_EV, MAX_TOTAL_EVS - currentOther);
        const clamped = Math.min(value, maxForStat);
        return { ...prev, [stat]: clamped };
      });
    },
    []
  );

  const handleIvChange = useCallback((stat: StatName, value: number) => {
    const clamped = Math.max(0, Math.min(31, value));
    setIvs((prev) => ({ ...prev, [stat]: clamped }));
  }, []);

  const handleMoveChange = useCallback(
    (index: number, value: string) => {
      setMoves((prev) => {
        const next = [...prev] as [string, string?, string?, string?];
        next[index] = value || (index === 0 ? "" : undefined);
        return next;
      });
    },
    []
  );

  const handlePokemonSelect = useCallback((pokemon: PokemonSpecies) => {
    setPokemonId(pokemon.id);
    // Reset slot-specific data when changing Pokemon
    const firstAbility = Object.values(pokemon.abilities)[0] ?? "";
    setAbility(firstAbility);
    setMoves(["", undefined, undefined, undefined]);
    setTeraType(pokemon.types[0]);
  }, []);

  const handleSave = () => {
    onSave({
      position: slot?.position ?? nextPosition,
      pokemonId,
      ability,
      item,
      nature,
      teraType,
      level,
      moves,
      evs,
      ivs,
    });
  };

  // If no pokemon selected, show search
  if (!pokemonId) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <h3 className="font-semibold text-lg">Select a Pokemon</h3>
        <PokemonSearchPanel onSelect={handlePokemonSelect} />
      </div>
    );
  }

  const natureData = NATURE_DATA[nature];

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-5 p-4">
        {/* Pokemon Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-xs font-bold uppercase">
              {pokemonId.slice(0, 3)}
            </div>
            <div>
              <div className="font-semibold">
                {speciesData?.name ?? pokemonId}
              </div>
              <div className="flex gap-1 mt-0.5">
                {speciesData?.types?.map((t: PokemonType) => (
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
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setPokemonId("");
            }}
          >
            Change
          </Button>
        </div>

        <Separator />

        {/* Ability */}
        <div className="space-y-1.5">
          <Label>Ability</Label>
          <Select value={ability} onValueChange={setAbility}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select ability" />
            </SelectTrigger>
            <SelectContent>
              {abilities.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
              {abilities.length === 0 && (
                <SelectItem value={ability || "none"} disabled>
                  No abilities loaded
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Item */}
        <div className="space-y-1.5">
          <Label>Item</Label>
          <Input
            placeholder="e.g. Leftovers"
            value={item}
            onChange={(e) => setItem(e.target.value)}
          />
        </div>

        {/* Nature */}
        <div className="space-y-1.5">
          <Label>Nature</Label>
          <Select value={nature} onValueChange={(v) => setNature(v as NatureName)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NATURES.map((n) => {
                const nd = NATURE_DATA[n];
                const label = nd.plus
                  ? `${n} (+${STAT_LABELS[nd.plus]}/-${STAT_LABELS[nd.minus!]})`
                  : `${n} (Neutral)`;
                return (
                  <SelectItem key={n} value={n}>
                    {label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Tera Type */}
        <div className="space-y-1.5">
          <Label>Tera Type</Label>
          <div className="grid grid-cols-6 gap-1">
            {POKEMON_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setTeraType(t)}
                className={`rounded px-1 py-0.5 text-[10px] text-white font-medium transition-all ${
                  teraType === t
                    ? "ring-2 ring-offset-1 ring-primary scale-105"
                    : "opacity-70 hover:opacity-100"
                }`}
                style={{ backgroundColor: TYPE_COLORS[t] }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Moves */}
        <div className="space-y-1.5">
          <Label>Moves</Label>
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3].map((i) => (
              <MoveInput
                key={i}
                index={i}
                value={moves[i] ?? ""}
                learnset={learnset}
                onChange={(val) => handleMoveChange(i, val)}
              />
            ))}
          </div>
        </div>

        <Separator />

        {/* EVs */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>EVs</Label>
            <span
              className={`text-xs ${
                evRemaining < 0
                  ? "text-destructive font-medium"
                  : "text-muted-foreground"
              }`}
            >
              {evTotal} / {MAX_TOTAL_EVS} ({evRemaining} remaining)
            </span>
          </div>
          {STATS.map((stat) => (
            <div key={stat} className="space-y-1">
              <div className="flex items-center justify-between">
                <span
                  className="text-xs font-medium"
                  style={{ color: STAT_COLORS[stat] }}
                >
                  {STAT_LABELS[stat]}
                </span>
                <span className="text-xs tabular-nums">{evs[stat]}</span>
              </div>
              <Slider
                min={0}
                max={MAX_SINGLE_EV}
                step={4}
                value={[evs[stat]]}
                onValueChange={([v]) => handleEvChange(stat, v)}
              />
            </div>
          ))}
        </div>

        <Separator />

        {/* IVs */}
        <div className="space-y-3">
          <Label>IVs</Label>
          <div className="grid grid-cols-3 gap-2">
            {STATS.map((stat) => (
              <div key={stat} className="space-y-1">
                <span
                  className="text-xs font-medium"
                  style={{ color: STAT_COLORS[stat] }}
                >
                  {STAT_LABELS[stat]}
                </span>
                <Input
                  type="number"
                  min={0}
                  max={31}
                  value={ivs[stat]}
                  onChange={(e) =>
                    handleIvChange(stat, parseInt(e.target.value, 10) || 0)
                  }
                  className="h-8 text-center"
                />
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Calculated Stats */}
        {calculatedStats && (
          <div className="space-y-2">
            <Label>Calculated Stats</Label>
            <div className="grid grid-cols-3 gap-2">
              {STATS.map((stat) => (
                <div
                  key={stat}
                  className="rounded-md border p-2 text-center"
                >
                  <div
                    className="text-xs font-medium"
                    style={{ color: STAT_COLORS[stat] }}
                  >
                    {STAT_LABELS[stat]}
                  </div>
                  <div className="text-lg font-bold tabular-nums">
                    {calculatedStats[stat]}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <Separator />

        {/* Actions */}
        <div className="flex gap-2">
          <Button className="flex-1" onClick={handleSave}>
            {isNew ? "Add to Team" : "Save Changes"}
          </Button>
          {!isNew && (
            <Button variant="destructive" size="icon" onClick={onRemove}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </ScrollArea>
  );
}

// --- Move Input with simple filtering ---

function MoveInput({
  index,
  value,
  learnset,
  onChange,
}: {
  index: number;
  value: string;
  learnset: string[];
  onChange: (val: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!search) return learnset.slice(0, 20);
    const lower = search.toLowerCase();
    return learnset.filter((m) => m.toLowerCase().includes(lower)).slice(0, 20);
  }, [search, learnset]);

  return (
    <div className="relative">
      <Input
        placeholder={`Move ${index + 1}`}
        value={open ? search : value}
        onChange={(e) => {
          setSearch(e.target.value);
          if (!open) setOpen(true);
        }}
        onFocus={() => {
          setSearch(value);
          setOpen(true);
        }}
        onBlur={() => {
          // Delay to allow click
          setTimeout(() => setOpen(false), 150);
        }}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-[150px] overflow-y-auto">
          {filtered.map((move) => (
            <button
              key={move}
              className="w-full px-3 py-1.5 text-sm text-left hover:bg-accent transition-colors"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(move);
                setSearch(move);
                setOpen(false);
              }}
            >
              {move}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
