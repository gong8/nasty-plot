"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Sparkles } from "lucide-react";
import { useAddSlot } from "@/features/teams/hooks/use-teams";
import type { Recommendation } from "@nasty-plot/core";

interface RecommendationPanelProps {
  teamId: string;
  formatId: string;
  currentSlotCount: number;
}

const REASON_COLORS: Record<string, string> = {
  usage: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  coverage: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  synergy: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  meta: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
};

export function RecommendationPanel({
  teamId,
  formatId,
  currentSlotCount,
}: RecommendationPanelProps) {
  const queryClient = useQueryClient();
  const addSlotMut = useAddSlot();

  const { data, isLoading } = useQuery<{ data: Recommendation[] }>({
    queryKey: ["recommendations", teamId, formatId],
    queryFn: () =>
      fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, formatId, limit: 6 }),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed to fetch recommendations");
        return r.json();
      }),
    enabled: currentSlotCount >= 1 && currentSlotCount <= 5,
  });

  const recommendations = data?.data;

  const handleAdd = async (rec: Recommendation) => {
    const set = rec.suggestedSet;
    const nextPosition = currentSlotCount + 1;

    // Build moves array: pick first option from slash options
    const moves = (set?.moves ?? []).map((m) =>
      Array.isArray(m) ? m[0] : m
    );

    await addSlotMut.mutateAsync({
      teamId,
      slot: {
        position: nextPosition,
        pokemonId: rec.pokemonId,
        ability: set?.ability ?? "",
        item: set?.item ?? "",
        nature: set?.nature ?? "Adamant",
        teraType: set?.teraType,
        level: 100,
        moves: [
          moves[0] ?? "",
          moves[1],
          moves[2],
          moves[3],
        ] as [string, string?, string?, string?],
        evs: {
          hp: set?.evs?.hp ?? 0,
          atk: set?.evs?.atk ?? 0,
          def: set?.evs?.def ?? 0,
          spa: set?.evs?.spa ?? 0,
          spd: set?.evs?.spd ?? 0,
          spe: set?.evs?.spe ?? 0,
        },
        ivs: {
          hp: set?.ivs?.hp ?? 31,
          atk: set?.ivs?.atk ?? 31,
          def: set?.ivs?.def ?? 31,
          spa: set?.ivs?.spa ?? 31,
          spd: set?.ivs?.spd ?? 31,
          spe: set?.ivs?.spe ?? 31,
        },
      },
    });

    // Invalidate recommendations after adding
    queryClient.invalidateQueries({ queryKey: ["recommendations", teamId] });
  };

  if (currentSlotCount === 0) {
    return null;
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!recommendations || recommendations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Add some Pokemon first to get recommendations.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          Recommended Teammates
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {recommendations.slice(0, 6).map((rec) => (
            <div
              key={rec.pokemonId}
              className="flex items-start gap-3 p-2.5 rounded-lg border hover:bg-muted/50 transition-colors"
            >
              {/* Avatar */}
              <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0">
                {rec.pokemonName.slice(0, 2)}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">
                    {rec.pokemonName}
                  </span>
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
      </CardContent>
    </Card>
  );
}
