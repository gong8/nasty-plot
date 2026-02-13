"use client"

import { ArrowLeft, ArrowRight, Check, Shuffle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { cn } from "@nasty-plot/ui"
import type { GuidedStep } from "../hooks/use-guided-builder"
import { useGuidedBuilderContext } from "../context/guided-builder-provider"
import { StepStart } from "./guided/step-start"
import { StepPickPokemon } from "./guided/step-pick-pokemon"
import { StepCustomizeSets } from "./guided/step-customize-sets"
import { StepReview } from "./guided/step-review"

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

          return (
            <button
              key={step}
              type="button"
              disabled={!isComplete}
              onClick={() => isComplete && onGoToStep(step)}
              className={cn(
                "flex flex-col items-center gap-1 group",
                isComplete && "cursor-pointer",
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
                  isComplete && "group-hover:text-foreground",
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

export function GuidedBuilder() {
  const ctx = useGuidedBuilderContext()

  // --- Navigation logic ---

  const canGoBack = ctx.step !== "start"

  const canGoNext =
    (ctx.step === "lead" && ctx.filledSlots.length >= 1) ||
    ctx.step === "build" ||
    (ctx.step === "sets" && ctx.filledSlots.length > 0)

  const handleBack = () => {
    if (ctx.step === "build" && ctx.currentBuildSlot > 2) {
      ctx.prevBuildSlot()
    } else {
      ctx.prevStep()
    }
  }

  const handleNext = () => {
    if (ctx.step === "build") {
      // If we have enough Pokemon, advance to sets
      if (ctx.currentBuildSlot >= 6 || ctx.filledSlots.length >= 6) {
        ctx.goToStep("sets")
      } else {
        ctx.nextBuildSlot()
      }
    } else {
      ctx.nextStep()
    }
  }

  // Don't render until draft is restored
  if (ctx.isRestoringDraft) return null

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <StepIndicator current={ctx.step} onGoToStep={ctx.goToStep} />

      {/* Step content */}
      <div className="min-h-[400px]">
        {ctx.step === "start" && (
          <StepStart
            sampleTeams={ctx.sampleTeams}
            isLoading={ctx.isLoadingSampleTeams}
            onStartFromScratch={ctx.startFromScratch}
            onImportSample={ctx.handleImportSample}
          />
        )}

        {ctx.step === "lead" && (
          <StepPickPokemon
            mode="lead"
            slotNumber={1}
            recommendations={ctx.recommendations}
            isLoadingRecommendations={ctx.isLoadingRecommendations}
            usageData={ctx.usageData}
            isLoadingUsage={ctx.isLoadingUsage}
            analysis={ctx.analysis}
            isLoadingAnalysis={ctx.isLoadingAnalysis}
            filledSlotCount={ctx.filledSlots.length}
            allSelectedIds={ctx.allSelectedIds}
            formatId={ctx.formatId}
            onPick={ctx.handleLeadPick}
          />
        )}

        {ctx.step === "build" && (
          <StepPickPokemon
            mode="build"
            slotNumber={ctx.currentBuildSlot}
            recommendations={ctx.recommendations}
            isLoadingRecommendations={ctx.isLoadingRecommendations}
            usageData={ctx.usageData}
            isLoadingUsage={ctx.isLoadingUsage}
            analysis={ctx.analysis}
            isLoadingAnalysis={ctx.isLoadingAnalysis}
            filledSlotCount={ctx.filledSlots.length}
            allSelectedIds={ctx.allSelectedIds}
            formatId={ctx.formatId}
            onPick={ctx.handleBuildPick}
            onSkip={ctx.handleSkipSlot}
          />
        )}

        {ctx.step === "sets" && (
          <StepCustomizeSets
            slots={ctx.slots}
            formatId={ctx.formatId}
            onUpdate={ctx.updateSlot}
            onApplyAllSets={ctx.applyAllSets}
          />
        )}

        {ctx.step === "review" && (
          <StepReview
            slots={ctx.slots}
            analysis={ctx.analysis}
            isLoadingAnalysis={ctx.isLoadingAnalysis}
            usageData={ctx.usageData}
            validation={ctx.validationErrors}
            isSaving={ctx.isSaving}
            onSave={ctx.handleSave}
            onGoToStep={(step) => ctx.goToStep(step as GuidedStep)}
            onTestTeam={ctx.handleTestTeam}
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

        {/* Center: running team count */}
        <div className="hidden sm:flex items-center gap-3">
          {ctx.filledSlots.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {ctx.filledSlots.length}/6 Pokemon
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Switch to freeform escape hatch */}
          {ctx.step !== "start" && (
            <Button variant="outline" size="sm" onClick={ctx.handleSwitchToFreeform}>
              <Shuffle className="mr-1 h-3.5 w-3.5" />
              Freeform
            </Button>
          )}

          {/* Next button (not on start or review) */}
          {ctx.step !== "start" && ctx.step !== "review" && (
            <Button onClick={handleNext} disabled={!canGoNext}>
              {ctx.step === "sets" ? "Review" : "Next"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
