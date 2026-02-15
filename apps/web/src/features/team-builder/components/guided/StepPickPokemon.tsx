"use client"

import { useMemo, useState } from "react"
import { Sparkles, Search, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SkeletonList } from "@/components/SkeletonList"
import { EmptyState } from "@/components/EmptyState"
import { cn } from "@nasty-plot/ui"
import {
  formatUsagePercent,
  type Recommendation,
  type TeamAnalysis,
  type UsageStatsEntry,
  type PokemonSpecies,
  type PokemonType,
} from "@nasty-plot/core"
import { PokemonSearchPanel } from "../PokemonSearchPanel"
import { RecommendationCard } from "./RecommendationCard"
import { RoleSuggestionBanner } from "./RoleSuggestionBanner"
import { SimplifiedAnalysis } from "./SimplifiedAnalysis"
import type { GuidedPokemonPick } from "../../hooks/use-guided-builder"

type PickMode = "lead" | "build"

interface StepPickPokemonProps {
  /** "lead" for slot 1, "build" for slots 2-6 */
  mode: PickMode
  slotNumber: number // 1-6
  recommendations: Recommendation[]
  isLoadingRecommendations: boolean
  usageData: UsageStatsEntry[]
  isLoadingUsage: boolean
  analysis: TeamAnalysis | null
  isLoadingAnalysis: boolean
  filledSlotCount: number
  allSelectedIds: Set<string>
  formatId?: string
  onPick: (pick: GuidedPokemonPick) => void
  onSkip?: () => void
}

export function StepPickPokemon({
  mode,
  slotNumber,
  recommendations,
  isLoadingRecommendations,
  usageData,
  isLoadingUsage,
  analysis,
  isLoadingAnalysis,
  filledSlotCount,
  allSelectedIds,
  formatId,
  onPick,
  onSkip,
}: StepPickPokemonProps) {
  const [showManualSearch, setShowManualSearch] = useState(false)

  const isLead = mode === "lead"

  // Filter recommendations to exclude already-selected Pokemon
  const filteredRecs = recommendations.filter((r) => !allSelectedIds.has(r.pokemonId))

  // Fallback: if no recommendations, use top usage data
  const fallbackPicks: Recommendation[] =
    filteredRecs.length === 0
      ? usageData
          .filter((u) => !allSelectedIds.has(u.pokemonId))
          .slice(0, 5)
          .map((u) => ({
            pokemonId: u.pokemonId,
            pokemonName: u.pokemonName ?? u.pokemonId,
            score: Math.min(u.usagePercent * 2, 100),
            reasons: [
              {
                type: "usage" as const,
                description: `${formatUsagePercent(u.usagePercent)} usage in this format`,
                weight: 1,
              },
            ],
          }))
      : []

  const displayRecs = filteredRecs.length > 0 ? filteredRecs : fallbackPicks
  const isLoading = isLoadingRecommendations || (filteredRecs.length === 0 && isLoadingUsage)

  const handleManualSelect = (pokemon: PokemonSpecies) => {
    onPick({
      pokemonId: pokemon.id,
      pokemonName: pokemon.name,
      types: pokemon.types as PokemonType[],
      num: pokemon.num,
    })
  }

  const usageByPokemonId = useMemo(() => {
    const map = new Map<string, UsageStatsEntry>()
    for (const entry of usageData) map.set(entry.pokemonId, entry)
    return map
  }, [usageData])

  const handleRecPick = (rec: Recommendation) => {
    const usage = usageByPokemonId.get(rec.pokemonId)
    onPick({
      pokemonId: rec.pokemonId,
      pokemonName: rec.pokemonName,
      types: usage?.types ?? [],
      usagePercent: usage?.usagePercent,
      num: usage?.num,
    })
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold font-display flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          {isLead ? "Choose Your Lead" : `Pick Slot ${slotNumber}`}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {isLead
            ? "Every great team starts with a strong anchor. Pick the Pokemon that defines your strategy and sets the direction for the rest of your team."
            : `Slot ${slotNumber} of 6. Choose a Pokemon that complements your current team.`}
        </p>
      </div>

      {/* Role suggestion banner (only for build phase) */}
      {!isLead && <RoleSuggestionBanner analysis={analysis} filledSlotCount={filledSlotCount} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content: recommendations + manual search */}
        <div className="lg:col-span-2 space-y-4">
          {/* Recommendation cards */}
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-3">
              {isLead ? "Recommended leads:" : "Recommended for your team:"}
            </p>

            {isLoading ? (
              <SkeletonList count={3} height="h-24" className="space-y-3" />
            ) : displayRecs.length > 0 ? (
              <div className="space-y-3">
                {displayRecs.map((rec) => (
                  <RecommendationCard
                    key={rec.pokemonId}
                    pokemonId={rec.pokemonId}
                    pokemonName={rec.pokemonName}
                    types={usageByPokemonId.get(rec.pokemonId)?.types ?? []}
                    score={rec.score}
                    reasons={rec.reasons}
                    onPick={() => handleRecPick(rec)}
                    isDisabled={allSelectedIds.has(rec.pokemonId)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState className="py-4">
                No recommendations available. Use the search below to find a Pokemon.
              </EmptyState>
            )}
          </div>

          {/* Manual search toggle */}
          <Separator />
          <div>
            <button
              onClick={() => setShowManualSearch((prev) => !prev)}
              className={cn(
                "flex items-center gap-2 w-full text-left text-sm font-medium py-2 px-3 rounded-lg transition-colors",
                "hover:bg-accent text-muted-foreground hover:text-foreground",
              )}
            >
              <Search className="h-4 w-4" />
              I&apos;ll choose my own
              {showManualSearch ? (
                <ChevronUp className="h-4 w-4 ml-auto" />
              ) : (
                <ChevronDown className="h-4 w-4 ml-auto" />
              )}
            </button>
            {showManualSearch && (
              <div className="mt-3 rounded-lg border p-4">
                <PokemonSearchPanel onSelect={handleManualSelect} formatId={formatId} />
              </div>
            )}
          </div>

          {/* Skip option (only for build phase) */}
          {!isLead && onSkip && (
            <div className="text-center">
              <Button variant="ghost" size="sm" onClick={onSkip}>
                Skip this slot
              </Button>
            </div>
          )}
        </div>

        {/* Sidebar: real-time analysis */}
        <div className="lg:col-span-1">
          <SimplifiedAnalysis
            analysis={analysis}
            isLoading={isLoadingAnalysis}
            filledSlotCount={filledSlotCount}
          />
        </div>
      </div>
    </div>
  )
}
