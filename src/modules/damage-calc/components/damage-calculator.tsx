"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, Swords, Shield, Zap } from "lucide-react";
import { useDamageCalc } from "../hooks/use-damage-calc";
import { POKEMON_TYPES, NATURES, STATS, type PokemonType, type NatureName, type StatsTable, type DamageCalcInput } from "@/shared/types";
import { STAT_LABELS, STAT_COLORS, TYPE_COLORS, MAX_SINGLE_EV } from "@/shared/constants";
import { cn } from "@/lib/utils";

interface PokemonConfig {
  pokemonId: string;
  level: number;
  ability: string;
  item: string;
  nature: NatureName;
  evs: StatsTable;
  ivs: StatsTable;
  boosts: StatsTable;
  teraType: PokemonType | "";
  status: string;
}

const DEFAULT_CONFIG: PokemonConfig = {
  pokemonId: "",
  level: 100,
  ability: "",
  item: "",
  nature: "Hardy",
  evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
  ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
  boosts: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
  teraType: "",
  status: "",
};

const WEATHERS = ["None", "Sun", "Rain", "Sand", "Snow", "Harsh Sunshine", "Heavy Rain", "Strong Winds"];
const TERRAINS = ["None", "Electric", "Grassy", "Misty", "Psychic"];
const STATUSES = ["None", "Healthy", "Burned", "Paralyzed", "Poisoned", "Badly Poisoned", "Asleep", "Frozen"];
const BOOST_VALUES = [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6];

