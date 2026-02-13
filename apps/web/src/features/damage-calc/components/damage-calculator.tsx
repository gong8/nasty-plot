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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { ArrowRight, Swords, Shield, Zap, ChevronsUpDown } from "lucide-react"
import { cn, PokemonSprite } from "@nasty-plot/ui"
import { useDamageCalc } from "../hooks/use-damage-calc"
import {
  POKEMON_TYPES,
  NATURES,
  STATS,
  STAT_LABELS,
  STAT_COLORS,
  MAX_SINGLE_EV,
  MAX_TOTAL_EVS,
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

const MOVE_CATEGORY_COLORS: Record<string, string> = {
  Physical: "text-red-500",
  Special: "text-blue-500",
}

const MOVE_CATEGORY_ABBREV: Record<string, string> = {
  Physical: "Phys",
  Special: "Spec",
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
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")

  const { data: results = [] } = useQuery({
    queryKey: ["pokemon-search-calc", search],
    queryFn: async () => {
      if (!search || search.length < 2) return []
      try {
        const json = await fetchJson<PaginatedResponse<PokemonSpecies>>(
          `/api/pokemon?search=${encodeURIComponent(search)}&pageSize=15`,
        )
        return json.data
      } catch {
        return []
      }
    },
    enabled: search.length >= 2,
  })

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-8 text-xs font-normal"
        >
          {value ? (
            <span className="flex items-center gap-1.5 truncate">
              <PokemonSprite pokemonId={value} size={20} />
              {displayName}
            </span>
          ) : (
            <span className="text-muted-foreground">Search Pokemon...</span>
          )}
          <ChevronsUpDown className="ml-auto h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search Pokemon..."
            value={search}
            onValueChange={setSearch}
            className="text-xs"
          />
          <CommandList className="max-h-[200px]">
            <CommandEmpty>
              {search.length < 2 ? "Type at least 2 characters..." : "No Pokemon found."}
            </CommandEmpty>
            <CommandGroup>
              {results.map((pokemon) => (
                <CommandItem
                  key={pokemon.id}
                  value={pokemon.id}
                  onSelect={() => {
                    onSelect(pokemon.id, pokemon.name, pokemon)
                    setSearch("")
                    setOpen(false)
                  }}
                  className="text-xs"
                >
                  <PokemonSprite pokemonId={pokemon.id} size={24} className="mr-1.5" />
                  <span>{pokemon.name}</span>
                  <Badge variant="secondary" className="ml-auto text-[10px]">
                    {pokemon.types.join("/")}
                  </Badge>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function MoveCombobox({
  value,
  pokemonId,
  onSelect,
}: {
  value: string
  pokemonId: string
  onSelect: (moveName: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")

  const { data: moves = [], isLoading } = useQuery({
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

  const filtered = search
    ? moves.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()))
    : moves

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={!pokemonId}
          className="w-full justify-between h-8 text-xs font-normal"
        >
          {value ? (
            <span className="truncate">{value}</span>
          ) : (
            <span className="text-muted-foreground">
              {pokemonId ? "Search move..." : "Select a Pokemon first"}
            </span>
          )}
          <ChevronsUpDown className="ml-auto h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search moves..."
            value={search}
            onValueChange={setSearch}
            className="text-xs"
          />
          <CommandList className="max-h-[240px]">
            <CommandEmpty>{isLoading ? "Loading moves..." : "No moves found."}</CommandEmpty>
            <CommandGroup>
              {filtered.slice(0, 50).map((move) => (
                <CommandItem
                  key={move.id}
                  value={move.id}
                  onSelect={() => {
                    onSelect(move.name)
                    setSearch("")
                    setOpen(false)
                  }}
                  className="text-xs"
                >
                  <span className="flex-1">{move.name}</span>
                  <span
                    className={cn(
                      "text-[10px] w-7 text-right",
                      MOVE_CATEGORY_COLORS[move.category] ?? "text-muted-foreground",
                    )}
                  >
                    {MOVE_CATEGORY_ABBREV[move.category] ?? "Stat"}
                  </span>
                  <Badge variant="secondary" className="text-[10px] ml-1">
                    {move.type}
                  </Badge>
                  {move.basePower > 0 && (
                    <span className="text-[10px] text-muted-foreground w-6 text-right">
                      {move.basePower}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function ItemCombobox({
  value,
  onSelect,
}: {
  value: string
  onSelect: (itemName: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")

  const { data: items = [] } = useQuery({
    queryKey: ["items-search-calc", search],
    queryFn: async () => {
      if (!search || search.length < 2) return []
      try {
        const json = await fetchJson<PaginatedResponse<ItemData>>(
          `/api/items?search=${encodeURIComponent(search)}&pageSize=20`,
        )
        return json.data
      } catch {
        return []
      }
    },
    enabled: search.length >= 2,
  })

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-8 text-xs font-normal"
        >
          {value ? (
            <span className="truncate">{value}</span>
          ) : (
            <span className="text-muted-foreground">Item</span>
          )}
          <ChevronsUpDown className="ml-auto h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search items..."
            value={search}
            onValueChange={setSearch}
            className="text-xs"
          />
          <CommandList className="max-h-[200px]">
            <CommandEmpty>
              {search.length < 2 ? "Type at least 2 characters..." : "No items found."}
            </CommandEmpty>
            <CommandGroup>
              {items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.id}
                  onSelect={() => {
                    onSelect(item.name)
                    setSearch("")
                    setOpen(false)
                  }}
                  className="text-xs"
                >
                  {item.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
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

  const totalEvs = Object.values(config.evs).reduce((a, b) => a + b, 0)

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
            <ItemCombobox value={config.item} onSelect={(name) => updateField("item", name)} />
          </div>
        </div>

        {/* Nature */}
        <div className="space-y-1.5">
          <Label className="text-xs">Nature</Label>
          <Select
            value={config.nature}
            onValueChange={(v) => updateField("nature", v as NatureName)}
          >
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
          <Select
            value={config.teraType || "none"}
            onValueChange={(v) => updateField("teraType", v === "none" ? "" : (v as PokemonType))}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className="text-xs">
                None
              </SelectItem>
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
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">EVs</Label>
            <span
              className={cn(
                "text-xs",
                totalEvs > MAX_TOTAL_EVS ? "text-red-500" : "text-muted-foreground",
              )}
            >
              {totalEvs}/{MAX_TOTAL_EVS}
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
                max={MAX_SINGLE_EV}
                value={config.evs[stat]}
                onChange={(e) =>
                  updateEv(
                    stat,
                    Math.min(MAX_SINGLE_EV, Math.max(0, parseInt(e.target.value) || 0)),
                  )
                }
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
  )
}

export function DamageCalculator() {
  const [attacker, setAttackerRaw] = useState<PokemonConfig>({ ...DEFAULT_CONFIG })
  const [defender, setDefender] = useState<PokemonConfig>({ ...DEFAULT_CONFIG })
  const [moveName, setMoveName] = useState("")
  const [weather, setWeather] = useState("None")
  const [terrain, setTerrain] = useState("None")
  const [isReflect, setIsReflect] = useState(false)
  const [isLightScreen, setIsLightScreen] = useState(false)
  const [isAuroraVeil, setIsAuroraVeil] = useState(false)
  const [isCritical, setIsCritical] = useState(false)
  const [isDoubles, setIsDoubles] = useState(false)

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
        isReflect,
        isLightScreen,
        isAuroraVeil,
        isCritical,
        isDoubles,
      },
    })
  }, [
    attacker,
    defender,
    moveName,
    weather,
    terrain,
    isReflect,
    isLightScreen,
    isAuroraVeil,
    isCritical,
    isDoubles,
    calculate,
  ])

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
              <MoveCombobox
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
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px]">Reflect</Label>
                    <Switch
                      checked={isReflect}
                      onCheckedChange={setIsReflect}
                      className="scale-75"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px]">Light Screen</Label>
                    <Switch
                      checked={isLightScreen}
                      onCheckedChange={setIsLightScreen}
                      className="scale-75"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px]">Aurora Veil</Label>
                    <Switch
                      checked={isAuroraVeil}
                      onCheckedChange={setIsAuroraVeil}
                      className="scale-75"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px]">Critical Hit</Label>
                    <Switch
                      checked={isCritical}
                      onCheckedChange={setIsCritical}
                      className="scale-75"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px]">Doubles</Label>
                    <Switch
                      checked={isDoubles}
                      onCheckedChange={setIsDoubles}
                      className="scale-75"
                    />
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
