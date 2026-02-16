"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import {
  DEFAULT_ABILITY,
  DEFAULT_EVS,
  DEFAULT_ITEM,
  DEFAULT_IVS,
  DEFAULT_LEVEL,
  DEFAULT_NATURE,
  type TeamSlotInput,
  type TeamSlotData,
  type NatureName,
  type StatsTable,
} from "@nasty-plot/core"
import { useAddSlot, useUpdateSlot } from "@/features/teams/hooks/use-teams"

interface UseDbPersistenceOptions {
  teamId: string
  filledSlots: Partial<TeamSlotData>[]
  isRestoringDraft: boolean
}

export function useDbPersistence({
  teamId,
  filledSlots,
  isRestoringDraft,
}: UseDbPersistenceOptions) {
  const addSlot = useAddSlot()
  const updateSlotMutation = useUpdateSlot()
  const [isSaving, setIsSaving] = useState(false)

  // --- Incremental DB persistence ---

  const persistSlotToDb = useCallback(
    async (position: number, pokemonId: string) => {
      const slotInput: TeamSlotInput = {
        position,
        pokemonId,
        ability: DEFAULT_ABILITY,
        item: DEFAULT_ITEM,
        nature: DEFAULT_NATURE as NatureName,
        level: DEFAULT_LEVEL,
        moves: [""],
        evs: { ...DEFAULT_EVS } as StatsTable,
        ivs: { ...DEFAULT_IVS } as StatsTable,
      }
      try {
        await addSlot.mutateAsync({ teamId, slot: slotInput })
      } catch {
        try {
          await updateSlotMutation.mutateAsync({
            teamId,
            position,
            data: { pokemonId },
          })
        } catch {
          // Both failed — analysis/recommendations won't reflect this slot
        }
      }
    },
    [teamId, addSlot, updateSlotMutation],
  )

  // Sync draft-restored slots to DB on first load
  const hasSyncedDraft = useRef(false)
  useEffect(() => {
    if (isRestoringDraft || hasSyncedDraft.current) return
    hasSyncedDraft.current = true
    if (filledSlots.length === 0) return
    ;(async () => {
      for (const slot of filledSlots) {
        if (slot.pokemonId && slot.position) {
          await persistSlotToDb(slot.position, slot.pokemonId).catch((err) =>
            console.error("[guided-builder] persistSlot:", err),
          )
        }
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRestoringDraft])

  // Save all slots with full set data
  const saveAllSlots = useCallback(async () => {
    for (const slot of filledSlots) {
      if (!slot.pokemonId || !slot.position) continue
      const slotInput: TeamSlotInput = {
        position: slot.position,
        pokemonId: slot.pokemonId,
        ability: slot.ability || "",
        item: slot.item || "",
        nature: (slot.nature || DEFAULT_NATURE) as NatureName,
        teraType: slot.teraType,
        level: slot.level || DEFAULT_LEVEL,
        moves: slot.moves || [""],
        evs: (slot.evs || { ...DEFAULT_EVS }) as StatsTable,
        ivs: (slot.ivs || { ...DEFAULT_IVS }) as StatsTable,
      }
      try {
        await updateSlotMutation.mutateAsync({
          teamId,
          position: slot.position,
          data: slotInput,
        })
      } catch {
        await addSlot.mutateAsync({ teamId, slot: slotInput })
      }
    }
  }, [filledSlots, teamId, addSlot, updateSlotMutation])

  return {
    persistSlotToDb,
    saveAllSlots,
    isSaving,
    setIsSaving,
  }
}