function PokemonPanel({
  label,
  config,
  onChange,
}: {
  label: string;
  config: PokemonConfig;
  onChange: (config: PokemonConfig) => void;
}) {
  const updateField = <K extends keyof PokemonConfig>(key: K, value: PokemonConfig[K]) => {
    onChange({ ...config, [key]: value });
  };

  const updateEv = (stat: keyof StatsTable, value: number) => {
    onChange({ ...config, evs: { ...config.evs, [stat]: value } });
  };

  const updateIv = (stat: keyof StatsTable, value: number) => {
    onChange({ ...config, ivs: { ...config.ivs, [stat]: value } });
  };

  const updateBoost = (stat: keyof StatsTable, value: number) => {
    onChange({ ...config, boosts: { ...config.boosts, [stat]: value } });
  };

  const totalEvs = Object.values(config.evs).reduce((a, b) => a + b, 0);

  return (
    <Card className="flex-1">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          {label === "Attacker" ? <Swords className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pokemon Name */}
        <div className="space-y-1.5">
          <Label className="text-xs">Pokemon</Label>
          <Input
            placeholder="e.g. Great Tusk"
            value={config.pokemonId}
            onChange={(e) => updateField("pokemonId", e.target.value)}
          />
        </div>

        {/* Level */}
        <div className="space-y-1.5">
          <Label className="text-xs">Level</Label>
          <Input
            type="number"
            min={1}
            max={100}
            value={config.level}
            onChange={(e) => updateField("level", parseInt(e.target.value) || 100)}
            className="w-20"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          {/* Ability */}
          <div className="space-y-1.5">
            <Label className="text-xs">Ability</Label>
            <Input
              placeholder="Ability"
              value={config.ability}
              onChange={(e) => updateField("ability", e.target.value)}
            />
          </div>

          {/* Item */}
          <div className="space-y-1.5">
            <Label className="text-xs">Item</Label>
            <Input
              placeholder="Item"
              value={config.item}
              onChange={(e) => updateField("item", e.target.value)}
            />
          </div>
        </div>

        {/* Nature */}
        <div className="space-y-1.5">
          <Label className="text-xs">Nature</Label>
          <Select value={config.nature} onValueChange={(v) => updateField("nature", v as NatureName)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NATURES.map((n) => (
                <SelectItem key={n} value={n} className="text-xs">
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tera Type */}
        <div className="space-y-1.5">
          <Label className="text-xs">Tera Type</Label>
          <Select value={config.teraType || "none"} onValueChange={(v) => updateField("teraType", v === "none" ? "" : v as PokemonType)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className="text-xs">None</SelectItem>
              {POKEMON_TYPES.map((t) => (
                <SelectItem key={t} value={t} className="text-xs">
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status */}
        <div className="space-y-1.5">
          <Label className="text-xs">Status</Label>
          <Select value={config.status || "None"} onValueChange={(v) => updateField("status", v === "None" ? "" : v)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="text-xs">
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* EVs */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">EVs</Label>
            <span className={cn("text-xs", totalEvs > 510 ? "text-red-500" : "text-muted-foreground")}>
              {totalEvs}/510
            </span>
          </div>
          {STATS.map((stat) => (
            <div key={stat} className="flex items-center gap-2">
              <span className="w-8 text-xs font-medium" style={{ color: STAT_COLORS[stat] }}>
                {STAT_LABELS[stat]}
              </span>
              <Slider
                min={0}
                max={MAX_SINGLE_EV}
                step={4}
                value={[config.evs[stat]]}
                onValueChange={([v]) => updateEv(stat, v)}
                className="flex-1"
              />
              <Input
                type="number"
                min={0}
                max={252}
                value={config.evs[stat]}
                onChange={(e) => updateEv(stat, Math.min(252, Math.max(0, parseInt(e.target.value) || 0)))}
                className="w-14 h-7 text-xs text-center"
              />
            </div>
          ))}
        </div>

        <Separator />

        {/* Boosts */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Stat Boosts</Label>
          <div className="grid grid-cols-3 gap-1.5">
            {(["atk", "def", "spa", "spd", "spe"] as const).map((stat) => (
              <div key={stat} className="flex items-center gap-1">
                <span className="text-[10px] w-6" style={{ color: STAT_COLORS[stat] }}>
                  {STAT_LABELS[stat]}
                </span>
                <Select
                  value={String(config.boosts[stat])}
                  onValueChange={(v) => updateBoost(stat, parseInt(v))}
                >
                  <SelectTrigger className="h-6 text-[10px] px-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BOOST_VALUES.map((b) => (
                      <SelectItem key={b} value={String(b)} className="text-xs">
                        {b > 0 ? `+${b}` : b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function DamageCalculator() {
  const [attacker, setAttacker] = useState<PokemonConfig>({ ...DEFAULT_CONFIG });
  const [defender, setDefender] = useState<PokemonConfig>({ ...DEFAULT_CONFIG });
  const [moveName, setMoveName] = useState("");
  const [weather, setWeather] = useState("None");
  const [terrain, setTerrain] = useState("None");
  const [isReflect, setIsReflect] = useState(false);
  const [isLightScreen, setIsLightScreen] = useState(false);
  const [isAuroraVeil, setIsAuroraVeil] = useState(false);
  const [isCritical, setIsCritical] = useState(false);
  const [isDoubles, setIsDoubles] = useState(false);

  const { mutate: calculate, data: result, isPending, error } = useDamageCalc();

  const handleCalculate = useCallback(() => {
    if (!attacker.pokemonId || !defender.pokemonId || !moveName) return;

    const input: DamageCalcInput = {
      attacker: {
        pokemonId: attacker.pokemonId,
        level: attacker.level,
        ability: attacker.ability || undefined,
        item: attacker.item || undefined,
        nature: attacker.nature,
        evs: attacker.evs,
        ivs: attacker.ivs,
        boosts: attacker.boosts,
        teraType: attacker.teraType || undefined,
        status: attacker.status || undefined,
      },
      defender: {
        pokemonId: defender.pokemonId,
        level: defender.level,
        ability: defender.ability || undefined,
        item: defender.item || undefined,
        nature: defender.nature,
        evs: defender.evs,
        ivs: defender.ivs,
        boosts: defender.boosts,
        teraType: defender.teraType || undefined,
        status: defender.status || undefined,
      },
      move: moveName,
      field: {
        weather: weather !== "None" ? weather : undefined,
        terrain: terrain !== "None" ? terrain : undefined,
        isReflect,
        isLightScreen,
        isAuroraVeil,
        isCritical,
        isDoubles,
      },
    };

    calculate(input);
  }, [attacker, defender, moveName, weather, terrain, isReflect, isLightScreen, isAuroraVeil, isCritical, isDoubles, calculate]);

  const getKoColor = (koChance: string) => {
    if (koChance.includes("OHKO")) return "text-red-500";
    if (koChance.includes("2HKO")) return "text-orange-500";
    if (koChance.includes("3HKO")) return "text-yellow-500";
    return "text-muted-foreground";
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Attacker Panel */}
        <PokemonPanel label="Attacker" config={attacker} onChange={setAttacker} />

        {/* Center: Move + Field + Results */}
        <div className="flex flex-col gap-4 lg:w-80">
          {/* Move Selection */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Zap className="h-4 w-4" />
                Move
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="e.g. Earthquake"
                value={moveName}
                onChange={(e) => setMoveName(e.target.value)}
              />

              <Separator />

              {/* Field Conditions */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Field Conditions</Label>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px]">Weather</Label>
                    <Select value={weather} onValueChange={setWeather}>
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {WEATHERS.map((w) => (
                          <SelectItem key={w} value={w} className="text-xs">{w}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px]">Terrain</Label>
                    <Select value={terrain} onValueChange={setTerrain}>
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TERRAINS.map((t) => (
                          <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px]">Reflect</Label>
                    <Switch checked={isReflect} onCheckedChange={setIsReflect} className="scale-75" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px]">Light Screen</Label>
                    <Switch checked={isLightScreen} onCheckedChange={setIsLightScreen} className="scale-75" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px]">Aurora Veil</Label>
                    <Switch checked={isAuroraVeil} onCheckedChange={setIsAuroraVeil} className="scale-75" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px]">Critical Hit</Label>
                    <Switch checked={isCritical} onCheckedChange={setIsCritical} className="scale-75" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px]">Doubles</Label>
                    <Switch checked={isDoubles} onCheckedChange={setIsDoubles} className="scale-75" />
                  </div>
                </div>
              </div>

              <Button
                onClick={handleCalculate}
                disabled={!attacker.pokemonId || !defender.pokemonId || !moveName || isPending}
                className="w-full"
                size="sm"
              >
                {isPending ? "Calculating..." : "Calculate"}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>

          {/* Results */}
          {result && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Result</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Damage Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>{result.moveName}</span>
                    <span className="font-mono">
                      {result.minPercent}% - {result.maxPercent}%
                    </span>
                  </div>
                  <div className="relative">
                    <Progress value={Math.min(result.maxPercent, 100)} className="h-4" />
                    <div
                      className="absolute top-0 left-0 h-4 bg-red-500/30 rounded-full"
                      style={{ width: `${Math.min(result.minPercent, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Damage Values */}
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {result.minDamage} - {result.maxDamage} HP
                  </span>
                </div>

                {/* KO Chance */}
                <div className={cn("text-sm font-semibold text-center py-1", getKoColor(result.koChance))}>
                  {result.koChance}
                </div>

                {/* Full Description */}
                <p className="text-[11px] text-muted-foreground leading-relaxed border-t pt-2">
                  {result.description}
                </p>
              </CardContent>
            </Card>
          )}

          {error && (
            <Card className="border-destructive">
              <CardContent className="pt-4">
                <p className="text-sm text-destructive">
                  {error instanceof Error ? error.message : "Calculation error"}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Defender Panel */}
        <PokemonPanel label="Defender" config={defender} onChange={setDefender} />
      </div>
    </div>
  );
}
