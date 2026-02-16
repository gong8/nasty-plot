"use client"

import { useState, useCallback } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import type {
  DamageCalcInput,
  DamageCalcResult,
  MatchupMatrixEntry,
  StatusName,
  WeatherName,
  TerrainName,
} from "@nasty-plot/core"
import { DEFAULT_LEVEL, DEFAULT_EVS, DEFAULT_IVS, DEFAULT_NATURE } from "@nasty-plot/core"
import { postApiData } from "@/lib/api-client"
import type { PokemonConfig } from "../types"
import type { FieldToggles } from "../components/FieldConfig"

// --- Mutation hook for single damage calc ---

export function useDamageCalc() {
  return useMutation({
    mutationFn: (input: DamageCalcInput) =>
      postApiData<DamageCalcResult>("/api/damage-calc", input),
  })
}

// --- Query hook for matchup matrix ---

export function useMatchupMatrix(teamId: string | undefined, formatId: string | undefined) {
  return useQuery({
    queryKey: ["matchup-matrix", teamId, formatId],
    enabled: !!teamId && !!formatId,
    queryFn: () =>
      postApiData<MatchupMatrixEntry[][]>("/api/damage-calc/matchup-matrix", { teamId, formatId }),
  })
}

// --- Helpers ---

const DEFAULT_CONFIG: PokemonConfig = {
  pokemonId: "",
  pokemonName: "",
  level: DEFAULT_LEVEL,
  ability: "",
  item: "",
  nature: DEFAULT_NATURE,
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
    status: (config.status || undefined) as StatusName | undefined,
  }
}

// --- Composite state hook ---

export function useDamageCalcState() {
  const [attacker, setAttackerRaw] = useState<PokemonConfig>({ ...DEFAULT_CONFIG })
  const [defender, setDefender] = useState<PokemonConfig>({ ...DEFAULT_CONFIG })
  const [moveName, setMoveName] = useState("")
  const [weather, setWeather] = useState<WeatherName>("None")
  const [terrain, setTerrain] = useState<TerrainName>("None")
  const [fieldToggles, setFieldToggles] = useState<FieldToggles>({
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

  const canCalculate = !!attacker.pokemonId && !!defender.pokemonId && !!moveName

  return {
    attacker,
    setAttacker,
    defender,
    setDefender,
    moveName,
    setMoveName,
    weather,
    setWeather,
    terrain,
    setTerrain,
    fieldToggles,
    setFieldToggles,
    result,
    isPending,
    error,
    handleCalculate,
    canCalculate,
  }
}
