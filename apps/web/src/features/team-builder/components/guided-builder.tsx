"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowRight, Check, Shuffle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import {
  DEFAULT_EVS,
  DEFAULT_IVS,
  type TeamSlotInput,
  type NatureName,
  type StatsTable,
} from "@nasty-plot/core"
import {
  useGuidedBuilder,
  type GuidedStep,
  type GuidedPokemonPick,
  type SampleTeamEntry,
} from "../hooks/use-guided-builder"
import { useAddSlot, useUpdateSlot } from "@/features/teams/hooks/use-teams"
import { StepStart } from "./guided/step-start"
import { StepPickPokemon } from "./guided/step-pick-pokemon"
import { StepCustomizeSets } from "./guided/step-customize-sets"
import { StepReview } from "./guided/step-review"
import { AskPecharuntButton } from "./guided/ask-pecharunt-button"

interface GuidedBuilderProps {
  teamId: string
  formatId: string
}

const STEP_LABELS: Record<GuidedStep, string> = {
  start: "Get Started",
  lead: "Choose Lead",
  build: "Build Team",
  sets: "Customize Sets",
  review: "Review & Save",
}

const STEP_ORDER: GuidedStep[] = ["start", "lead", "build", "sets", "review"]

// --- Step indicator ---

function StepIndicator({
  current,
  onGoToStep,
}: {
  current: GuidedStep
  onGoToStep: (step: GuidedStep) => void
}) {
  const currentIdx = STEP_ORDER.indexOf(current)
  const progress = (currentIdx / (STEP_ORDER.length - 1)) * 100

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        {STEP_ORDER.map((step, i) => {
          const isActive = step === current
          const isComplete = i < currentIdx
          const canNavigate = isComplete

          return (
            <button
              key={step}
              type="button"
              disabled={!canNavigate}
              onClick={() => canNavigate && onGoToStep(step)}
              className={cn(
                "flex flex-col items-center gap-1 group",
                canNavigate && "cursor-pointer",
              )}
            >
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors",
                  isActive && "bg-primary text-primary-foreground",
                  isComplete && "bg-primary/20 text-primary group-hover:bg-primary/40",
                  !isActive && !isComplete && "bg-muted text-muted-foreground",
                )}
              >
                {isComplete ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={cn(
                  "text-xs hidden sm:block",
                  isActive ? "font-medium text-foreground" : "text-muted-foreground",
                  canNavigate && "group-hover:text-foreground",
                )}
              >
                {STEP_LABELS[step]}
              </span>
            </button>
          )
        })}
      </div>
      <Progress value={progress} className="h-1" />
    </div>
  )
}

// --- Main component ---

