"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import type { GuidedPokemonPick, SampleTeamEntry } from "./use-guided-builder"

interface GuidedActions {
  addSlotPick: (position: number, pick: GuidedPokemonPick) => void
  goToStep: (step: "start" | "lead" | "build" | "sets" | "review") => void
  nextBuildSlot: () => void
  currentBuildSlot: number
  importSampleTeam: (sample: SampleTeamEntry) => void
  clearDraft: () => void
}

interface DbPersistence {
  persistSlotToDb: (position: number, pokemonId: string) => Promise<void>
  saveAllSlots: () => Promise<void>
  setIsSaving: (saving: boolean) => void
}

interface UseGuidedBuilderHandlersOptions {
  teamId: string
  guided: GuidedActions
  db: DbPersistence
}

export function useGuidedBuilderHandlers({ teamId, guided, db }: UseGuidedBuilderHandlersOptions) {
  const router = useRouter()

  const handleLeadPick = useCallback(
    async (pick: GuidedPokemonPick) => {
      await db
        .persistSlotToDb(1, pick.pokemonId)
        .catch((err) => console.error("[guided-builder] persistSlot:", err))
      guided.addSlotPick(1, pick)
      guided.goToStep("build")
    },
    [db, guided],
  )

  const advanceBuildOrFinish = useCallback(() => {
    if (guided.currentBuildSlot >= 6) {
      guided.goToStep("sets")
    } else {
      guided.nextBuildSlot()
    }
  }, [guided])

  const handleBuildPick = useCallback(
    async (pick: GuidedPokemonPick) => {
      const position = guided.currentBuildSlot
      await db
        .persistSlotToDb(position, pick.pokemonId)
        .catch((err) => console.error("[guided-builder] persistSlot:", err))
      guided.addSlotPick(position, pick)
      advanceBuildOrFinish()
    },
    [db, guided, advanceBuildOrFinish],
  )

  const handleSkipSlot = advanceBuildOrFinish

  const saveAndNavigate = useCallback(
    async (path: string) => {
      db.setIsSaving(true)
      try {
        await db.saveAllSlots()
        guided.clearDraft()
        router.push(path)
      } catch {
        db.setIsSaving(false)
      }
    },
    [db, guided, router],
  )

  const handleSave = useCallback(
    () => saveAndNavigate(`/teams/${teamId}`),
    [saveAndNavigate, teamId],
  )

  const handleTestTeam = useCallback(
    () => saveAndNavigate(`/battle/new?teamId=${teamId}`),
    [saveAndNavigate, teamId],
  )

  const handleImportSample = useCallback(
    async (sample: SampleTeamEntry) => {
      for (let i = 0; i < sample.pokemonIds.length && i < 6; i++) {
        await db
          .persistSlotToDb(i + 1, sample.pokemonIds[i])
          .catch((err) => console.error("[guided-builder] persistSlot:", err))
      }
      guided.importSampleTeam(sample)
    },
    [db, guided],
  )

  const handleSwitchToFreeform = useCallback(async () => {
    try {
      await db.saveAllSlots()
    } catch {
      /* continue anyway */
    }
    guided.clearDraft()
    router.push(`/teams/${teamId}`)
  }, [db, guided, router, teamId])

  return {
    handleLeadPick,
    handleBuildPick,
    handleSkipSlot,
    handleSave,
    handleTestTeam,
    handleImportSample,
    handleSwitchToFreeform,
  }
}
