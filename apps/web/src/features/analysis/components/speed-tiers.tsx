"use client"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { AnalysisCard } from "@/components/analysis-card"
import { cn, PokemonSprite } from "@nasty-plot/ui"
import { STAT_COLORS, type SpeedTierEntry } from "@nasty-plot/core"

interface SpeedTiersProps {
  tiers: SpeedTierEntry[] | undefined
}

export function SpeedTiers({ tiers }: SpeedTiersProps) {
  const maxSpeed = tiers && tiers.length > 0 ? Math.max(...tiers.map((t) => t.speed)) : 0

  return (
    <AnalysisCard
      title="Speed Tiers"
      isEmpty={!tiers || tiers.length === 0}
      emptyMessage="Add Pokemon to your team to see speed comparisons."
    >
      <div className="space-y-1">
        {tiers!.map((entry, idx) => {
          const widthPercent = (entry.speed / maxSpeed) * 100
          const isTeamMember = !entry.isBenchmark

          return (
            <Tooltip key={`${entry.pokemonId}-${idx}`}>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    "flex items-center gap-2 py-0.5 cursor-default",
                    !isTeamMember && "opacity-50",
                  )}
                >
                  {/* Sprite + Name */}
                  <div className="flex items-center gap-1.5 w-36 shrink-0">
                    <PokemonSprite pokemonId={entry.pokemonId} size={20} />
                    <span
                      className={cn(
                        "text-[11px] truncate",
                        isTeamMember ? "font-medium" : "text-muted-foreground",
                      )}
                    >
                      {entry.pokemonName}
                    </span>
                  </div>

                  {/* Speed Bar */}
                  <div className="flex-1 h-5 bg-muted/30 rounded-sm overflow-hidden relative">
                    <div
                      className={cn(
                        "h-full rounded-sm transition-all",
                        isTeamMember ? "bg-primary/70" : "bg-muted-foreground/20",
                      )}
                      style={{
                        width: `${widthPercent}%`,
                        backgroundColor: isTeamMember ? STAT_COLORS.spe : undefined,
                      }}
                    />
                    <span
                      className={cn(
                        "absolute right-1 top-0.5 text-[10px] font-mono",
                        isTeamMember ? "font-bold" : "text-muted-foreground",
                      )}
                    >
                      {entry.speed}
                    </span>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs">
                  {isTeamMember ? (
                    <>
                      <p className="font-medium">{entry.pokemonName}</p>
                      <p>Speed: {entry.speed}</p>
                      <p>Nature: {entry.nature}</p>
                      <p>Speed EVs: {entry.evs}</p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium">{entry.pokemonName}</p>
                      <p>Speed: {entry.speed}</p>
                      <p>Max invest +Spe nature</p>
                    </>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </AnalysisCard>
  )
}
