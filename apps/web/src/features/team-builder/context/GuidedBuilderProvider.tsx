"use client"

import { createContext, useContext, useMemo, type ReactNode } from "react"
import type { TeamSlotData, NatureName, PokemonType } from "@nasty-plot/core"
import {
  useGuidedBuilder,
  type GuidedStep,
  type GuidedPokemonPick,
  type SampleTeamEntry,
} from "../hooks/use-guided-builder"
import { useDbPersistence } from "../hooks/use-db-persistence"
import { useGuidedBuilderHandlers } from "../hooks/use-guided-builder-handlers"
import { useChatSidebarBridge } from "../hooks/use-chat-sidebar-bridge"
import { FeatureErrorBoundary } from "@/components/FeatureErrorBoundary"

// --- Types ---

export interface GuidedBuilderContextValue {
  // Identity
  teamId: string
  formatId: string

  // State (from useGuidedBuilder)
  step: GuidedStep
  stepIndex: number
  slots: Partial<TeamSlotData>[]
  filledSlots: Partial<TeamSlotData>[]
  currentBuildSlot: number
  allSelectedIds: Set<string>
  typeCoverage: string[]
  startedFromSample: boolean
  isRestoringDraft: boolean

  // Data
  usageData: ReturnType<typeof useGuidedBuilder>["usageData"]
  isLoadingUsage: boolean
  sampleTeams: SampleTeamEntry[]
  isLoadingSampleTeams: boolean
  recommendations: ReturnType<typeof useGuidedBuilder>["recommendations"]
  isLoadingRecommendations: boolean
  analysis: ReturnType<typeof useGuidedBuilder>["analysis"]
  isLoadingAnalysis: boolean

  // Validation
  validationErrors: ReturnType<typeof useGuidedBuilder>["validationErrors"]

  // Navigation
  nextStep: () => void
  prevStep: () => void
  goToStep: (step: GuidedStep) => void
  nextBuildSlot: () => void
  prevBuildSlot: () => void

  // Actions
  addSlotPick: (position: number, pick: GuidedPokemonPick) => void
  removeSlot: (position: number) => void
  updateSlot: (position: number, updates: Partial<TeamSlotData>) => void
  applySet: (position: number, pokemonId: string) => Promise<unknown>
  applyAllSets: () => Promise<void>
  setSlots: (slots: Partial<TeamSlotData>[]) => void
  importSampleTeam: (sample: SampleTeamEntry) => void
  startFromScratch: () => void
  clearDraft: () => void

  // DB persistence (moved from guided-builder.tsx)
  persistSlotToDb: (position: number, pokemonId: string) => Promise<void>
  saveAllSlots: () => Promise<void>
  isSaving: boolean
  setIsSaving: (saving: boolean) => void

  // Handlers (compound actions)
  handleLeadPick: (pick: GuidedPokemonPick) => Promise<void>
  handleBuildPick: (pick: GuidedPokemonPick) => Promise<void>
  handleSkipSlot: () => void
  handleSave: () => Promise<void>
  handleTestTeam: () => Promise<void>
  handleImportSample: (sample: SampleTeamEntry) => Promise<void>
  handleSwitchToFreeform: () => Promise<void>

  // Chat context (always-fresh for LLM)
  chatContext: GuidedBuilderChatContext
}

export interface GuidedBuilderChatContext {
  step: string
  stepDescription: string
  teamSize: number
  currentBuildSlot: number
  formatId: string
  slots: Array<{
    position: number
    pokemonId: string
    pokemonName?: string
    types?: PokemonType[]
    ability?: string
    item?: string
    nature?: NatureName
    teraType?: PokemonType
    moves?: string[]
    evs?: Record<string, number>
  }>
  slotSummaries: string[]
  validationErrors?: string[]
  validationWarnings?: string[]
  analysisSummary?: string
}

const GuidedBuilderCtx = createContext<GuidedBuilderContextValue | null>(null)

export function useGuidedBuilderContext(): GuidedBuilderContextValue {
  const ctx = useContext(GuidedBuilderCtx)
  if (!ctx) throw new Error("useGuidedBuilderContext must be used within GuidedBuilderProvider")
  return ctx
}

// --- Provider ---

interface GuidedBuilderProviderProps {
  teamId: string
  formatId: string
  children: ReactNode
}

export function GuidedBuilderProvider({ teamId, formatId, children }: GuidedBuilderProviderProps) {
  const guided = useGuidedBuilder(teamId, formatId)

  const db = useDbPersistence({
    teamId,
    filledSlots: guided.filledSlots,
    isRestoringDraft: guided.isRestoringDraft,
  })

  const handlers = useGuidedBuilderHandlers({
    teamId,
    guided,
    db,
  })

  const { chatContext } = useChatSidebarBridge({
    teamId,
    formatId,
    guided,
  })

  // --- Context value ---

  const value = useMemo(
    (): GuidedBuilderContextValue => ({
      teamId,
      formatId,
      step: guided.step,
      stepIndex: guided.stepIndex,
      slots: guided.slots,
      filledSlots: guided.filledSlots,
      currentBuildSlot: guided.currentBuildSlot,
      allSelectedIds: guided.allSelectedIds,
      typeCoverage: guided.typeCoverage,
      startedFromSample: guided.startedFromSample,
      isRestoringDraft: guided.isRestoringDraft,
      usageData: guided.usageData,
      isLoadingUsage: guided.isLoadingUsage,
      sampleTeams: guided.sampleTeams,
      isLoadingSampleTeams: guided.isLoadingSampleTeams,
      recommendations: guided.recommendations,
      isLoadingRecommendations: guided.isLoadingRecommendations,
      analysis: guided.analysis,
      isLoadingAnalysis: guided.isLoadingAnalysis,
      validationErrors: guided.validationErrors,
      nextStep: guided.nextStep,
      prevStep: guided.prevStep,
      goToStep: guided.goToStep,
      nextBuildSlot: guided.nextBuildSlot,
      prevBuildSlot: guided.prevBuildSlot,
      addSlotPick: guided.addSlotPick,
      removeSlot: guided.removeSlot,
      updateSlot: guided.updateSlot,
      applySet: guided.applySet,
      applyAllSets: guided.applyAllSets,
      setSlots: guided.setSlots,
      importSampleTeam: guided.importSampleTeam,
      startFromScratch: guided.startFromScratch,
      clearDraft: guided.clearDraft,
      persistSlotToDb: db.persistSlotToDb,
      saveAllSlots: db.saveAllSlots,
      isSaving: db.isSaving,
      setIsSaving: db.setIsSaving,
      ...handlers,
      chatContext,
    }),
    [teamId, formatId, guided, db, handlers, chatContext],
  )

  return (
    <FeatureErrorBoundary>
      <GuidedBuilderCtx.Provider value={value}>{children}</GuidedBuilderCtx.Provider>
    </FeatureErrorBoundary>
  )
}
