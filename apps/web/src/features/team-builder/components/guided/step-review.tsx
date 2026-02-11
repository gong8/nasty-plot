"use client"

import { useQueries } from "@tanstack/react-query"
import {
  Sparkles,
  Save,
  Loader2,
  AlertTriangle,
  AlertCircle,
  Swords,
  ArrowLeft,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { TypeBadge, PokemonSprite } from "@nasty-plot/ui"
import type {
  TeamSlotData,
  TeamAnalysis,
  PokemonType,
  PokemonSpecies,
  UsageStatsEntry,
} from "@nasty-plot/core"
import { SimplifiedAnalysis } from "./simplified-analysis"

interface StepReviewProps {
  slots: Partial<TeamSlotData>[]
  analysis: TeamAnalysis | null
  isLoadingAnalysis: boolean
  usageData: UsageStatsEntry[]
  validation: {
    errors: string[]
    warnings: string[]
    isValid: boolean
  }
  isSaving: boolean
  onSave: () => void
  onGoToStep: (step: string) => void
  onTestTeam: () => void
}

export function StepReview({
  slots,
  analysis,
  isLoadingAnalysis,
  usageData,
  validation,
  isSaving,
  onSave,
  onGoToStep,
  onTestTeam,
}: StepReviewProps) {
  const filledSlots = slots.filter((s) => s.pokemonId)

  // Batch-fetch species data for display names
  const speciesQueries = useQueries({
    queries: filledSlots.map((slot) => ({
      queryKey: ["pokemon", slot.pokemonId!],
      queryFn: async () => {
        const res = await fetch(`/api/pokemon/${slot.pokemonId}`)
        if (!res.ok) throw new Error("Not found")
        const json = await res.json()
        return json.data as PokemonSpecies
      },
      enabled: !!slot.pokemonId,
      staleTime: Infinity,
    })),
  })

  const speciesMap = new Map<string, PokemonSpecies>()
  for (const q of speciesQueries) {
    if (q.data) speciesMap.set(q.data.id, q.data)
  }

  function speciesName(id: string): string {
    return speciesMap.get(id)?.name ?? id
  }

  function getTypes(pokemonId: string): PokemonType[] {
    const species = speciesMap.get(pokemonId)
    if (species) return species.types
    const usage = usageData.find((u) => u.pokemonId === pokemonId)
    return usage?.types ?? []
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold font-display flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Review & Save
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Your squad is assembled. Review the lineup, check the analysis, and save when you&apos;re
          ready.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main: team overview + validation */}
        <div className="lg:col-span-2 space-y-4">
          {/* Team overview */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filledSlots.map((slot) => {
              const id = slot.pokemonId!
              const name = speciesName(id)
              const types = getTypes(id)
              const moves = slot.moves?.filter((m): m is string => !!m) ?? []

              return (
                <Card key={slot.position} className="overflow-hidden">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <PokemonSprite pokemonId={id} size={32} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{name}</div>
                        <div className="flex gap-0.5 mt-0.5">
                          {types.map((t) => (
                            <TypeBadge key={t} type={t} size="sm" />
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      {slot.ability && <div>Ability: {slot.ability}</div>}
                      {slot.item && <div>Item: {slot.item}</div>}
                      {slot.nature && <div>Nature: {slot.nature}</div>}
                      {slot.teraType && (
                        <div className="flex items-center gap-1">
                          Tera: <TypeBadge type={slot.teraType} size="sm" />
                        </div>
                      )}
                    </div>
                    {moves.length > 0 && (
                      <>
                        <Separator />
                        <div className="flex flex-wrap gap-1">
                          {moves.map((move, i) => (
                            <Badge key={i} variant="outline" className="text-[10px]">
                              {move}
                            </Badge>
                          ))}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Validation messages */}
          {validation.errors.length > 0 && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-3 space-y-1">
              {validation.errors.map((err, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{err}</span>
                </div>
              ))}
            </div>
          )}

          {validation.warnings.length > 0 && (
            <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/5 p-3 space-y-1">
              {validation.warnings.map((warn, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 text-sm text-yellow-600 dark:text-yellow-400"
                >
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{warn}</span>
                </div>
              ))}
            </div>
          )}

          {/* Suggestions with "go back" links */}
          {analysis?.suggestions && analysis.suggestions.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Tips</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {analysis.suggestions.slice(0, 3).map((suggestion, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <span className="shrink-0">-</span>
                    <span>{suggestion}</span>
                  </div>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs mt-1"
                  onClick={() => onGoToStep("build")}
                >
                  <ArrowLeft className="h-3 w-3 mr-1" />
                  Go back and adjust
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              className="flex-1"
              size="lg"
              onClick={onSave}
              disabled={isSaving || !validation.isValid}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving Team...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Team ({filledSlots.length} Pokemon)
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={onTestTeam}
              disabled={isSaving || !validation.isValid}
            >
              <Swords className="mr-2 h-4 w-4" />
              Test This Team
            </Button>
          </div>
        </div>

        {/* Sidebar: full analysis */}
        <div className="lg:col-span-1">
          <SimplifiedAnalysis
            analysis={analysis}
            isLoading={isLoadingAnalysis}
            filledSlotCount={filledSlots.length}
          />
        </div>
      </div>
    </div>
  )
}
