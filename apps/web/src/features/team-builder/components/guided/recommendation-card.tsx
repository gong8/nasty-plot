"use client";

import { Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TypeBadge, PokemonSprite } from "@nasty-plot/ui";
import type { PokemonType, RecommendationReason } from "@nasty-plot/core";

interface RecommendationCardProps {
  pokemonId: string;
  pokemonName: string;
  types: PokemonType[];
  num?: number;
  score: number; // 0-100
  reasons: RecommendationReason[];
  onPick: () => void;
  isDisabled?: boolean;
}

const REASON_LABELS: Record<RecommendationReason["type"], string> = {
  usage: "Popular teammate",
  coverage: "Covers gaps",
  synergy: "Good synergy",
  meta: "Meta pick",
};

function getScoreColor(score: number): string {
  if (score > 70) return "bg-green-500";
  if (score > 40) return "bg-yellow-500";
  return "bg-red-500";
}

export function RecommendationCard({
  pokemonId,
  pokemonName,
  types,
  num,
  score,
  reasons,
  onPick,
  isDisabled = false,
}: RecommendationCardProps) {
  const displayReasons = reasons.slice(0, 3);

  return (
    <Card
      className={cn(
        "transition-all",
        isDisabled
          ? "opacity-50 cursor-not-allowed"
          : "hover:shadow-md hover:border-primary/50 cursor-pointer"
      )}
      onClick={() => {
        if (!isDisabled) onPick();
      }}
    >
      <CardContent className="flex items-center gap-4 p-4">
        {/* Sprite area */}
        <div className="shrink-0">
          {num && num > 0 ? (
            <PokemonSprite pokemonId={pokemonId} num={num} size={64} />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-lg font-bold uppercase text-muted-foreground">
              {pokemonId.slice(0, 2)}
            </div>
          )}
        </div>

        {/* Content area */}
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Name */}
          <p className="font-medium text-sm truncate">{pokemonName}</p>

          {/* Type badges */}
          <div className="flex gap-0.5">
            {types.map((t) => (
              <TypeBadge key={t} type={t} size="sm" />
            ))}
          </div>

          {/* Score bar */}
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", getScoreColor(score))}
                style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
              {score}
            </span>
          </div>

          {/* Reasons */}
          <div className="flex flex-wrap gap-1">
            {displayReasons.map((reason, i) => (
              <Badge
                key={i}
                variant="outline"
                className="text-[10px] px-1.5 py-0 font-normal text-muted-foreground"
              >
                {REASON_LABELS[reason.type] ?? reason.type}: {reason.description}
              </Badge>
            ))}
          </div>
        </div>

        {/* Pick button */}
        <div className="shrink-0">
          <Button
            size="sm"
            variant="default"
            disabled={isDisabled}
            onClick={(e) => {
              e.stopPropagation();
              onPick();
            }}
          >
            <Check className="h-4 w-4 mr-1" />
            Pick
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
