"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Sparkles,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { TypeBadge } from "@nasty-plot/ui";
import { useGuidedBuilder } from "../hooks/use-guided-builder";
import { CorePicker } from "./core-picker";
import { RoleSelector } from "./role-selector";
import { useAddSlot } from "@/features/teams/hooks/use-teams";
import { DEFAULT_EVS, DEFAULT_IVS, type TeamSlotInput, type PokemonType, type NatureName, type StatsTable } from "@nasty-plot/core";

interface GuidedBuilderProps {
  teamId: string;
  formatId: string;
}

const STEP_LABELS = [
  "Choose Your Core",
  "Fill the Roles",
  "Fine-Tune Your Team",
  "Review & Save",
];

// --- Step indicator ---

function StepIndicator({ current, total }: { current: number; total: number }) {
  const progress = ((current - 1) / (total - 1)) * 100;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        {STEP_LABELS.map((label, i) => {
          const stepNum = i + 1;
          const isActive = stepNum === current;
          const isComplete = stepNum < current;

          return (
            <div key={label} className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors",
                  isActive && "bg-primary text-primary-foreground",
                  isComplete && "bg-primary/20 text-primary",
                  !isActive && !isComplete && "bg-muted text-muted-foreground"
                )}
              >
                {isComplete ? <Check className="h-4 w-4" /> : stepNum}
              </div>
              <span
                className={cn(
                  "text-xs hidden sm:block",
                  isActive ? "font-medium text-foreground" : "text-muted-foreground"
                )}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
      <Progress value={progress} className="h-1" />
    </div>
  );
}

// --- Step 1: Choose Core ---

function StepChooseCore({
  usageData,
  isLoading,
  corePicks,
  onToggle,
}: {
  usageData: { pokemonId: string; pokemonName?: string; usagePercent: number; rank: number }[];
  isLoading: boolean;
  corePicks: ReturnType<typeof useGuidedBuilder>["corePicks"];
  onToggle: ReturnType<typeof useGuidedBuilder>["toggleCorePick"];
}) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {Array.from({ length: 15 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Choose Your Core
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Start by picking 1-3 Pokemon that form the foundation of your team.
          These are typically your win conditions or the Pokemon your team is built around.
        </p>
      </div>
      <CorePicker
        pokemon={usageData}
        selected={corePicks}
        onToggle={onToggle}
      />
    </div>
  );
}

// --- Step 2: Fill Roles ---

function StepFillRoles({
  suggestedRoles,
  usageData,
  rolePicks,
  allSelectedIds,
  onSetRolePick,
}: {
  suggestedRoles: ReturnType<typeof useGuidedBuilder>["suggestedRoles"];
  usageData: { pokemonId: string; pokemonName?: string; usagePercent: number; rank: number }[];
  rolePicks: ReturnType<typeof useGuidedBuilder>["rolePicks"];
  allSelectedIds: Set<string>;
  onSetRolePick: ReturnType<typeof useGuidedBuilder>["setRolePick"];
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Fill the Roles
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Based on your core, here are the roles your team needs.
          Pick one Pokemon per role, or skip roles that your core already covers.
        </p>
      </div>
      <div className="space-y-3">
        {suggestedRoles.map((role) => (
          <RoleSelector
            key={role.id}
            role={role}
            candidates={usageData}
            selected={rolePicks[role.id] ?? null}
            onSelect={(pokemon) => onSetRolePick(role.id, pokemon)}
            disabledIds={allSelectedIds}
          />
        ))}
      </div>
    </div>
  );
}

// --- Step 3: Fine-Tune ---

function StepFineTune({
  teamSlots,
  formatId,
  onApplySet,
}: {
  teamSlots: ReturnType<typeof useGuidedBuilder>["teamSlots"];
  formatId: string;
  onApplySet: (position: number, pokemonId: string) => void;
}) {
  // Auto-apply sets on mount
  useEffect(() => {
    teamSlots.forEach((slot) => {
      if (slot.position && slot.pokemonId && !slot.ability) {
        onApplySet(slot.position, slot.pokemonId);
      }
    });
    // Only run on initial render of this step
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function formatName(id: string): string {
    return id
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (s) => s.toUpperCase())
      .trim();
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Fine-Tune Your Team
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Recommended sets have been applied from Smogon. Review each Pokemon
          and switch to the freeform editor to customize individual sets.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {teamSlots.map((slot) => (
          <Card key={slot.position} className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                {formatName(slot.pokemonId ?? "Unknown")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {slot.ability ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Ability</span>
                    <span className="font-medium">{slot.ability}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Item</span>
                    <span className="font-medium">{slot.item || "None"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Nature</span>
                    <span className="font-medium">{slot.nature}</span>
                  </div>
                  {slot.teraType && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Tera Type</span>
                      <TypeBadge type={slot.teraType} size="sm" />
                    </div>
                  )}
                  <Separator />
                  <div>
                    <span className="text-muted-foreground">Moves</span>
                    <ul className="mt-1 space-y-0.5">
                      {slot.moves
                        ?.filter((m): m is string => !!m)
                        .map((move, i) => (
                          <li key={i} className="font-medium">
                            {move}
                          </li>
                        ))}
                    </ul>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2 py-4 justify-center text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading set...
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {teamSlots.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No Pokemon selected. Go back to pick your team.
        </div>
      )}
    </div>
  );
}

// --- Step 4: Review & Save ---

function StepReview({
  teamSlots,
  typeCoverage,
  isSaving,
  onSave,
}: {
  teamSlots: ReturnType<typeof useGuidedBuilder>["teamSlots"];
  typeCoverage: PokemonType[];
  isSaving: boolean;
  onSave: () => void;
}) {
  function formatName(id: string): string {
    return id
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (s) => s.toUpperCase())
      .trim();
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Review & Save
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Here is your assembled team. Review everything before saving.
        </p>
      </div>

      {/* Type coverage summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Type Coverage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1">
            {typeCoverage.map((t) => (
              <TypeBadge key={t} type={t} size="sm" />
            ))}
            {typeCoverage.length === 0 && (
              <span className="text-xs text-muted-foreground">No types selected</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Team overview */}
      <div className="space-y-2">
        {teamSlots.map((slot) => (
          <Card key={slot.position} className="p-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h4 className="font-medium text-sm truncate">
                  {formatName(slot.pokemonId ?? "Unknown")}
                </h4>
                <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                  {slot.ability && <span>{slot.ability}</span>}
                  {slot.item && (
                    <>
                      <span className="text-border">|</span>
                      <span>{slot.item}</span>
                    </>
                  )}
                  {slot.nature && (
                    <>
                      <span className="text-border">|</span>
                      <span>{slot.nature}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-1 shrink-0">
                {slot.moves
                  ?.filter((m): m is string => !!m)
                  .map((move, i) => (
                    <Badge key={i} variant="outline" className="text-[10px]">
                      {move}
                    </Badge>
                  ))}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Button
        className="w-full"
        size="lg"
        onClick={onSave}
        disabled={isSaving || teamSlots.length === 0}
      >
        {isSaving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving Team...
          </>
        ) : (
          <>
            <Save className="mr-2 h-4 w-4" />
            Save Team ({teamSlots.length} Pokemon)
          </>
        )}
      </Button>
    </div>
  );
}

// --- Main component ---

export function GuidedBuilder({ teamId, formatId }: GuidedBuilderProps) {
  const router = useRouter();
  const addSlot = useAddSlot();

  const {
    step,
    corePicks,
    rolePicks,
    teamSlots,
    suggestedRoles,
    allSelectedIds,
    typeCoverage,
    usageData,
    isLoadingUsage,
    nextStep,
    prevStep,
    toggleCorePick,
    setRolePick,
    assembleTeam,
    applySet,
  } = useGuidedBuilder(formatId);

  const [isSaving, setIsSaving] = useState(false);

  const canProceed = (() => {
    switch (step) {
      case 1: return corePicks.length >= 1;
      case 2: return true; // Roles are optional
      case 3: return teamSlots.length > 0;
      case 4: return teamSlots.length > 0;
      default: return false;
    }
  })();

  const handleNext = () => {
    if (step === 2) {
      // Moving from roles to fine-tune: assemble the team
      assembleTeam();
    }
    nextStep();
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save each slot to the team via the API
      for (const slot of teamSlots) {
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
      // Redirect to the main team editor
      router.push(`/teams/${teamId}`);
    } catch {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <StepIndicator current={step} total={4} />

      {/* Step content */}
      <div className="min-h-[400px]">
        {step === 1 && (
          <StepChooseCore
            usageData={usageData}
            isLoading={isLoadingUsage}
            corePicks={corePicks}
            onToggle={toggleCorePick}
          />
        )}
        {step === 2 && (
          <StepFillRoles
            suggestedRoles={suggestedRoles}
            usageData={usageData}
            rolePicks={rolePicks}
            allSelectedIds={allSelectedIds}
            onSetRolePick={setRolePick}
          />
        )}
        {step === 3 && (
          <StepFineTune
            teamSlots={teamSlots}
            formatId={formatId}
            onApplySet={applySet}
          />
        )}
        {step === 4 && (
          <StepReview
            teamSlots={teamSlots}
            typeCoverage={typeCoverage}
            isSaving={isSaving}
            onSave={handleSave}
          />
        )}
      </div>

      {/* Navigation */}
      <Separator />
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={prevStep}
          disabled={step === 1}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        {/* Running team preview */}
        <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
          {corePicks.length > 0 && (
            <span>{corePicks.length + Object.values(rolePicks).filter(Boolean).length} Pokemon</span>
          )}
        </div>

        {step < 4 ? (
          <Button onClick={handleNext} disabled={!canProceed}>
            Next
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <div /> // Save button is in the step content
        )}
      </div>
    </div>
  );
}

