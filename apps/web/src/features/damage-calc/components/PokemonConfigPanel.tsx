"use client"

import { useState, useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Separator } from "@/components/ui/separator"
import { Swords, Shield } from "lucide-react"
import { PokemonSprite, SearchCombobox, MoveSelector, EvEditor } from "@nasty-plot/ui"
import { NatureSelector } from "@/features/team-builder/components/shared/NatureSelector"
import { TeraTypePicker } from "@/features/team-builder/components/shared/TeraTypePicker"
import {
  STAT_LABELS,
  STAT_COLORS,
  STATUSES,
  BOOST_VALUES,
  type StatsTable,
  type StatusName,
  type PaginatedResponse,
  type PokemonSpecies,
  type MoveData,
  type ItemData,
} from "@nasty-plot/core"
import { fetchJson, fetchApiData } from "@/lib/api-client"
import type { PokemonConfig } from "../types"

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

// --- Main Panel ---

interface PokemonConfigPanelProps {
  label: "Attacker" | "Defender"
  config: PokemonConfig
  onChange: (config: PokemonConfig) => void
}

export function PokemonConfigPanel({ label, config, onChange }: PokemonConfigPanelProps) {
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
            onValueChange={(v) => updateField("status", v === "None" ? "" : (v as StatusName))}
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

// --- Move Selector (exported separately for the center column) ---

export function CalcMoveSelector({
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
