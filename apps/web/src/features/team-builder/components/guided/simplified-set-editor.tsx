"use client"

import { useState, useCallback, useMemo } from "react"
import { ChevronDown, ChevronUp, Info } from "lucide-react"
import { usePokemonQuery, useLearnsetQuery } from "../../hooks/use-pokemon-data"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  MAX_TOTAL_EVS,
  MAX_SINGLE_EV,
  DEFAULT_EVS,
  DEFAULT_IVS,
  DEFAULT_LEVEL,
  calculateAllStats,
  getTotalEvs,
  type NatureName,
  type PokemonType,
  type StatName,
  type StatsTable,
  type TeamSlotData,
} from "@nasty-plot/core"
import {
  PokemonSprite,
  TypeBadge,
  AbilitySelector,
  EvEditor,
  IvEditor,
  CalculatedStatsDisplay,
} from "@nasty-plot/ui"
import { ItemCombobox } from "../item-combobox"
import { MoveInput } from "../shared/move-input"
import { NatureSelector } from "../shared/nature-selector"
import { TeraTypePicker } from "../shared/tera-type-picker"
import { usePopularityData } from "../../hooks/use-popularity-data"

interface SimplifiedSetEditorProps {
  slot: Partial<TeamSlotData>
  formatId: string
  setInfo?: string // e.g. "Most popular set, used by 45% of players"
  onUpdate: (updates: Partial<TeamSlotData>) => void
}

const MAX_IV = 31

export function SimplifiedSetEditor({
  slot,
  formatId,
  setInfo,
  onUpdate,
}: SimplifiedSetEditorProps) {
  const [showEvs, setShowEvs] = useState(false)

  const pokemonId = slot.pokemonId ?? ""

  // Fetch species data
  const { data: speciesData } = usePokemonQuery(pokemonId || null)

  // Fetch learnset
  const { data: learnset = [] } = useLearnsetQuery(pokemonId || null, formatId)

  // Fetch popularity data for two-tier dropdowns
  const { data: popularity } = usePopularityData(pokemonId, formatId)

  const abilities = useMemo(() => {
    if (!speciesData?.abilities) return []
    return Object.values(speciesData.abilities)
  }, [speciesData])

  const evs = useMemo(() => (slot.evs ?? { ...DEFAULT_EVS }) as StatsTable, [slot.evs])
  const ivs = useMemo(() => (slot.ivs ?? { ...DEFAULT_IVS }) as StatsTable, [slot.ivs])
  const nature = slot.nature ?? "Hardy"

  const evTotal = getTotalEvs(evs)

  const calculatedStats = useMemo(() => {
    if (!speciesData?.baseStats) return null
    return calculateAllStats(speciesData.baseStats, ivs, evs, slot.level ?? DEFAULT_LEVEL, nature)
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
      const clamped = Math.max(0, Math.min(MAX_IV, value))
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
        <AbilitySelector
          value={slot.ability || ""}
          onValueChange={(v) => onUpdate({ ability: v })}
          abilities={abilities}
          popularity={popularity?.abilities}
          triggerClassName="h-9"
        />
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
        <NatureSelector
          value={nature as NatureName}
          onChange={(v) => onUpdate({ nature: v })}
          popularity={popularity}
          triggerClassName="h-9"
        />
      </div>

      {/* Tera Type */}
      <div className="space-y-1.5">
        <Label className="text-xs">Tera Type</Label>
        <TeraTypePicker value={slot.teraType} onChange={(t) => onUpdate({ teraType: t })} />
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
              compact
            />
          ))}
        </div>
      </div>

      <Separator />

      {/* Calculated Stats (always visible) */}
      {calculatedStats && (
        <div className="space-y-1.5">
          <Label className="text-xs">Stats</Label>
          <CalculatedStatsDisplay stats={calculatedStats} className="gap-1.5 [&>div]:p-1.5" />
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
          <EvEditor evs={evs} onChange={handleEvChange} />

          <Separator />

          {/* IVs */}
          <IvEditor ivs={ivs} onChange={handleIvChange} />
        </div>
      )}
    </div>
  )
}
