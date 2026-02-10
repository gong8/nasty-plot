"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { STAT_COLORS } from "@nasty-plot/core";
import type { SpeedTierEntry } from "@nasty-plot/core";
import { cn } from "@/lib/utils";

interface SpeedTiersProps {
  tiers: SpeedTierEntry[] | undefined;
}

// Common speed benchmarks (base speed stat values)
const BENCHMARKS = [
  { speed: 252, label: "Regieleki (200 base)" },
  { speed: 207, label: "Dragapult (142 base)" },
  { speed: 178, label: "Iron Bundle (136 base)" },
  { speed: 165, label: "Meowscarada (123 base)" },
  { speed: 150, label: "Cinderace (119 base)" },
  { speed: 130, label: "Garchomp (102 base)" },
  { speed: 115, label: "Lando-T (91 base)" },
  { speed: 97,  label: "Tyranitar (61 base)" },
  { speed: 65,  label: "Slowbro (30 base)" },
];

export function SpeedTiers({ tiers }: SpeedTiersProps) {
  if (!tiers || tiers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Speed Tiers</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Add Pokemon to your team to see speed comparisons.
          </p>
        </CardContent>
      </Card>
    );
  }

  const maxSpeed = Math.max(
    ...tiers.map((t) => t.speed),
    ...BENCHMARKS.map((b) => b.speed)
  );

  // Combine team tiers and benchmarks, sorted by speed
  const combined = [
    ...tiers.map((t) => ({
      ...t,
      isTeam: true,
      label: t.pokemonName,
    })),
    ...BENCHMARKS.map((b) => ({
      speed: b.speed,
      label: b.label,
      isTeam: false,
      pokemonId: "",
      pokemonName: "",
      nature: "",
      evs: 0,
    })),
  ].sort((a, b) => b.speed - a.speed);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Speed Tiers</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {combined.map((entry, idx) => {
            const widthPercent = (entry.speed / maxSpeed) * 100;
            const isTeam = entry.isTeam;

            return (
              <Tooltip key={`${entry.label}-${idx}`}>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      "flex items-center gap-2 py-1 cursor-default",
                      !isTeam && "opacity-40"
                    )}
                  >
                    <span
                      className={cn(
                        "text-[11px] w-28 truncate text-right",
                        isTeam ? "font-medium" : "text-muted-foreground"
                      )}
                    >
                      {entry.label}
                    </span>
                    <div className="flex-1 h-5 bg-muted/30 rounded-sm overflow-hidden relative">
                      <div
                        className={cn(
                          "h-full rounded-sm transition-all",
                          isTeam ? "bg-primary/70" : "bg-muted-foreground/20"
                        )}
                        style={{
                          width: `${widthPercent}%`,
                          backgroundColor: isTeam ? STAT_COLORS.spe : undefined,
                        }}
                      />
                      <span
                        className={cn(
                          "absolute right-1 top-0.5 text-[10px] font-mono",
                          isTeam ? "font-bold" : "text-muted-foreground"
                        )}
                      >
                        {entry.speed}
                      </span>
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-xs">
                    {isTeam ? (
                      <>
                        <p className="font-medium">{(entry as SpeedTierEntry & { isTeam: boolean }).pokemonName}</p>
                        <p>Speed: {entry.speed}</p>
                        <p>Nature: {(entry as SpeedTierEntry & { isTeam: boolean }).nature}</p>
                        <p>Speed EVs: {(entry as SpeedTierEntry & { isTeam: boolean }).evs}</p>
                      </>
                    ) : (
                      <p>{entry.label} - {entry.speed} Spe</p>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
