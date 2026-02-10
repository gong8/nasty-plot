"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  NATURE_DATA, TYPE_COLORS, STAT_LABELS, STAT_COLORS,
  MAX_TOTAL_EVS, MAX_SINGLE_EV,
  POKEMON_TYPES, NATURES, STATS,
  calculateAllStats, getTotalEvs,
  type NatureName, type PokemonSpecies, type PokemonType,
  type StatName, type StatsTable, type TeamSlotData,
} from "@nasty-plot/core";
import { PokemonSprite, TypeBadge } from "@nasty-plot/ui";
import { ItemCombobox } from "../item-combobox";

interface SimplifiedSetEditorProps {
  slot: Partial<TeamSlotData>;
  formatId: string;
  setInfo?: string; // e.g. "Most popular set, used by 45% of players"
  onUpdate: (updates: Partial<TeamSlotData>) => void;
}

export function SimplifiedSetEditor({
  slot,
  formatId,
  setInfo,
  onUpdate,
}: SimplifiedSetEditorProps) {
  const [showEvs, setShowEvs] = useState(false);

  const pokemonId = slot.pokemonId ?? "";

  // Fetch species data
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

  // Fetch learnset
  const { data: learnset = [] } = useQuery<string[]>({
    queryKey: ["learnset", pokemonId, formatId],
    queryFn: async () => {
      let url = `/api/pokemon/${pokemonId}/learnset`;
      if (formatId) url += `?format=${encodeURIComponent(formatId)}`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const json = await res.json();
      const moves = json.data ?? [];
      return moves.map((m: { name: string }) => m.name);
    },
    enabled: !!pokemonId,
  });

  const abilities = useMemo(() => {
    if (!speciesData?.abilities) return [];
    return Object.entries(speciesData.abilities).map(([slot, name]) => ({
      name,
      isHidden: slot === "H",
    }));
  }, [speciesData]);

  const evs = (slot.evs ?? { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }) as StatsTable;
  const ivs = (slot.ivs ?? { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }) as StatsTable;
  const nature = slot.nature ?? "Hardy";

  const evTotal = getTotalEvs(evs);
  const evRemaining = MAX_TOTAL_EVS - evTotal;

  const calculatedStats = useMemo(() => {
    if (!speciesData) return null;
    return calculateAllStats(speciesData.baseStats, ivs, evs, slot.level ?? 100, nature);
  }, [speciesData, ivs, evs, slot.level, nature]);

  const handleEvChange = useCallback(
    (stat: StatName, value: number) => {
      const currentOther = getTotalEvs(evs) - evs[stat];
      const maxForStat = Math.min(MAX_SINGLE_EV, MAX_TOTAL_EVS - currentOther);
      const clamped = Math.min(value, maxForStat);
      onUpdate({ evs: { ...evs, [stat]: clamped } as StatsTable });
    },
    [evs, onUpdate]
  );

  const handleIvChange = useCallback(
    (stat: StatName, value: number) => {
      const clamped = Math.max(0, Math.min(31, value));
      onUpdate({ ivs: { ...ivs, [stat]: clamped } as StatsTable });
    },
    [ivs, onUpdate]
  );

  const handleMoveChange = useCallback(
    (index: number, value: string) => {
      const newMoves = [...(slot.moves ?? [""])] as [string, string?, string?, string?];
      newMoves[index] = value || (index === 0 ? "" : undefined);
      onUpdate({ moves: newMoves });
    },
    [slot.moves, onUpdate]
  );

  const displayName = speciesData?.name ?? pokemonId;

  return (
    <div className="space-y-4">
      {/* Pokemon header */}
      <div className="flex items-center gap-3">
        {speciesData?.num ? (
          <PokemonSprite pokemonId={pokemonId} num={speciesData.num} size={40} />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-xs font-bold uppercase">
            {pokemonId.slice(0, 3)}
          </div>
        )}
        <div>
          <div className="font-semibold">{displayName}</div>
          <div className="flex gap-1 mt-0.5">
            {speciesData?.types?.map((t: PokemonType) => (
              <TypeBadge key={t} type={t} size="sm" />
            ))}
          </div>
        </div>
      </div>

      {/* Set info */}
      {setInfo && (
        <div className="flex items-start gap-2 rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{setInfo}</span>
        </div>
      )}

      {/* Ability */}
      <div className="space-y-1.5">
        <Label className="text-xs">Ability</Label>
        <Select
          value={slot.ability || ""}
          onValueChange={(v) => onUpdate({ ability: v })}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Select ability" />
          </SelectTrigger>
          <SelectContent>
            {abilities.map((a) => (
              <SelectItem key={a.name} value={a.name}>
                {a.name}
                {a.isHidden && (
                  <span className="text-muted-foreground ml-1">(Hidden)</span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Item */}
      <div className="space-y-1.5">
        <Label className="text-xs">Item</Label>
        <ItemCombobox
          value={slot.item || ""}
          onChange={(v) => onUpdate({ item: v })}
          formatId={formatId}
        />
      </div>

      {/* Nature */}
      <div className="space-y-1.5">
        <Label className="text-xs">Nature</Label>
        <Select
          value={nature}
          onValueChange={(v) => onUpdate({ nature: v as NatureName })}
        >
          <SelectTrigger className="h-9">
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
        <Label className="text-xs">Tera Type</Label>
        <div className="grid grid-cols-6 gap-1">
          {POKEMON_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => onUpdate({ teraType: t })}
              className={`rounded px-1 py-0.5 text-[10px] text-white font-medium transition-all ${
                slot.teraType === t
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
        <Label className="text-xs">Moves</Label>
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((i) => (
            <MoveInput
              key={i}
              index={i}
              value={slot.moves?.[i] ?? ""}
              learnset={learnset}
              onChange={(val) => handleMoveChange(i, val)}
            />
          ))}
        </div>
      </div>

      <Separator />

      {/* Calculated Stats (always visible) */}
      {calculatedStats && (
        <div className="space-y-1.5">
          <Label className="text-xs">Stats</Label>
          <div className="grid grid-cols-3 gap-1.5">
            {STATS.map((stat) => (
              <div key={stat} className="rounded-md border p-1.5 text-center">
                <div
                  className="text-[10px] font-medium"
                  style={{ color: STAT_COLORS[stat] }}
                >
                  {STAT_LABELS[stat]}
                </div>
                <div className="text-sm font-bold tabular-nums">
                  {calculatedStats[stat]}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EVs/IVs collapsible */}
      <button
        onClick={() => setShowEvs((prev) => !prev)}
        className="flex items-center gap-2 w-full text-left text-xs font-medium py-1.5 px-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
      >
        Customize EVs & IVs
        {showEvs ? (
          <ChevronUp className="h-3 w-3 ml-auto" />
        ) : (
          <ChevronDown className="h-3 w-3 ml-auto" />
        )}
        <span className="text-[10px] text-muted-foreground">
          {evTotal}/{MAX_TOTAL_EVS} EVs used
        </span>
      </button>

      {showEvs && (
        <div className="space-y-4 rounded-lg border p-3">
          {/* EVs */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">EVs</Label>
              <span
                className={`text-[10px] ${
                  evRemaining < 0
                    ? "text-destructive font-medium"
                    : "text-muted-foreground"
                }`}
              >
                {evTotal} / {MAX_TOTAL_EVS} ({evRemaining} remaining)
              </span>
            </div>
            {STATS.map((stat) => (
              <div key={stat} className="space-y-0.5">
                <div className="flex items-center justify-between">
                  <span
                    className="text-[10px] font-medium"
                    style={{ color: STAT_COLORS[stat] }}
                  >
                    {STAT_LABELS[stat]}
                  </span>
                  <span className="text-[10px] tabular-nums">{evs[stat]}</span>
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
          <div className="space-y-2">
            <Label className="text-xs">IVs</Label>
            <div className="grid grid-cols-3 gap-2">
              {STATS.map((stat) => (
                <div key={stat} className="space-y-0.5">
                  <span
                    className="text-[10px] font-medium"
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
                    className="h-7 text-center text-xs"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Move Input with autocomplete ---

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
          setTimeout(() => setOpen(false), 150);
        }}
        className="h-8 text-sm"
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
