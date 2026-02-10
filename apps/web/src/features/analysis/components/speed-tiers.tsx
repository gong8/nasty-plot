"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { PokemonSprite } from "@nasty-plot/ui"
import { STAT_COLORS, type SpeedTierEntry } from "@nasty-plot/core"
import { cn } from "@/lib/utils"

interface SpeedTiersProps {
  tiers: SpeedTierEntry[] | undefined
}

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
    )
  }

  const maxSpeed = Math.max(...tiers.map((t) => t.speed))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Speed Tiers</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {tiers.map((entry, idx) => {
            const widthPercent = (entry.speed / maxSpeed) * 100
            const isTeam = !entry.isBenchmark

            return (
              <Tooltip key={`${entry.pokemonId}-${idx}`}>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      "flex items-center gap-2 py-0.5 cursor-default",
                      !isTeam && "opacity-50",
                    )}
                  >
                    {/* Sprite + Name */}
                    <div className="flex items-center gap-1.5 w-36 shrink-0">
                      {entry.pokemonNum ? (
                        <PokemonSprite
                          pokemonId={entry.pokemonId}
                          num={entry.pokemonNum}
                          size={20}
                        />
                      ) : (
                        <div className="w-5 h-5" />
                      )}
                      <span
                        className={cn(
                          "text-[11px] truncate",
                          isTeam ? "font-medium" : "text-muted-foreground",
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
                          isTeam ? "bg-primary/70" : "bg-muted-foreground/20",
                        )}
                        style={{
                          width: `${widthPercent}%`,
                          backgroundColor: isTeam ? STAT_COLORS.spe : undefined,
                        }}
                      />
                      <span
                        className={cn(
                          "absolute right-1 top-0.5 text-[10px] font-mono",
                          isTeam ? "font-bold" : "text-muted-foreground",
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
      </CardContent>
    </Card>
  )
}
