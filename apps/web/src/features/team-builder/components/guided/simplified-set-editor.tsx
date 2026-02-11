"use client"

import { useState, useCallback, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { ChevronDown, ChevronUp, Info } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  NATURE_DATA,
  TYPE_COLORS,
  isLightTypeColor,
  STAT_LABELS,
  STAT_COLORS,
  MAX_TOTAL_EVS,
  MAX_SINGLE_EV,
  POKEMON_TYPES,
  NATURES,
  STATS,
  calculateAllStats,
  getTotalEvs,
  type NatureName,
  type PokemonSpecies,
  type PokemonType,
  type StatName,
  type StatsTable,
  type TeamSlotData,
} from "@nasty-plot/core"
import { PokemonSprite, TypeBadge } from "@nasty-plot/ui"
import { ItemCombobox } from "../item-combobox"
import { usePopularityData, type PopularityData } from "../../hooks/use-popularity-data"

interface SimplifiedSetEditorProps {
  slot: Partial<TeamSlotData>
  formatId: string
  setInfo?: string // e.g. "Most popular set, used by 45% of players"
  onUpdate: (updates: Partial<TeamSlotData>) => void
}

export function SimplifiedSetEditor({
  slot,
  formatId,
  setInfo,
  onUpdate,
}: SimplifiedSetEditorProps) {
  const [showEvs, setShowEvs] = useState(false)

  const pokemonId = slot.pokemonId ?? ""

  // Fetch species data
  const { data: speciesData } = useQuery<PokemonSpecies>({
    queryKey: ["pokemon", pokemonId],
    queryFn: async () => {
      const res = await fetch(`/api/pokemon/${pokemonId}`)
      if (!res.ok) throw new Error("Not found")
      const json = await res.json()
      return json.data
    },
    enabled: !!pokemonId,
  })

  // Fetch learnset
  const { data: learnset = [] } = useQuery<string[]>({
    queryKey: ["learnset", pokemonId, formatId],
    queryFn: async () => {
      let url = `/api/pokemon/${pokemonId}/learnset`
      if (formatId) url += `?format=${encodeURIComponent(formatId)}`
      const res = await fetch(url)
      if (!res.ok) return []
      const json = await res.json()
      const moves = json.data ?? []
      return moves.map((m: { name: string }) => m.name)
    },
    enabled: !!pokemonId,
  })

  // Fetch popularity data for two-tier dropdowns
  const { data: popularity } = usePopularityData(pokemonId, formatId)

  const abilities = useMemo(() => {
    if (!speciesData?.abilities) return []
    return Object.entries(speciesData.abilities).map(([slot, name]) => ({
      name,
      isHidden: slot === "H",
    }))
  }, [speciesData])

  // Sort abilities by usage
  const { commonAbilities, otherAbilities } = useMemo(() => {
    if (!popularity?.abilities?.length) {
      return { commonAbilities: [] as typeof abilities, otherAbilities: abilities }
    }
    const usageMap = new Map(popularity.abilities.map((a) => [a.name, a.usagePercent]))
    const common = abilities
      .filter((a) => usageMap.has(a.name))
      .sort((a, b) => (usageMap.get(b.name) ?? 0) - (usageMap.get(a.name) ?? 0))
    const other = abilities.filter((a) => !usageMap.has(a.name))
    return { commonAbilities: common, otherAbilities: other }
  }, [abilities, popularity])

  // Sort natures by usage
  const { commonNatures, otherNatures } = useMemo(() => {
    if (!popularity?.natures?.length) {
      return { commonNatures: [] as string[], otherNatures: NATURES as readonly NatureName[] }
    }
    const commonSet = new Set(popularity.natures.map((n) => n.name))
    const common = popularity.natures.map((n) => n.name)
    const other = NATURES.filter((n) => !commonSet.has(n))
    return { commonNatures: common, otherNatures: other }
  }, [popularity])

  const evs = useMemo(
    () => (slot.evs ?? { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }) as StatsTable,
    [slot.evs],
  )
  const ivs = useMemo(
    () => (slot.ivs ?? { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }) as StatsTable,
    [slot.ivs],
  )
  const nature = slot.nature ?? "Hardy"

  const evTotal = getTotalEvs(evs)
  const evRemaining = MAX_TOTAL_EVS - evTotal

  const calculatedStats = useMemo(() => {
    if (!speciesData) return null
    return calculateAllStats(speciesData.baseStats, ivs, evs, slot.level ?? 100, nature)
  }, [speciesData, ivs, evs, slot.level, nature])

  const handleEvChange = useCallback(
    (stat: StatName, value: number) => {
      const currentOther = getTotalEvs(evs) - evs[stat]
      const maxForStat = Math.min(MAX_SINGLE_EV, MAX_TOTAL_EVS - currentOther)
      const clamped = Math.min(value, maxForStat)
      onUpdate({ evs: { ...evs, [stat]: clamped } as StatsTable })
    },
    [evs, onUpdate],
  )

  const handleIvChange = useCallback(
    (stat: StatName, value: number) => {
      const clamped = Math.max(0, Math.min(31, value))
      onUpdate({ ivs: { ...ivs, [stat]: clamped } as StatsTable })
    },
    [ivs, onUpdate],
  )

  const handleMoveChange = useCallback(
    (index: number, value: string) => {
      const newMoves = [...(slot.moves ?? [""])] as [string, string?, string?, string?]
      newMoves[index] = value || (index === 0 ? "" : undefined)
      onUpdate({ moves: newMoves })
    },
    [slot.moves, onUpdate],
  )

  const displayName = speciesData?.name ?? pokemonId

  return (
    <div className="space-y-4">
      {/* Pokemon header */}
      <div className="flex items-center gap-3">
        <PokemonSprite pokemonId={pokemonId} size={40} />
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
        <Select value={slot.ability || ""} onValueChange={(v) => onUpdate({ ability: v })}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Select ability" />
          </SelectTrigger>
          <SelectContent>
            {commonAbilities.length > 0 ? (
              <>
                <SelectGroup>
                  <SelectLabel>Common</SelectLabel>
                  {commonAbilities.map((a) => {
                    const pct = popularity?.abilities?.find((x) => x.name === a.name)?.usagePercent
                    return (
                      <SelectItem key={a.name} value={a.name}>
                        {a.name}
                        {a.isHidden && <span className="text-muted-foreground ml-1">(Hidden)</span>}
                        {pct != null && (
                          <span className="text-muted-foreground ml-1">({pct.toFixed(0)}%)</span>
                        )}
                      </SelectItem>
                    )
                  })}
                </SelectGroup>
                {otherAbilities.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Other</SelectLabel>
                    {otherAbilities.map((a) => (
                      <SelectItem key={a.name} value={a.name}>
                        {a.name}
                        {a.isHidden && <span className="text-muted-foreground ml-1">(Hidden)</span>}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </>
            ) : (
              abilities.map((a) => (
                <SelectItem key={a.name} value={a.name}>
                  {a.name}
                  {a.isHidden && <span className="text-muted-foreground ml-1">(Hidden)</span>}
                </SelectItem>
              ))
            )}
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
          pokemonId={pokemonId}
        />
      </div>

      {/* Nature */}
      <div className="space-y-1.5">
        <Label className="text-xs">Nature</Label>
        <Select value={nature} onValueChange={(v) => onUpdate({ nature: v as NatureName })}>
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {commonNatures.length > 0 ? (
              <>
                <SelectGroup>
                  <SelectLabel>Common</SelectLabel>
                  {commonNatures.map((n) => {
                    const nd = NATURE_DATA[n as NatureName]
                    const label = nd?.plus
                      ? `${n} (+${STAT_LABELS[nd.plus]}/-${STAT_LABELS[nd.minus!]})`
                      : `${n} (Neutral)`
                    return (
                      <SelectItem key={n} value={n}>
                        {label}
                      </SelectItem>
                    )
                  })}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>All Natures</SelectLabel>
                  {otherNatures.map((n) => {
                    const nd = NATURE_DATA[n]
                    const label = nd.plus
                      ? `${n} (+${STAT_LABELS[nd.plus]}/-${STAT_LABELS[nd.minus!]})`
                      : `${n} (Neutral)`
                    return (
                      <SelectItem key={n} value={n}>
                        {label}
                      </SelectItem>
                    )
                  })}
                </SelectGroup>
              </>
            ) : (
              NATURES.map((n) => {
                const nd = NATURE_DATA[n]
                const label = nd.plus
                  ? `${n} (+${STAT_LABELS[nd.plus]}/-${STAT_LABELS[nd.minus!]})`
                  : `${n} (Neutral)`
                return (
                  <SelectItem key={n} value={n}>
                    {label}
                  </SelectItem>
                )
              })
            )}
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
              className={`rounded px-1 py-0.5 text-[10px] font-medium transition-all ${
                isLightTypeColor(TYPE_COLORS[t]) ? "text-gray-900" : "text-white"
              } ${
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
              selectedMoves={slot.moves ?? ["", undefined, undefined, undefined]}
              onChange={(val) => handleMoveChange(i, val)}
              popularity={popularity}
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
                <div className="text-[10px] font-medium" style={{ color: STAT_COLORS[stat] }}>
                  {STAT_LABELS[stat]}
                </div>
                <div className="text-sm font-bold tabular-nums">{calculatedStats[stat]}</div>
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
                  evRemaining < 0 ? "text-destructive font-medium" : "text-muted-foreground"
                }`}
              >
                {evTotal} / {MAX_TOTAL_EVS} ({evRemaining} remaining)
              </span>
            </div>
            {STATS.map((stat) => (
              <div key={stat} className="space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium" style={{ color: STAT_COLORS[stat] }}>
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
                  <span className="text-[10px] font-medium" style={{ color: STAT_COLORS[stat] }}>
                    {STAT_LABELS[stat]}
                  </span>
                  <Input
                    type="number"
                    min={0}
                    max={31}
                    value={ivs[stat]}
                    onChange={(e) => handleIvChange(stat, parseInt(e.target.value, 10) || 0)}
                    className="h-7 text-center text-xs"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// --- Move Input with two-tier autocomplete ---

function MoveInput({
  index,
  value,
  learnset,
  selectedMoves,
  onChange,
  popularity,
}: {
  index: number
  value: string
  learnset: string[]
  selectedMoves: [string, string?, string?, string?]
  onChange: (val: string) => void
  popularity?: PopularityData
}) {
  const [search, setSearch] = useState("")
  const [open, setOpen] = useState(false)

  // Moves already picked in other slots (exclude current slot's value)
  const otherMoves = useMemo(() => {
    const others = new Set<string>()
    for (let i = 0; i < 4; i++) {
      if (i !== index && selectedMoves[i]) {
        others.add(selectedMoves[i]!.toLowerCase())
      }
    }
    return others
  }, [selectedMoves, index])

  const { commonMoves, otherFilteredMoves } = useMemo(() => {
    let available = learnset.filter((m) => !otherMoves.has(m.toLowerCase()))
    if (search) {
      const lower = search.toLowerCase()
      available = available.filter((m) => m.toLowerCase().includes(lower))
    }

    if (!popularity?.moves?.length) {
      return { commonMoves: [] as string[], otherFilteredMoves: available.slice(0, 20) }
    }

    const availableSet = new Set(available)

    const common = popularity.moves
      .filter((m) => availableSet.has(m.name))
      .slice(0, 12)
      .map((m) => m.name)

    const commonSet = new Set(common)
    const other = available.filter((m) => !commonSet.has(m)).slice(0, 20)

    return { commonMoves: common, otherFilteredMoves: other }
  }, [search, learnset, otherMoves, popularity])

  const isDuplicate = value && otherMoves.has(value.toLowerCase())

  const popularityMap = useMemo(() => {
    if (!popularity?.moves?.length) return null
    return new Map(popularity.moves.map((m) => [m.name, m.usagePercent]))
  }, [popularity])

  return (
    <div className="relative">
      <Input
        placeholder={`Move ${index + 1}`}
        value={open ? search : value}
        onChange={(e) => {
          setSearch(e.target.value)
          if (!open) setOpen(true)
        }}
        onFocus={() => {
          setSearch(value)
          setOpen(true)
        }}
        onBlur={() => {
          setTimeout(() => setOpen(false), 150)
        }}
        className={`h-8 text-sm ${isDuplicate ? "border-destructive" : ""}`}
      />
      {isDuplicate && <p className="text-[10px] text-destructive mt-0.5">Duplicate move</p>}
      {open && (commonMoves.length > 0 || otherFilteredMoves.length > 0) && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-[200px] overflow-y-auto">
          {commonMoves.length > 0 && (
            <>
              <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50">
                Common
              </div>
              {commonMoves.map((move) => (
                <button
                  key={move}
                  className="w-full px-3 py-1.5 text-sm text-left hover:bg-accent transition-colors flex items-center justify-between"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    onChange(move)
                    setSearch(move)
                    setOpen(false)
                  }}
                >
                  <span>{move}</span>
                  {popularityMap && (
                    <span className="text-xs text-muted-foreground">
                      {popularityMap.get(move)?.toFixed(1)}%
                    </span>
                  )}
                </button>
              ))}
            </>
          )}
          {otherFilteredMoves.length > 0 && (
            <>
              {commonMoves.length > 0 && (
                <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50">
                  All Moves
                </div>
              )}
              {otherFilteredMoves.map((move) => (
                <button
                  key={move}
                  className="w-full px-3 py-1.5 text-sm text-left hover:bg-accent transition-colors"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    onChange(move)
                    setSearch(move)
                    setOpen(false)
                  }}
                >
                  {move}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
