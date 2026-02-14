"use client"

import { useState, useCallback } from "react"
import { ChevronDown, ChevronUp, Info } from "lucide-react"
import { usePokemonQuery, useLearnsetQuery, useSpeciesDerived } from "../../hooks/use-pokemon-data"
import { useTeamSlotForm, clampEv, clampIv, updateMove } from "../../hooks/use-team-slot-form"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  MAX_TOTAL_EVS,
  DEFAULT_LEVEL,
  getTotalEvs,
  type NatureName,
  type StatName,
  type TeamSlotData,
} from "@nasty-plot/core"
import { AbilitySelector, EvEditor, IvEditor, CalculatedStatsDisplay } from "@nasty-plot/ui"
import { PokemonInfoHeader } from "@/components/pokemon-info-header"
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

export function SimplifiedSetEditor({
  slot,
  formatId,
  setInfo,
  onUpdate,
}: SimplifiedSetEditorProps) {
  const [showEvs, setShowEvs] = useState(false)

  const {
    pokemonId,
    evs,
    ivs,
    nature,
    moves,
    handleEvChange: baseHandleEvChange,
    handleIvChange: baseHandleIvChange,
    handleMoveChange: baseHandleMoveChange,
  } = useTeamSlotForm(slot)

  // Fetch species data
  const { data: speciesData } = usePokemonQuery(pokemonId || null)

  // Fetch learnset
  const { data: learnset = [] } = useLearnsetQuery(pokemonId || null, formatId)

  // Fetch popularity data for two-tier dropdowns
  const { data: popularity } = usePopularityData(pokemonId, formatId)

  const { abilities, calculatedStats } = useSpeciesDerived(
    speciesData,
    ivs,
    evs,
    slot.level ?? DEFAULT_LEVEL,
    nature,
  )

  const evTotal = getTotalEvs(evs)

  const handleEvChange = useCallback(
    (stat: StatName, value: number) => {
      baseHandleEvChange(stat, value)
      onUpdate({ evs: clampEv(evs, stat, value) })
    },
    [baseHandleEvChange, evs, onUpdate],
  )

  const handleIvChange = useCallback(
    (stat: StatName, value: number) => {
      baseHandleIvChange(stat, value)
      onUpdate({ ivs: clampIv(ivs, stat, value) })
    },
    [baseHandleIvChange, ivs, onUpdate],
  )

  const handleMoveChange = useCallback(
    (index: number, value: string) => {
      baseHandleMoveChange(index, value)
      onUpdate({ moves: updateMove(moves, index, value) })
    },
    [baseHandleMoveChange, moves, onUpdate],
  )

  return (
    <div className="space-y-4">
      {/* Pokemon header */}
      <PokemonInfoHeader pokemonId={pokemonId} speciesData={speciesData} />

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
              value={moves[i] ?? ""}
              learnset={learnset}
              selectedMoves={moves}
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
