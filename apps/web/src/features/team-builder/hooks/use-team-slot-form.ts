"use client"

import { useState, useCallback } from "react"
import {
  MAX_SINGLE_EV,
  MAX_TOTAL_EVS,
  DEFAULT_EVS,
  DEFAULT_IVS,
  DEFAULT_NATURE,
  DEFAULT_LEVEL,
  getTotalEvs,
  type NatureName,
  type PokemonType,
  type StatName,
  type StatsTable,
  type TeamSlotData,
} from "@nasty-plot/core"

/** Clamp a single EV value respecting per-stat max and total budget. */
export function clampEv(evs: StatsTable, stat: StatName, value: number): StatsTable {
  const clamped = Math.min(MAX_SINGLE_EV, Math.max(0, value))
  const next = { ...evs, [stat]: clamped }
  const total = getTotalEvs(next)
  if (total > MAX_TOTAL_EVS) {
    next[stat] = clamped - (total - MAX_TOTAL_EVS)
  }
  return next
}

/** Clamp a single IV value to 0-31. */
export function clampIv(ivs: StatsTable, stat: StatName, value: number): StatsTable {
  return { ...ivs, [stat]: Math.min(31, Math.max(0, value)) }
}

/** Return a new moves tuple with the value at the given index updated. */
export function updateMove(
  moves: [string, string?, string?, string?],
  index: number,
  value: string,
): [string, string?, string?, string?] {
  const next = [...moves] as [string, string?, string?, string?]
  next[index] = index === 0 ? value : value || undefined
  return next
}

export function useTeamSlotForm(slot: Partial<TeamSlotData> | null) {
  const [pokemonId, setPokemonId] = useState(slot?.pokemonId ?? "")
  const [nickname, setNickname] = useState(slot?.nickname ?? "")
  const [ability, setAbility] = useState(slot?.ability ?? "")
  const [item, setItem] = useState(slot?.item ?? "")
  const [nature, setNature] = useState<NatureName>(slot?.nature ?? DEFAULT_NATURE)
  const [teraType, setTeraType] = useState<PokemonType | undefined>(slot?.teraType)
  const [level] = useState(slot?.level ?? DEFAULT_LEVEL)
  const [moves, setMoves] = useState<[string, string?, string?, string?]>(
    slot?.moves ?? ["", undefined, undefined, undefined],
  )
  const [evs, setEvs] = useState<StatsTable>(slot?.evs ?? { ...DEFAULT_EVS })
  const [ivs, setIvs] = useState<StatsTable>(slot?.ivs ?? { ...DEFAULT_IVS })

  // Sync state when slot identity changes (switching between team members)
  // Uses the React 19 "store previous rendering value" pattern to avoid useEffect
  const slotKey = `${slot?.pokemonId}:${slot?.position}`
  const [prevSlotKey, setPrevSlotKey] = useState(slotKey)
  if (slotKey !== prevSlotKey) {
    setPrevSlotKey(slotKey)
    setPokemonId(slot?.pokemonId ?? "")
    setNickname(slot?.nickname ?? "")
    setAbility(slot?.ability ?? "")
    setItem(slot?.item ?? "")
    setNature(slot?.nature ?? DEFAULT_NATURE)
    setTeraType(slot?.teraType)
    setMoves(slot?.moves ?? ["", undefined, undefined, undefined])
    setEvs(slot?.evs ?? { ...DEFAULT_EVS })
    setIvs(slot?.ivs ?? { ...DEFAULT_IVS })
  }

  const handleEvChange = useCallback((stat: StatName, value: number) => {
    setEvs((prev) => clampEv(prev, stat, value))
  }, [])

  const handleIvChange = useCallback((stat: StatName, value: number) => {
    setIvs((prev) => clampIv(prev, stat, value))
  }, [])

  const handleMoveChange = useCallback((index: number, value: string) => {
    setMoves((prev) => updateMove(prev, index, value))
  }, [])

  return {
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
  }
}
