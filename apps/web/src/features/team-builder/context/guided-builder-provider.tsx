"use client"

import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import { useRouter } from "next/navigation"
import {
  DEFAULT_EVS,
  DEFAULT_IVS,
  DEFAULT_LEVEL,
  type TeamSlotInput,
  type TeamSlotData,
  type NatureName,
  type StatsTable,
} from "@nasty-plot/core"
import {
  useGuidedBuilder,
  type GuidedStep,
  type GuidedPokemonPick,
  type SampleTeamEntry,
} from "../hooks/use-guided-builder"
import { useProactiveReactions } from "../hooks/use-proactive-reactions"
import { useAddSlot, useUpdateSlot } from "@/features/teams/hooks/use-teams"
import { useChatSidebar } from "@/features/chat/context/chat-provider"
import { useQueryClient } from "@tanstack/react-query"
import { fetchApiData } from "@/lib/api-client"

// --- Types ---

const STEP_DESCRIPTIONS: Record<GuidedStep, string> = {
  start: "Choosing a starting point",
  lead: "Picking lead Pokemon",
  build: "Building the team",
  sets: "Customizing movesets and sets",
  review: "Final review",
}

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
    types?: string[]
    ability?: string
    item?: string
    nature?: string
    teraType?: string
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
  const router = useRouter()
  const addSlot = useAddSlot()
  const updateSlotMutation = useUpdateSlot()
  const [isSaving, setIsSaving] = useState(false)

  const guided = useGuidedBuilder(teamId, formatId)

  // --- Incremental DB persistence ---

  const persistSlotToDb = useCallback(
    async (position: number, pokemonId: string) => {
      const slotInput: TeamSlotInput = {
        position,
        pokemonId,
        ability: "",
        item: "",
        nature: "Adamant" as NatureName,
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
    if (guided.isRestoringDraft || hasSyncedDraft.current) return
    hasSyncedDraft.current = true
    if (guided.filledSlots.length === 0) return
    ;(async () => {
      for (const slot of guided.filledSlots) {
        if (slot.pokemonId && slot.position) {
          await persistSlotToDb(slot.position, slot.pokemonId).catch(() => {})
        }
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guided.isRestoringDraft])

  // Save all slots with full set data
  const saveAllSlots = useCallback(async () => {
    for (const slot of guided.filledSlots) {
      if (!slot.pokemonId || !slot.position) continue
      const slotInput: TeamSlotInput = {
        position: slot.position,
        pokemonId: slot.pokemonId,
        ability: slot.ability || "",
        item: slot.item || "",
        nature: (slot.nature || "Adamant") as NatureName,
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
  }, [guided.filledSlots, teamId, addSlot, updateSlotMutation])

  // --- Compound handlers ---

  const handleLeadPick = useCallback(
    async (pick: GuidedPokemonPick) => {
      await persistSlotToDb(1, pick.pokemonId).catch(() => {})
      guided.addSlotPick(1, pick)
      guided.goToStep("build")
    },
    [persistSlotToDb, guided],
  )

  const handleBuildPick = useCallback(
    async (pick: GuidedPokemonPick) => {
      const position = guided.currentBuildSlot
      await persistSlotToDb(position, pick.pokemonId).catch(() => {})
      guided.addSlotPick(position, pick)
      if (position >= 6) {
        guided.goToStep("sets")
      } else {
        guided.nextBuildSlot()
      }
    },
    [persistSlotToDb, guided],
  )

  const handleSkipSlot = useCallback(() => {
    if (guided.currentBuildSlot >= 6) {
      guided.goToStep("sets")
    } else {
      guided.nextBuildSlot()
    }
  }, [guided])

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    try {
      await saveAllSlots()
      guided.clearDraft()
      router.push(`/teams/${teamId}`)
    } catch {
      setIsSaving(false)
    }
  }, [saveAllSlots, guided, router, teamId])

  const handleTestTeam = useCallback(async () => {
    setIsSaving(true)
    try {
      await saveAllSlots()
      guided.clearDraft()
      router.push(`/battle/new?teamId=${teamId}`)
    } catch {
      setIsSaving(false)
    }
  }, [saveAllSlots, guided, router, teamId])

  const handleImportSample = useCallback(
    async (sample: SampleTeamEntry) => {
      for (let i = 0; i < sample.pokemonIds.length && i < 6; i++) {
        await persistSlotToDb(i + 1, sample.pokemonIds[i]).catch(() => {})
      }
      guided.importSampleTeam(sample)
    },
    [persistSlotToDb, guided],
  )

  const handleSwitchToFreeform = useCallback(async () => {
    try {
      await saveAllSlots()
    } catch {
      /* continue anyway */
    }
    guided.clearDraft()
    router.push(`/teams/${teamId}`)
  }, [saveAllSlots, guided, router, teamId])

  // --- Sidebar bridge: auto-open + context sync + action handler ---

  const {
    openContextChat,
    openSidebar,
    switchSession,
    setGuidedBuilderContext,
    guidedActionNotifyRef,
    queueAutoSend,
    isChatStreaming,
  } = useChatSidebar()
  const queryClient = useQueryClient()

  // Auto-open sidebar with guided-builder session on mount
  const sessionInitRef = useRef(false)
  useEffect(() => {
    if (sessionInitRef.current) return
    sessionInitRef.current = true
    ;(async () => {
      try {
        const sessions = await fetchApiData<Array<{ id: string }>>(
          `/api/chat/sessions?teamId=${teamId}&contextMode=guided-builder`,
        )
        if (sessions.length > 0) {
          switchSession(sessions[0].id)
          openSidebar()
        } else {
          openContextChat({
            contextMode: "guided-builder",
            contextData: JSON.stringify({ teamId, formatId }),
          })
        }
      } catch {
        openContextChat({
          contextMode: "guided-builder",
          contextData: JSON.stringify({ teamId, formatId }),
        })
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, formatId])

  // --- Chat context (always-fresh for LLM) ---

  const chatContext = useMemo((): GuidedBuilderChatContext => {
    const slotSummaries = guided.filledSlots.map((s) => {
      const movesStr = s.moves?.filter(Boolean).join(", ") || "No moves"
      return `${s.pokemonId} (${s.ability || "no ability"}, ${s.item || "no item"}) - ${movesStr}`
    })

    const slots = guided.filledSlots.map((s) => {
      // Try to get types from usage data
      const usage = guided.usageData.find((u) => u.pokemonId === s.pokemonId)
      return {
        position: s.position!,
        pokemonId: s.pokemonId!,
        pokemonName: usage?.pokemonName,
        types: usage?.types as string[] | undefined,
        ability: s.ability || undefined,
        item: s.item || undefined,
        nature: s.nature || undefined,
        teraType: s.teraType || undefined,
        moves: s.moves?.filter(Boolean) as string[] | undefined,
        evs: s.evs as Record<string, number> | undefined,
      }
    })

    const analysisSummary = guided.analysis
      ? [
          guided.analysis.coverage?.sharedWeaknesses?.length
            ? `Shared weaknesses: ${guided.analysis.coverage.sharedWeaknesses.join(", ")}`
            : null,
          guided.analysis.coverage?.uncoveredTypes?.length
            ? `Missing coverage: ${guided.analysis.coverage.uncoveredTypes.join(", ")}`
            : null,
        ]
          .filter(Boolean)
          .join(". ")
      : undefined

    return {
      step: guided.step,
      stepDescription:
        guided.step === "build"
          ? `Building slot ${guided.currentBuildSlot} of 6`
          : STEP_DESCRIPTIONS[guided.step],
      teamSize: guided.filledSlots.length,
      currentBuildSlot: guided.currentBuildSlot,
      formatId,
      slots,
      slotSummaries,
      validationErrors:
        guided.validationErrors.errors.length > 0 ? guided.validationErrors.errors : undefined,
      validationWarnings:
        guided.validationErrors.warnings.length > 0 ? guided.validationErrors.warnings : undefined,
      analysisSummary: analysisSummary || undefined,
    }
  }, [guided, formatId])

  // Sync guided builder context to ChatProvider so sidebar can use it
  useEffect(() => {
    setGuidedBuilderContext(chatContext as unknown as Record<string, unknown>)
    return () => setGuidedBuilderContext(null)
  }, [chatContext, setGuidedBuilderContext])

  // Register action notify handler so sidebar MCP actions update the wizard
  useEffect(() => {
    guidedActionNotifyRef.current = (notification) => {
      const { name, input } = notification

      switch (name) {
        case "add_pokemon_to_team": {
          const pokemonId = input.pokemonId as string
          const position = (input.position as number) || guided.filledSlots.length + 1
          const usageEntry = guided.usageData.find((u) => u.pokemonId === pokemonId)
          guided.addSlotPick(position, {
            pokemonId,
            pokemonName: usageEntry?.pokemonName ?? pokemonId,
            types: (usageEntry?.types ?? []) as GuidedPokemonPick["types"],
            usagePercent: usageEntry?.usagePercent,
          })
          if (guided.step === "lead" && position === 1) {
            guided.goToStep("build")
          } else if (guided.step === "build") {
            if (guided.filledSlots.length + 1 >= 6) {
              guided.goToStep("sets")
            } else {
              guided.nextBuildSlot()
            }
          }
          break
        }
        case "update_pokemon_set": {
          const position = input.position as number
          if (!position) return
          const moves = input.moves as string[] | undefined
          guided.updateSlot(position, {
            ability: (input.ability as string) || undefined,
            item: (input.item as string) || undefined,
            nature: ((input.nature as string) || undefined) as
              | import("@nasty-plot/core").NatureName
              | undefined,
            teraType: ((input.teraType as string) || undefined) as
              | import("@nasty-plot/core").PokemonType
              | undefined,
            moves: moves
              ? ([moves[0], moves[1], moves[2], moves[3]] as [string, string?, string?, string?])
              : undefined,
            evs: input.evs as import("@nasty-plot/core").StatsTable | undefined,
            ivs: input.ivs as import("@nasty-plot/core").StatsTable | undefined,
          })
          break
        }
        case "remove_pokemon_from_team": {
          const position = input.position as number
          if (!position) return
          guided.removeSlot(position)
          break
        }
        default:
          return
      }
      queryClient.invalidateQueries({ queryKey: ["team"] })
    }
    return () => {
      guidedActionNotifyRef.current = null
    }
  }, [guided, guidedActionNotifyRef, queryClient])

  // Proactive reactions — auto-commentary when user picks Pokemon
  useProactiveReactions({
    slots: guided.slots,
    step: guided.step,
    formatId,
    isStreaming: isChatStreaming,
    sendMessage: queueAutoSend,
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
      persistSlotToDb,
      saveAllSlots,
      isSaving,
      setIsSaving,
      handleLeadPick,
      handleBuildPick,
      handleSkipSlot,
      handleSave,
      handleTestTeam,
      handleImportSample,
      handleSwitchToFreeform,
      chatContext,
    }),
    [
      teamId,
      formatId,
      guided,
      persistSlotToDb,
      saveAllSlots,
      isSaving,
      handleLeadPick,
      handleBuildPick,
      handleSkipSlot,
      handleSave,
      handleTestTeam,
      handleImportSample,
      handleSwitchToFreeform,
      chatContext,
    ],
  )

  return <GuidedBuilderCtx.Provider value={value}>{children}</GuidedBuilderCtx.Provider>
}
