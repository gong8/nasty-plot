"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { Trash2 } from "lucide-react"
import { usePokemonQuery, useLearnsetQuery } from "../hooks/use-pokemon-data"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  STATS,
  STAT_LABELS,
  STAT_COLORS,
  MAX_TOTAL_EVS,
  MAX_SINGLE_EV,
  DEFAULT_LEVEL,
  DEFAULT_EVS,
  DEFAULT_IVS,
  DEFAULT_NATURE,
  calculateAllStats,
  getTotalEvs,
  type NatureName,
  type PokemonSpecies,
  type PokemonType,
  type StatName,
  type StatsTable,
  type TeamSlotData,
  type TeamSlotInput,
} from "@nasty-plot/core"
import {
  PokemonSprite,
  TypeBadge,
  AbilitySelector,
  EvEditor,
  IvEditor,
  CalculatedStatsDisplay,
} from "@nasty-plot/ui"
import { PokemonInfoHeader } from "@/components/pokemon-info-header"
import { PokemonSearchPanel } from "./pokemon-search-panel"
import { ItemCombobox } from "./item-combobox"
import { MoveInput } from "./shared/move-input"
import { NatureSelector } from "./shared/nature-selector"
import { TeraTypePicker } from "./shared/tera-type-picker"
import { usePopularityData } from "../hooks/use-popularity-data"
import { fetchApiData } from "@/lib/api-client"

interface SlotEditorProps {
  slot: TeamSlotData | null
  teamId: string
  nextPosition: number
  onSave: (data: TeamSlotInput) => void
  onRemove: () => void
  isNew?: boolean
  formatId?: string
}

