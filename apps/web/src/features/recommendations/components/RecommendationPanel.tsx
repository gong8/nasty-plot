"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AnalysisCard } from "@/components/AnalysisCard"
import { Plus, Sparkles } from "lucide-react"
import { PokemonAvatar } from "@/components/PokemonAvatar"
import { useAddSlot } from "@/features/teams/hooks/use-teams"
import {
  DEFAULT_LEVEL,
  DEFAULT_EVS,
  DEFAULT_IVS,
  DEFAULT_NATURE,
  type Recommendation,
} from "@nasty-plot/core"
import { postJson } from "@/lib/api-client"

interface RecommendationPanelProps {
  teamId: string
  formatId: string
  currentSlotCount: number
}

const REASON_COLORS: Record<string, string> = {
  usage: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  coverage: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  synergy: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  meta: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
}

export function RecommendationPanel({
  teamId,
  formatId,
  currentSlotCount,
}: RecommendationPanelProps) {
  const queryClient = useQueryClient()
  const addSlotMut = useAddSlot()

  const { data, isLoading } = useQuery<{ data: Recommendation[] }>({
    queryKey: ["recommendations", teamId, formatId],
    queryFn: () => postJson("/api/recommend", { teamId, formatId, limit: 6 }),
    enabled: currentSlotCount >= 1 && currentSlotCount <= 5,
  })

  const recommendations = data?.data

  const handleAdd = async (rec: Recommendation) => {
    const set = rec.suggestedSet
    const nextPosition = currentSlotCount + 1

    // Build moves array: pick first option from slash options
    const moves = (set?.moves ?? []).map((m) => (Array.isArray(m) ? m[0] : m))

    await addSlotMut.mutateAsync({
      teamId,
      slot: {
        position: nextPosition,
        pokemonId: rec.pokemonId,
        ability: set?.ability ?? "",
        item: set?.item ?? "",
        nature: set?.nature ?? DEFAULT_NATURE,
        teraType: set?.teraType,
        level: DEFAULT_LEVEL,
        moves: [moves[0] ?? "", moves[1], moves[2], moves[3]] as [
          string,
          string?,
          string?,
          string?,
        ],
        evs: { ...DEFAULT_EVS, ...set?.evs },
        ivs: { ...DEFAULT_IVS, ...set?.ivs },
      },
    })

    // Invalidate recommendations after adding
    queryClient.invalidateQueries({ queryKey: ["recommendations", teamId] })
  }

  if (currentSlotCount === 0) {
    return null
  }

  return (
    <AnalysisCard
      title={
        !recommendations || recommendations.length === 0
          ? "Recommendations"
          : "Recommended Teammates"
      }
      icon={<Sparkles className="h-4 w-4" />}
      isLoading={isLoading}
      isEmpty={!recommendations || recommendations.length === 0}
      emptyMessage="Add Pokemon to start receiving recommendations."
      skeletonCount={3}
      skeletonHeight="h-16"
    >
      <div className="space-y-2">
        {recommendations?.map((rec) => (
          <div
            key={rec.pokemonId}
            className="flex items-start gap-3 p-2.5 rounded-lg border hover:bg-muted/50 transition-colors"
          >
            {/* Avatar */}
            <PokemonAvatar name={rec.pokemonName} size="lg" />

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">{rec.pokemonName}</span>
                <span className="text-xs text-muted-foreground ml-auto shrink-0">
                  {rec.score}/100
                </span>
              </div>
              {/* Score bar */}
              <div className="h-1.5 w-full bg-muted rounded-full mt-1 overflow-hidden">
                <div
                  className="h-full bg-primary/70 rounded-full transition-all"
                  style={{ width: `${rec.score}%` }}
                />
              </div>
              {/* Reasons */}
              <div className="flex flex-wrap gap-1 mt-1.5">
                {rec.reasons.map((reason, idx) => (
                  <Badge
                    key={idx}
                    variant="secondary"
                    className={`text-[10px] h-5 px-1.5 ${REASON_COLORS[reason.type] ?? ""}`}
                  >
                    {reason.description}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Add button */}
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 shrink-0"
              onClick={() => handleAdd(rec)}
              disabled={addSlotMut.isPending}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </AnalysisCard>
  )
}