export function GuidedBuilder({ teamId, formatId }: GuidedBuilderProps) {
  const router = useRouter()
  const addSlot = useAddSlot()
  const updateSlotMutation = useUpdateSlot()

  const guided = useGuidedBuilder(teamId, formatId)
  const [isSaving, setIsSaving] = useState(false)

  // --- Incremental DB persistence ---
  // Persist slots to DB as they're picked so /api/recommend and
  // /api/teams/[teamId]/analysis have real data to work with.

  const persistSlotToDb = useCallback(
    async (position: number, pokemonId: string) => {
      const slotInput: TeamSlotInput = {
        position,
        pokemonId,
        ability: "",
        item: "",
        nature: "Adamant" as NatureName,
        level: 100,
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

  // --- Handlers ---

  const handleLeadPick = async (pick: GuidedPokemonPick) => {
    await persistSlotToDb(1, pick.pokemonId).catch(() => {})
    guided.addSlotPick(1, pick)
    guided.goToStep("build")
  }

  const handleBuildPick = async (pick: GuidedPokemonPick) => {
    const position = guided.currentBuildSlot
    await persistSlotToDb(position, pick.pokemonId).catch(() => {})
    guided.addSlotPick(position, pick)
    if (position >= 6) {
      guided.goToStep("sets")
    } else {
      guided.nextBuildSlot()
    }
  }

  const handleSkipSlot = () => {
    if (guided.currentBuildSlot >= 6) {
      guided.goToStep("sets")
    } else {
      guided.nextBuildSlot()
    }
  }

  // Save all slots to DB with full set data (for final save/test/switch)
  const saveAllSlots = async () => {
    for (const slot of guided.filledSlots) {
      if (!slot.pokemonId || !slot.position) continue
      const slotInput: TeamSlotInput = {
        position: slot.position,
        pokemonId: slot.pokemonId,
        ability: slot.ability || "",
        item: slot.item || "",
        nature: (slot.nature || "Adamant") as NatureName,
        teraType: slot.teraType,
        level: slot.level || 100,
        moves: slot.moves || [""],
        evs: (slot.evs || { ...DEFAULT_EVS }) as StatsTable,
        ivs: (slot.ivs || { ...DEFAULT_IVS }) as StatsTable,
      }
      try {
        // Slots should exist from incremental persistence — update with full set data
        await updateSlotMutation.mutateAsync({
          teamId,
          position: slot.position,
          data: slotInput,
        })
      } catch {
        // Fallback: add as new slot if not yet persisted
        await addSlot.mutateAsync({ teamId, slot: slotInput })
      }
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await saveAllSlots()
      guided.clearDraft()
      router.push(`/teams/${teamId}`)
    } catch {
      setIsSaving(false)
    }
  }

  const handleTestTeam = async () => {
    setIsSaving(true)
    try {
      await saveAllSlots()
      guided.clearDraft()
      router.push(`/battle/new?teamId=${teamId}`)
    } catch {
      setIsSaving(false)
    }
  }

  const handleImportSample = async (sample: SampleTeamEntry) => {
    // Persist sample team slots to DB first so analysis works on the sets step
    for (let i = 0; i < sample.pokemonIds.length && i < 6; i++) {
      await persistSlotToDb(i + 1, sample.pokemonIds[i]).catch(() => {})
    }
    guided.importSampleTeam(sample)
  }

  const handleSwitchToFreeform = async () => {
    // Persist current slots with any set customizations before switching
    try {
      await saveAllSlots()
    } catch {
      /* continue anyway */
    }
    guided.clearDraft()
    router.push(`/teams/${teamId}`)
  }

  // --- Navigation logic ---

  const canGoBack = (() => {
    if (guided.step === "start") return false
    if (guided.step === "build" && guided.currentBuildSlot > 2) return true
    return true
  })()

  const canGoNext = (() => {
    switch (guided.step) {
      case "start":
        return false // Handled by start step buttons
      case "lead":
        return guided.filledSlots.length >= 1
      case "build":
        return true // Can always move forward
      case "sets":
        return guided.filledSlots.length > 0
      case "review":
        return false // Save button handles this
      default:
        return false
    }
  })()

  const handleBack = () => {
    if (guided.step === "build" && guided.currentBuildSlot > 2) {
      guided.prevBuildSlot()
    } else {
      guided.prevStep()
    }
  }

  const handleNext = () => {
    if (guided.step === "build") {
      // If we have enough Pokemon, advance to sets
      if (guided.currentBuildSlot >= 6 || guided.filledSlots.length >= 6) {
        guided.goToStep("sets")
      } else {
        guided.nextBuildSlot()
      }
    } else {
      guided.nextStep()
    }
  }

  // Don't render until draft is restored
  if (guided.isRestoringDraft) return null

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <StepIndicator current={guided.step} onGoToStep={guided.goToStep} />

      {/* Step content */}
      <div className="min-h-[400px]">
        {guided.step === "start" && (
          <StepStart
            sampleTeams={guided.sampleTeams}
            isLoading={guided.isLoadingSampleTeams}
            onStartFromScratch={guided.startFromScratch}
            onImportSample={handleImportSample}
          />
        )}

        {guided.step === "lead" && (
          <StepPickPokemon
            mode="lead"
            slotNumber={1}
            recommendations={guided.recommendations}
            isLoadingRecommendations={guided.isLoadingRecommendations}
            usageData={guided.usageData}
            isLoadingUsage={guided.isLoadingUsage}
            analysis={guided.analysis}
            isLoadingAnalysis={guided.isLoadingAnalysis}
            filledSlotCount={guided.filledSlots.length}
            allSelectedIds={guided.allSelectedIds}
            formatId={formatId}
            onPick={handleLeadPick}
          />
        )}

        {guided.step === "build" && (
          <StepPickPokemon
            mode="build"
            slotNumber={guided.currentBuildSlot}
            recommendations={guided.recommendations}
            isLoadingRecommendations={guided.isLoadingRecommendations}
            usageData={guided.usageData}
            isLoadingUsage={guided.isLoadingUsage}
            analysis={guided.analysis}
            isLoadingAnalysis={guided.isLoadingAnalysis}
            filledSlotCount={guided.filledSlots.length}
            allSelectedIds={guided.allSelectedIds}
            formatId={formatId}
            onPick={handleBuildPick}
            onSkip={handleSkipSlot}
          />
        )}

        {guided.step === "sets" && (
          <StepCustomizeSets
            slots={guided.slots}
            formatId={formatId}
            onUpdate={guided.updateSlot}
            onApplyAllSets={guided.applyAllSets}
          />
        )}

        {guided.step === "review" && (
          <StepReview
            slots={guided.slots}
            analysis={guided.analysis}
            isLoadingAnalysis={guided.isLoadingAnalysis}
            usageData={guided.usageData}
            validation={guided.validationErrors}
            isSaving={isSaving}
            onSave={handleSave}
            onGoToStep={(step) => guided.goToStep(step as GuidedStep)}
            onTestTeam={handleTestTeam}
          />
        )}
      </div>

      {/* Footer navigation + meta */}
      <Separator />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {canGoBack && (
            <Button variant="outline" onClick={handleBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          )}
        </div>

        {/* Center: running team count + ask pecharunt */}
        <div className="hidden sm:flex items-center gap-3">
          {guided.filledSlots.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {guided.filledSlots.length}/6 Pokemon
            </span>
          )}
          <AskPecharuntButton step={guided.step} />
        </div>

        <div className="flex items-center gap-2">
          {/* Switch to freeform escape hatch */}
          {guided.step !== "start" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSwitchToFreeform}
              className="text-xs text-muted-foreground"
            >
              <Shuffle className="mr-1 h-3 w-3" />
              Freeform
            </Button>
          )}

          {/* Next button (not on start or review) */}
          {guided.step !== "start" && guided.step !== "review" && (
            <Button onClick={handleNext} disabled={!canGoNext}>
              {guided.step === "sets" ? "Review" : "Next"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Mobile: ask pecharunt at bottom */}
      <div className="sm:hidden">
        <AskPecharuntButton step={guided.step} />
      </div>
    </div>
  )
}