export function SlotEditor({
  slot,
  nextPosition,
  onSave,
  onRemove,
  isNew = false,
  formatId,
}: SlotEditorProps) {
  const [pokemonId, setPokemonId] = useState(slot?.pokemonId ?? "")
  const [nickname, setNickname] = useState(slot?.nickname ?? "")
  const [ability, setAbility] = useState(slot?.ability ?? "")
  const [item, setItem] = useState(slot?.item ?? "")
  const [nature, setNature] = useState<NatureName>(slot?.nature ?? DEFAULT_NATURE)
  const [teraType, setTeraType] = useState<PokemonType | undefined>(slot?.teraType)
  const [level, setLevel] = useState(slot?.level ?? DEFAULT_LEVEL)
  const [moves, setMoves] = useState<[string, string?, string?, string?]>(
    slot?.moves ?? ["", undefined, undefined, undefined],
  )
  const [evs, setEvs] = useState<StatsTable>(slot?.evs ?? { ...DEFAULT_EVS })
  const [ivs, setIvs] = useState<StatsTable>(slot?.ivs ?? { ...DEFAULT_IVS })

  // Reset form when slot changes
  useEffect(() => {
    setPokemonId(slot?.pokemonId ?? "") // eslint-disable-line react-hooks/set-state-in-effect -- sync form state from prop
    setNickname(slot?.nickname ?? "")
    setAbility(slot?.ability ?? "")
    setItem(slot?.item ?? "")
    setNature(slot?.nature ?? DEFAULT_NATURE)
    setTeraType(slot?.teraType)
    setLevel(slot?.level ?? DEFAULT_LEVEL)
    setMoves(slot?.moves ?? ["", undefined, undefined, undefined])
    setEvs(slot?.evs ?? { ...DEFAULT_EVS })
    setIvs(slot?.ivs ?? { ...DEFAULT_IVS })
  }, [slot])

  // Fetch pokemon species data for the selected pokemonId
  const { data: speciesData } = usePokemonQuery(pokemonId || null)

  // Fetch Mega form preview when item changes
  const { data: megaForm } = useQuery<PokemonSpecies | null>({
    queryKey: ["mega-form", pokemonId, item],
    queryFn: async () => {
      try {
        return await fetchApiData<PokemonSpecies>(
          `/api/pokemon/${pokemonId}/mega-form?item=${encodeURIComponent(item)}`,
        )
      } catch {
        return null
      }
    },
    enabled: !!pokemonId && !!item,
  })

  // Fetch learnset for move search
  const { data: learnset = [] } = useLearnsetQuery(pokemonId || null, formatId)

  // Fetch popularity data for two-tier dropdowns
  const { data: popularity } = usePopularityData(pokemonId, formatId)

  const abilities = useMemo(() => {
    if (!speciesData?.abilities) return []
    return Object.values(speciesData.abilities)
  }, [speciesData])

  // Calculated stats
  const calculatedStats = useMemo(() => {
    if (!speciesData?.baseStats) return null
    return calculateAllStats(speciesData.baseStats, ivs, evs, level, nature)
  }, [speciesData, ivs, evs, level, nature])

  const handleEvChange = useCallback((stat: StatName, value: number) => {
    setEvs((prev) => {
      const currentOther = getTotalEvs(prev) - prev[stat]
      const maxForStat = Math.min(MAX_SINGLE_EV, MAX_TOTAL_EVS - currentOther)
      const clamped = Math.min(value, maxForStat)
      return { ...prev, [stat]: clamped }
    })
  }, [])

  const handleIvChange = useCallback((stat: StatName, value: number) => {
    const clamped = Math.max(0, Math.min(31, value))
    setIvs((prev) => ({ ...prev, [stat]: clamped }))
  }, [])

  const handleMoveChange = useCallback((index: number, value: string) => {
    setMoves((prev) => {
      const next = [...prev] as [string, string?, string?, string?]
      next[index] = value || (index === 0 ? "" : undefined)
      return next
    })
  }, [])

  const handlePokemonSelect = useCallback((pokemon: PokemonSpecies) => {
    setPokemonId(pokemon.id)
    setNickname("")
    // Reset slot-specific data when changing Pokemon
    const firstAbility = Object.values(pokemon.abilities)[0] ?? ""
    setAbility(firstAbility)
    setMoves(["", undefined, undefined, undefined])
    setTeraType(pokemon.types[0])
  }, [])

  const handleSave = () => {
    onSave({
      position: slot?.position ?? nextPosition,
      pokemonId,
      nickname: nickname || undefined,
      ability,
      item,
      nature,
      teraType,
      level,
      moves,
      evs,
      ivs,
    })
  }

  // If no pokemon selected, show search
  if (!pokemonId) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <h3 className="font-semibold text-lg">Select a Pokemon</h3>
        <PokemonSearchPanel onSelect={handlePokemonSelect} formatId={formatId} />
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-5 p-4">
        {/* Pokemon Header */}
        <div className="flex items-center justify-between">
          <PokemonInfoHeader pokemonId={pokemonId} speciesData={speciesData} />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setPokemonId("")
            }}
          >
            Change
          </Button>
        </div>

        <Separator />

        {/* Two-column responsive layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Core set details */}
          <div className="flex flex-col gap-5">
            {/* Nickname */}
            <div className="space-y-1.5">
              <Label>Nickname</Label>
              <Input
                placeholder="Optional nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />
            </div>

            {/* Ability */}
            <div className="space-y-1.5">
              <Label>Ability</Label>
              <AbilitySelector
                value={ability}
                onValueChange={setAbility}
                abilities={abilities}
                popularity={popularity?.abilities}
              />
            </div>

            {/* Item */}
            <div className="space-y-1.5">
              <Label>Item</Label>
              <ItemCombobox
                value={item}
                onChange={setItem}
                formatId={formatId}
                pokemonId={pokemonId}
              />
            </div>

            {/* Mega Form Preview */}
            {megaForm && (
              <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
                <div className="text-xs font-semibold text-primary">Mega Evolution Preview</div>
                <div className="flex items-center gap-2">
                  <PokemonSprite pokemonId={megaForm.id} size={32} />
                  <div>
                    <div className="text-sm font-medium">{megaForm.name}</div>
                    <div className="flex gap-1 mt-0.5">
                      {megaForm.types.map((t: PokemonType) => (
                        <TypeBadge key={t} type={t} size="sm" />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1 text-xs">
                  {STATS.map((stat) => (
                    <div key={stat} className="flex justify-between">
                      <span className="font-medium" style={{ color: STAT_COLORS[stat] }}>
                        {STAT_LABELS[stat]}
                      </span>
                      <span className="tabular-nums">{megaForm.baseStats[stat]}</span>
                    </div>
                  ))}
                </div>
                {megaForm.abilities && (
                  <div className="text-xs text-muted-foreground">
                    Ability: {Object.values(megaForm.abilities).join(" / ")}
                  </div>
                )}
              </div>
            )}

            {/* Nature */}
            <div className="space-y-1.5">
              <Label>Nature</Label>
              <NatureSelector value={nature} onChange={setNature} popularity={popularity} />
            </div>

            {/* Tera Type */}
            <div className="space-y-1.5">
              <Label>Tera Type</Label>
              <TeraTypePicker value={teraType} onChange={setTeraType} />
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
                    selectedMoves={moves}
                    onChange={(val) => handleMoveChange(i, val)}
                    popularity={popularity}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Stats & actions */}
          <div className="flex flex-col gap-5">
            {/* EVs */}
            <div className="space-y-3">
              <Label>EVs</Label>
              <EvEditor evs={evs} onChange={handleEvChange} />
            </div>

            <Separator />

            {/* IVs */}
            <div className="space-y-3">
              <Label>IVs</Label>
              <IvEditor ivs={ivs} onChange={handleIvChange} />
            </div>

            <Separator />

            {/* Calculated Stats */}
            {calculatedStats && (
              <div className="space-y-2">
                <Label>Calculated Stats</Label>
                <CalculatedStatsDisplay stats={calculatedStats} />
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
        </div>
      </div>
    </ScrollArea>
  )
}
