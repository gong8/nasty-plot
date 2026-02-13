"use client"

import { useState, useCallback, useMemo, useEffect, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  DEFAULT_EVS,
  DEFAULT_IVS,
  DEFAULT_LEVEL,
  type UsageStatsEntry,
  type PaginatedResponse,
  type SmogonSetData,
  type TeamSlotData,
  type NatureName,
  type PokemonType,
  type StatsTable,
  type TeamAnalysis,
  type Recommendation,
  parseShowdownPaste,
} from "@nasty-plot/core"
import { fetchJson, fetchApiData, postApiData } from "@/lib/api-client"

// --- Types ---

export type GuidedStep = "start" | "lead" | "build" | "sets" | "review"

export interface GuidedPokemonPick {
  pokemonId: string
  pokemonName: string
  types: PokemonType[]
  usagePercent?: number
  num?: number
}

export interface SampleTeamEntry {
  id: string
  name: string
  formatId: string
  archetype?: string
  source?: string
  sourceUrl?: string
  paste: string
  pokemonIds: string[]
}

const STEP_ORDER: GuidedStep[] = ["start", "lead", "build", "sets", "review"]

const DRAFT_STORAGE_KEY = "nasty-plot-guided-draft"
const DRAFT_SAVE_DELAY_MS = 500

interface DraftState {
  teamId: string
  step: GuidedStep
  slots: Partial<TeamSlotData>[]
  currentBuildSlot: number
  startedFromSample: boolean
}

// --- Fetchers ---

async function fetchUsage(formatId: string, limit: number): Promise<UsageStatsEntry[]> {
  const json = await fetchJson<PaginatedResponse<UsageStatsEntry>>(
    `/api/formats/${formatId}/usage?limit=${limit}`,
  )
  return json.data
}

async function fetchSets(pokemonId: string, format: string): Promise<SmogonSetData[]> {
  try {
    return await fetchApiData<SmogonSetData[]>(`/api/pokemon/${pokemonId}/sets?format=${format}`)
  } catch {
    return []
  }
}

async function fetchRecommendations(teamId: string, limit: number = 5): Promise<Recommendation[]> {
  try {
    return await postApiData<Recommendation[]>("/api/recommend", { teamId, limit })
  } catch {
    return []
  }
}

async function fetchAnalysis(teamId: string): Promise<TeamAnalysis | null> {
  try {
    return await fetchApiData<TeamAnalysis>(`/api/teams/${teamId}/analysis`)
  } catch {
    return null
  }
}

async function fetchSampleTeams(formatId: string): Promise<SampleTeamEntry[]> {
  try {
    const teams = await fetchJson<Record<string, unknown>[]>(
      `/api/sample-teams?formatId=${encodeURIComponent(formatId)}`,
    )
    return teams.map((t) => ({
      ...t,
      pokemonIds:
        typeof t.pokemonIds === "string" ? (t.pokemonIds as string).split(",") : t.pokemonIds,
    })) as SampleTeamEntry[]
  } catch {
    return []
  }
}

// --- Hook ---

