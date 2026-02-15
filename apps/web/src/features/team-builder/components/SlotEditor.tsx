"use client"

import { useCallback } from "react"
import { Trash2 } from "lucide-react"
import { usePokemonQuery, useLearnsetQuery, useSpeciesDerived } from "../hooks/use-pokemon-data"
import { useTeamSlotForm } from "../hooks/use-team-slot-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/ScrollArea"
import { type PokemonSpecies, type TeamSlotData, type TeamSlotInput } from "@nasty-plot/core"
import { AbilitySelector, EvEditor, IvEditor, CalculatedStatsDisplay } from "@nasty-plot/ui"
import { PokemonInfoHeader } from "@/components/PokemonInfoHeader"
import { PokemonSearchPanel } from "./PokemonSearchPanel"
import { ItemCombobox } from "./ItemCombobox"
import { MoveInput } from "./shared/MoveInput"
import { NatureSelector } from "./shared/NatureSelector"
import { TeraTypePicker } from "./shared/TeraTypePicker"
import { usePopularityData } from "../hooks/use-popularity-data"

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
  const {
    pokemonId,
    setPokemonId,
    nickname,
    setNickname,
    ability,
    setAbility,
    item,
    setItem,
    nature,
    setNature,
    teraType,
    setTeraType,
    level,
    moves,
    setMoves,
    evs,
    ivs,
    handleEvChange,
    handleIvChange,
    handleMoveChange,
  } = useTeamSlotForm(slot)

  // Fetch pokemon species data for the selected pokemonId
  const { data: speciesData } = usePokemonQuery(pokemonId || null)

  // Fetch learnset for move search
  const { data: learnset = [] } = useLearnsetQuery(pokemonId || null, formatId)

  // Fetch popularity data for two-tier dropdowns
  const { data: popularity } = usePopularityData(pokemonId, formatId)

  const { abilities, calculatedStats } = useSpeciesDerived(speciesData, ivs, evs, level, nature)

  const handlePokemonSelect = useCallback(
    (pokemon: PokemonSpecies) => {
      setPokemonId(pokemon.id)
      setNickname("")
      const firstAbility = Object.values(pokemon.abilities)[0] ?? ""
      setAbility(firstAbility)
      setMoves(["", undefined, undefined, undefined])
      setTeraType(pokemon.types[0])
    },
    [setPokemonId, setNickname, setAbility, setMoves, setTeraType],
  )

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
