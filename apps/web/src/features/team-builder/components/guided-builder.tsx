"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Shuffle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  DEFAULT_EVS, DEFAULT_IVS,
  type TeamSlotInput, type NatureName, type StatsTable,
} from "@nasty-plot/core";
import { useGuidedBuilder, type GuidedStep, type GuidedPokemonPick } from "../hooks/use-guided-builder";
import { useAddSlot } from "@/features/teams/hooks/use-teams";
import { StepStart } from "./guided/step-start";
import { StepPickPokemon } from "./guided/step-pick-pokemon";
import { StepCustomizeSets } from "./guided/step-customize-sets";
import { StepReview } from "./guided/step-review";
import { AskPecharuntButton } from "./guided/ask-pecharunt-button";

interface GuidedBuilderProps {
  teamId: string;
  formatId: string;
}

const STEP_LABELS: Record<GuidedStep, string> = {
  start: "Get Started",
  lead: "Choose Lead",
  build: "Build Team",
  sets: "Customize Sets",
  review: "Review & Save",
};

const STEP_ORDER: GuidedStep[] = ["start", "lead", "build", "sets", "review"];

// --- Step indicator ---

function StepIndicator({ current }: { current: GuidedStep }) {
  const currentIdx = STEP_ORDER.indexOf(current);
  const progress = (currentIdx / (STEP_ORDER.length - 1)) * 100;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        {STEP_ORDER.map((step, i) => {
          const isActive = step === current;
          const isComplete = i < currentIdx;

          return (
            <div key={step} className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors",
                  isActive && "bg-primary text-primary-foreground",
                  isComplete && "bg-primary/20 text-primary",
                  !isActive && !isComplete && "bg-muted text-muted-foreground"
                )}
              >
                {isComplete ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={cn(
                  "text-xs hidden sm:block",
                  isActive ? "font-medium text-foreground" : "text-muted-foreground"
                )}
              >
                {STEP_LABELS[step]}
              </span>
            </div>
          );
        })}
      </div>
      <Progress value={progress} className="h-1" />
    </div>
  );
}

// --- Main component ---

export function GuidedBuilder({ teamId, formatId }: GuidedBuilderProps) {
  const router = useRouter();
  const addSlot = useAddSlot();

  const guided = useGuidedBuilder(teamId, formatId);
  const [isSaving, setIsSaving] = useState(false);

  // --- Handlers ---

  const handleLeadPick = (pick: GuidedPokemonPick) => {
    guided.addSlotPick(1, pick);
    guided.goToStep("build");
  };

  const handleBuildPick = (pick: GuidedPokemonPick) => {
    guided.addSlotPick(guided.currentBuildSlot, pick);
    if (guided.currentBuildSlot >= 6) {
      guided.goToStep("sets");
    } else {
      guided.nextBuildSlot();
    }
  };

  const handleSkipSlot = () => {
    if (guided.currentBuildSlot >= 6) {
      guided.goToStep("sets");
    } else {
      guided.nextBuildSlot();
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      for (const slot of guided.filledSlots) {
        if (!slot.pokemonId) continue;
        const slotInput: TeamSlotInput = {
          position: slot.position!,
          pokemonId: slot.pokemonId,
          ability: slot.ability || "",
          item: slot.item || "",
          nature: (slot.nature || "Adamant") as NatureName,
          teraType: slot.teraType,
          level: slot.level || 100,
          moves: slot.moves || [""],
          evs: (slot.evs || { ...DEFAULT_EVS }) as StatsTable,
          ivs: (slot.ivs || { ...DEFAULT_IVS }) as StatsTable,
        };
        await addSlot.mutateAsync({ teamId, slot: slotInput });
      }
      guided.clearDraft();
      router.push(`/teams/${teamId}`);
    } catch {
      setIsSaving(false);
    }
  };

  const handleTestTeam = async () => {
    // Save first, then navigate to battle
    setIsSaving(true);
    try {
      for (const slot of guided.filledSlots) {
        if (!slot.pokemonId) continue;
        const slotInput: TeamSlotInput = {
          position: slot.position!,
          pokemonId: slot.pokemonId,
          ability: slot.ability || "",
          item: slot.item || "",
          nature: (slot.nature || "Adamant") as NatureName,
          teraType: slot.teraType,
          level: slot.level || 100,
          moves: slot.moves || [""],
          evs: (slot.evs || { ...DEFAULT_EVS }) as StatsTable,
          ivs: (slot.ivs || { ...DEFAULT_IVS }) as StatsTable,
        };
        await addSlot.mutateAsync({ teamId, slot: slotInput });
      }
      guided.clearDraft();
      router.push(`/battle/new?teamId=${teamId}`);
    } catch {
      setIsSaving(false);
    }
  };

  const handleSwitchToFreeform = () => {
    // Save current state and redirect to freeform editor
    // The slots are saved in the hook via draft persistence
    router.push(`/teams/${teamId}`);
  };

  // --- Navigation logic ---

  const canGoBack = (() => {
    if (guided.step === "start") return false;
    if (guided.step === "build" && guided.currentBuildSlot > 2) return true;
    return true;
  })();

  const canGoNext = (() => {
    switch (guided.step) {
      case "start": return false; // Handled by start step buttons
      case "lead": return guided.filledSlots.length >= 1;
      case "build": return true; // Can always move forward
      case "sets": return guided.filledSlots.length > 0;
      case "review": return false; // Save button handles this
      default: return false;
    }
  })();

  const handleBack = () => {
    if (guided.step === "build" && guided.currentBuildSlot > 2) {
      guided.prevBuildSlot();
    } else {
      guided.prevStep();
    }
  };

  const handleNext = () => {
    if (guided.step === "build") {
      // If we have enough Pokemon, advance to sets
      if (guided.currentBuildSlot >= 6 || guided.filledSlots.length >= 6) {
        guided.goToStep("sets");
      } else {
        guided.nextBuildSlot();
      }
    } else {
      guided.nextStep();
    }
  };

  // Don't render until draft is restored
  if (guided.isRestoringDraft) return null;

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <StepIndicator current={guided.step} />

      {/* Step content */}
      <div className="min-h-[400px]">
        {guided.step === "start" && (
          <StepStart
            sampleTeams={guided.sampleTeams}
            isLoading={guided.isLoadingSampleTeams}
            onStartFromScratch={guided.startFromScratch}
            onImportSample={guided.importSampleTeam}
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
  );
}