export function useGuidedBuilder(teamId: string, formatId: string) {
  // --- Core state ---
  const [step, setStep] = useState<GuidedStep>("start")
  const [slots, setSlots] = useState<Partial<TeamSlotData>[]>([])
  const [currentBuildSlot, setCurrentBuildSlot] = useState(2) // 2-6 for build phase
  const [startedFromSample, setStartedFromSample] = useState(false)
  const [isRestoringDraft, setIsRestoringDraft] = useState(true)

  // --- Draft persistence ---

  // Restore draft on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(DRAFT_STORAGE_KEY)
      if (stored) {
        const draft: DraftState = JSON.parse(stored)
        if (draft.teamId === teamId) {
          setStep(draft.step) // eslint-disable-line react-hooks/set-state-in-effect -- restore draft from localStorage
          setSlots(draft.slots)
          setCurrentBuildSlot(draft.currentBuildSlot)
          setStartedFromSample(draft.startedFromSample)
        }
      }
    } catch {
      // Ignore parse errors
    }
    setIsRestoringDraft(false)
  }, [teamId])

  // Save draft on state changes
  const saveDraftRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => {
    if (isRestoringDraft) return
    clearTimeout(saveDraftRef.current)
    saveDraftRef.current = setTimeout(() => {
      const draft: DraftState = {
        teamId,
        step,
        slots,
        currentBuildSlot,
        startedFromSample,
      }
      try {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft))
      } catch {
        // localStorage full or unavailable
      }
    }, DRAFT_SAVE_DELAY_MS)
    return () => clearTimeout(saveDraftRef.current)
  }, [teamId, step, slots, currentBuildSlot, startedFromSample, isRestoringDraft])

  const clearDraft = useCallback(() => {
    localStorage.removeItem(DRAFT_STORAGE_KEY)
  }, [])

  // --- Data fetching ---

  // Usage data for format (used by recommendation cards when API not available)
  const usageQuery = useQuery({
    queryKey: ["guided-usage", formatId],
    queryFn: () => fetchUsage(formatId, 50),
    enabled: !!formatId,
  })

  // Sample teams for the format
  const sampleTeamsQuery = useQuery({
    queryKey: ["guided-sample-teams", formatId],
    queryFn: () => fetchSampleTeams(formatId),
    enabled: !!formatId && step === "start",
  })

  // Recommendations for the current team (updates as slots are added)
  const filledSlotCount = slots.filter((s) => s.pokemonId).length
  const slotFingerprint = slots
    .filter((s) => s.pokemonId)
    .map((s) => s.pokemonId!)
    .sort()
    .join(",")
  const recommendationsQuery = useQuery({
    queryKey: ["guided-recommendations", teamId, slotFingerprint],
    queryFn: () => fetchRecommendations(teamId, 5),
    enabled: !!teamId && filledSlotCount > 0 && (step === "build" || step === "lead"),
  })

  // Real-time analysis
  const analysisQuery = useQuery({
    queryKey: ["guided-analysis", teamId, slotFingerprint],
    queryFn: () => fetchAnalysis(teamId),
    enabled: !!teamId && filledSlotCount > 0,
  })

  // --- Navigation ---

  const goToStep = useCallback((newStep: GuidedStep) => {
    setStep(newStep)
  }, [])

  const nextStep = useCallback(() => {
    setStep((current) => {
      const idx = STEP_ORDER.indexOf(current)
      if (idx < STEP_ORDER.length - 1) return STEP_ORDER[idx + 1]
      return current
    })
  }, [])

  const prevStep = useCallback(() => {
    setStep((current) => {
      const idx = STEP_ORDER.indexOf(current)
      if (idx > 0) return STEP_ORDER[idx - 1]
      return current
    })
  }, [])

  const stepIndex = STEP_ORDER.indexOf(step)

  // Build phase sub-navigation
  const nextBuildSlot = useCallback(() => {
    setCurrentBuildSlot((prev) => Math.min(prev + 1, 6))
  }, [])

  const prevBuildSlot = useCallback(() => {
    setCurrentBuildSlot((prev) => Math.max(prev - 1, 2))
  }, [])

  // --- Slot management ---

  const addSlotPick = useCallback((position: number, pick: GuidedPokemonPick) => {
    setSlots((prev) => {
      // Remove any existing slot at this position
      const filtered = prev.filter((s) => s.position !== position)
      const newSlot: Partial<TeamSlotData> = {
        position,
        pokemonId: pick.pokemonId,
        ability: "",
        item: "",
        nature: "Adamant" as NatureName,
        level: DEFAULT_LEVEL,
        moves: [""] as TeamSlotData["moves"],
        evs: { ...DEFAULT_EVS } as StatsTable,
        ivs: { ...DEFAULT_IVS } as StatsTable,
      }
      return [...filtered, newSlot].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    })
  }, [])

  const removeSlot = useCallback((position: number) => {
    setSlots((prev) => prev.filter((s) => s.position !== position))
  }, [])

  const updateSlot = useCallback((position: number, updates: Partial<TeamSlotData>) => {
    setSlots((prev) =>
      prev.map((slot) => (slot.position === position ? { ...slot, ...updates } : slot)),
    )
  }, [])

  // --- Set application ---

  const applySet = useCallback(
    async (position: number, pokemonId: string) => {
      try {
        const sets = await fetchSets(pokemonId, formatId)
        if (sets.length === 0) return null

        const set = sets[0] // Most popular set
        const moves = set.moves.map((m) => (Array.isArray(m) ? m[0] : m))

        const updates: Partial<TeamSlotData> = {
          ability: set.ability,
          item: set.item,
          nature: set.nature,
          teraType: set.teraType,
          moves: [moves[0] ?? "", moves[1], moves[2], moves[3]] as TeamSlotData["moves"],
          evs: { ...DEFAULT_EVS, ...set.evs } as StatsTable,
          ivs: { ...DEFAULT_IVS, ...(set.ivs ?? {}) } as StatsTable,
        }

        updateSlot(position, updates)
        return set
      } catch {
        return null
      }
    },
    [formatId, updateSlot],
  )

  const applyAllSets = useCallback(async () => {
    const promises = slots
      .filter((s) => s.pokemonId && !s.ability) // Only apply if no ability set yet
      .map((s) => applySet(s.position!, s.pokemonId!))
    await Promise.allSettled(promises)
  }, [slots, applySet])

  // --- Sample team import ---

  const importSampleTeam = useCallback(async (sampleTeam: SampleTeamEntry) => {
    // Parse the full paste to get complete sets (moves, EVs, abilities, etc.)
    const parsed = parseShowdownPaste(sampleTeam.paste)
    const newSlots: Partial<TeamSlotData>[] = parsed.slice(0, 6).map((slot, i) => ({
      ...slot,
      position: i + 1,
    }))
    setSlots(newSlots)
    setStartedFromSample(true)
    setStep("sets") // Jump directly to set customization
  }, [])

  // --- Start paths ---

  const startFromScratch = useCallback(() => {
    setSlots([])
    setStartedFromSample(false)
    setStep("lead")
  }, [])

  // --- Derived state ---

  const filledSlots = useMemo(() => slots.filter((s) => s.pokemonId), [slots])

  const allSelectedIds = useMemo(() => new Set(filledSlots.map((s) => s.pokemonId!)), [filledSlots])

  const typeCoverage = useMemo(() => {
    const types = filledSlots.flatMap((s) => {
      // Use types from usage data if available
      const usage = usageQuery.data?.find((u) => u.pokemonId === s.pokemonId)
      return usage?.types ?? []
    })
    return [...new Set(types)]
  }, [filledSlots, usageQuery.data])

  // --- Validation ---

  const validationErrors = useMemo(() => {
    const errors: string[] = []
    const warnings: string[] = []

    if (filledSlots.length === 0) {
      errors.push("Your team has no Pokemon. Add at least one to save.")
      return { errors, warnings, isValid: false }
    }

    const ids = filledSlots.map((s) => s.pokemonId)
    const duplicates = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))]
    if (duplicates.length > 0) {
      errors.push(`Duplicate species: ${duplicates.join(", ")}`)
    }

    for (const slot of filledSlots) {
      if (!slot.moves?.some((m) => m?.trim())) {
        warnings.push(`No moves set for ${slot.pokemonId}`)
      }
      if (!slot.ability) {
        warnings.push(`No ability set for ${slot.pokemonId}`)
      }
    }

    if (filledSlots.length < 6) {
      warnings.push(`Team has only ${filledSlots.length}/6 Pokemon`)
    }

    return { errors, warnings, isValid: errors.length === 0 }
  }, [filledSlots])

  // --- Context for chat ---

  const chatContext = useMemo(() => {
    const slotSummaries = filledSlots.map((s) => {
      const movesStr = s.moves?.filter(Boolean).join(", ") || "No moves"
      return `${s.pokemonId} (${s.ability || "no ability"}, ${s.item || "no item"}) - ${movesStr}`
    })

    return {
      step,
      teamSize: filledSlots.length,
      currentBuildSlot,
      slotSummaries,
      formatId,
    }
  }, [step, filledSlots, currentBuildSlot, formatId])

  return {
    // State
    step,
    stepIndex,
    slots,
    filledSlots,
    currentBuildSlot,
    allSelectedIds,
    typeCoverage,
    startedFromSample,
    isRestoringDraft,
    chatContext,

    // Data
    usageData: usageQuery.data ?? [],
    isLoadingUsage: usageQuery.isLoading,
    sampleTeams: sampleTeamsQuery.data ?? [],
    isLoadingSampleTeams: sampleTeamsQuery.isLoading,
    recommendations: recommendationsQuery.data ?? [],
    isLoadingRecommendations: recommendationsQuery.isLoading,
    analysis: analysisQuery.data ?? null,
    isLoadingAnalysis: analysisQuery.isLoading,

    // Validation
    validationErrors,

    // Navigation
    nextStep,
    prevStep,
    goToStep,
    nextBuildSlot,
    prevBuildSlot,

    // Actions
    addSlotPick,
    removeSlot,
    updateSlot,
    applySet,
    applyAllSets,
    setSlots,
    importSampleTeam,
    startFromScratch,
    clearDraft,
  }
}
