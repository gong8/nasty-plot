"use client"

import { useState, useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { ArrowRight, Swords, Shield, Zap } from "lucide-react"
import { cn, PokemonSprite, SearchCombobox, MoveSelector, EvEditor } from "@nasty-plot/ui"
import { NatureSelector } from "@/features/team-builder/components/shared/nature-selector"
import { TeraTypePicker } from "@/features/team-builder/components/shared/tera-type-picker"
import { useDamageCalc } from "../hooks/use-damage-calc"
import {
  STAT_LABELS,
  STAT_COLORS,
  DEFAULT_LEVEL,
  DEFAULT_EVS,
  DEFAULT_IVS,
  WEATHERS,
  TERRAINS,
  STATUSES,
  BOOST_VALUES,
  type PokemonType,
  type NatureName,
  type StatsTable,
  type DamageCalcInput,
  type PaginatedResponse,
  type PokemonSpecies,
  type MoveData,
  type ItemData,
} from "@nasty-plot/core"
import { fetchJson, fetchApiData } from "@/lib/api-client"

interface PokemonConfig {
  pokemonId: string
  pokemonName: string
  level: number
  ability: string
  item: string
  nature: NatureName
  evs: StatsTable
  ivs: StatsTable
  boosts: StatsTable
  teraType: PokemonType | ""
  status: string
}

const DEFAULT_CONFIG: PokemonConfig = {
  pokemonId: "",
  pokemonName: "",
  level: DEFAULT_LEVEL,
  ability: "",
  item: "",
  nature: "Hardy",
  evs: { ...DEFAULT_EVS },
  ivs: { ...DEFAULT_IVS },
  boosts: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
  teraType: "",
  status: "",
}

function toCalcPokemon(config: PokemonConfig): DamageCalcInput["attacker"] {
  return {
    pokemonId: config.pokemonId,
    level: config.level,
    ability: config.ability || undefined,
    item: config.item || undefined,
    nature: config.nature,
    evs: config.evs,
    ivs: config.ivs,
    boosts: config.boosts,
    teraType: config.teraType || undefined,
    status: config.status || undefined,
  }
}

function getKoColor(koChance: string): string {
  if (koChance.includes("OHKO")) return "text-red-600 dark:text-red-400"
  if (koChance.includes("2HKO")) return "text-orange-600 dark:text-orange-400"
  if (koChance.includes("3HKO")) return "text-yellow-600 dark:text-yellow-400"
  if (koChance.includes("4HKO")) return "text-green-600 dark:text-green-400"
  return "text-muted-foreground"
}

// --- Combobox sub-components ---

function PokemonCombobox({
  value,
  displayName,
  onSelect,
}: {
  value: string
  displayName: string
  onSelect: (id: string, name: string, species: PokemonSpecies) => void
}) {
  const fetchPokemon = useCallback(
    async (query: string): Promise<(PokemonSpecies & { id: string })[]> => {
      try {
        const json = await fetchJson<PaginatedResponse<PokemonSpecies>>(
          `/api/pokemon?search=${encodeURIComponent(query)}&pageSize=15`,
        )
        return json.data
      } catch {
        return []
      }
    },
    [],
  )

  return (
    <SearchCombobox<PokemonSpecies & { id: string }>
      value={value ? displayName : ""}
      placeholder="Search Pokemon..."
      fetchResults={fetchPokemon}
      onSelect={(pokemon) => onSelect(pokemon.id, pokemon.name, pokemon)}
      renderValue={
        value
          ? () => (
              <span className="flex items-center gap-1.5 truncate">
                <PokemonSprite pokemonId={value} size={20} />
                {displayName}
              </span>
            )
          : undefined
      }
      renderItem={(pokemon) => (
        <>
          <PokemonSprite pokemonId={pokemon.id} size={24} className="mr-1.5" />
          <span>{pokemon.name}</span>
          <Badge variant="secondary" className="ml-auto text-[10px]">
            {pokemon.types.join("/")}
          </Badge>
        </>
      )}
      popoverWidth="w-[240px]"
      emptyMessage="No Pokemon found."
    />
  )
}

function CalcMoveSelector({
  value,
  pokemonId,
  onSelect,
}: {
  value: string
  pokemonId: string
  onSelect: (moveName: string) => void
}) {
  const { data: moves = [] } = useQuery({
    queryKey: ["pokemon-learnset-calc", pokemonId],
    queryFn: async () => {
      try {
        return await fetchApiData<MoveData[]>(
          `/api/pokemon/${encodeURIComponent(pokemonId)}/learnset`,
        )
      } catch {
        return []
      }
    },
    enabled: !!pokemonId,
    staleTime: 5 * 60 * 1000,
  })

  return (
    <MoveSelector
      value={value}
      onSelect={onSelect}
      moves={moves}
      placeholder={pokemonId ? "Search move..." : "Select a Pokemon first"}
      disabled={!pokemonId}
      showMetadata={true}
      compact={true}
    />
  )
}

function CalcItemCombobox({
  value,
  onSelect,
}: {
  value: string
  onSelect: (itemName: string) => void
}) {
  const fetchItems = useCallback(async (query: string): Promise<(ItemData & { id: string })[]> => {
    try {
      const json = await fetchJson<PaginatedResponse<ItemData>>(
        `/api/items?search=${encodeURIComponent(query)}&pageSize=20`,
      )
      return json.data
    } catch {
      return []
    }
  }, [])

  return (
    <SearchCombobox<ItemData & { id: string }>
      value={value}
      placeholder="Item"
      fetchResults={fetchItems}
      onSelect={(item) => onSelect(item.name)}
      renderItem={(item) => <>{item.name}</>}
      popoverWidth="w-[220px]"
      emptyMessage="No items found."
    />
  )
}

// --- Pokemon Panel ---

function PokemonPanel({
  label,
  config,
  onChange,
}: {
  label: string
  config: PokemonConfig
  onChange: (config: PokemonConfig) => void
}) {
  const [abilities, setAbilities] = useState<string[]>([])

  const updateField = <K extends keyof PokemonConfig>(key: K, value: PokemonConfig[K]) => {
    onChange({ ...config, [key]: value })
  }

  const updateEv = (stat: keyof StatsTable, value: number) => {
    onChange({ ...config, evs: { ...config.evs, [stat]: value } })
  }

  const updateBoost = (stat: keyof StatsTable, value: number) => {
    onChange({ ...config, boosts: { ...config.boosts, [stat]: value } })
  }

  const handlePokemonSelect = (id: string, name: string, species: PokemonSpecies) => {
    const abilityList = Object.values(species.abilities)
    setAbilities(abilityList)
    onChange({
      ...config,
      pokemonId: id,
      pokemonName: name,
      ability: abilityList[0] ?? "",
    })
  }

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
          <PokemonCombobox
            value={config.pokemonId}
            displayName={config.pokemonName}
            onSelect={handlePokemonSelect}
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
            {abilities.length > 0 ? (
              <Select value={config.ability} onValueChange={(v) => updateField("ability", v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Ability" />
                </SelectTrigger>
                <SelectContent>
                  {abilities.map((a) => (
                    <SelectItem key={a} value={a} className="text-xs">
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                placeholder="Select a Pokemon first"
                value={config.ability}
                onChange={(e) => updateField("ability", e.target.value)}
                disabled={!config.pokemonId}
                className="h-8 text-xs"
              />
            )}
          </div>

          {/* Item */}
          <div className="space-y-1.5">
            <Label className="text-xs">Item</Label>
            <CalcItemCombobox value={config.item} onSelect={(name) => updateField("item", name)} />
          </div>
        </div>

        {/* Nature */}
        <div className="space-y-1.5">
          <Label className="text-xs">Nature</Label>
          <NatureSelector
            value={config.nature}
            onChange={(v) => updateField("nature", v)}
            triggerClassName="w-full h-8 text-xs"
          />
        </div>

        {/* Tera Type */}
        <div className="space-y-1.5">
          <Label className="text-xs">Tera Type</Label>
          <TeraTypePicker
            value={config.teraType || undefined}
            onChange={(v) => updateField("teraType", v)}
          />
        </div>

        {/* Status */}
        <div className="space-y-1.5">
          <Label className="text-xs">Status</Label>
          <Select
            value={config.status || "None"}
            onValueChange={(v) => updateField("status", v === "None" ? "" : v)}
          >
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
        <EvEditor evs={config.evs} onChange={updateEv} showRemaining />

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
  )
}

export function DamageCalculator() {
  const [attacker, setAttackerRaw] = useState<PokemonConfig>({ ...DEFAULT_CONFIG })
  const [defender, setDefender] = useState<PokemonConfig>({ ...DEFAULT_CONFIG })
  const [moveName, setMoveName] = useState("")
  const [weather, setWeather] = useState("None")
  const [terrain, setTerrain] = useState("None")
  const [fieldToggles, setFieldToggles] = useState({
    isReflect: false,
    isLightScreen: false,
    isAuroraVeil: false,
    isCritical: false,
    isDoubles: false,
  })

  const { mutate: calculate, data: result, isPending, error } = useDamageCalc()

  // Clear the selected move when the attacker Pokemon changes
  const setAttacker = useCallback((newConfig: PokemonConfig) => {
    setAttackerRaw((prev) => {
      if (prev.pokemonId !== newConfig.pokemonId) {
        setMoveName("")
      }
      return newConfig
    })
  }, [])

  const handleCalculate = useCallback(() => {
    if (!attacker.pokemonId || !defender.pokemonId || !moveName) return

    calculate({
      attacker: toCalcPokemon(attacker),
      defender: toCalcPokemon(defender),
      move: moveName,
      field: {
        weather: weather !== "None" ? weather : undefined,
        terrain: terrain !== "None" ? terrain : undefined,
        ...fieldToggles,
      },
    })
  }, [attacker, defender, moveName, weather, terrain, fieldToggles, calculate])

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
              <CalcMoveSelector
                value={moveName}
                pokemonId={attacker.pokemonId}
                onSelect={setMoveName}
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
                          <SelectItem key={w} value={w} className="text-xs">
                            {w}
                          </SelectItem>
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
                          <SelectItem key={t} value={t} className="text-xs">
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  {(
                    [
                      ["isReflect", "Reflect"],
                      ["isLightScreen", "Light Screen"],
                      ["isAuroraVeil", "Aurora Veil"],
                      ["isCritical", "Critical Hit"],
                      ["isDoubles", "Doubles"],
                    ] as const
                  ).map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between">
                      <Label className="text-[10px]">{label}</Label>
                      <Switch
                        checked={fieldToggles[key]}
                        onCheckedChange={(checked) =>
                          setFieldToggles((prev) => ({ ...prev, [key]: checked }))
                        }
                        className="scale-75"
                      />
                    </div>
                  ))}
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
                <div
                  className={cn(
                    "text-sm font-semibold text-center py-1",
                    getKoColor(result.koChance),
                  )}
                >
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
  )
}
