"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertTriangle, Shield, Info } from "lucide-react"
import { PokemonSprite, TypeBadge } from "@nasty-plot/ui"
import type { ThreatEntry, TeamSlotData } from "@nasty-plot/core"
import { cn } from "@/lib/utils"

interface ThreatListProps {
  threats: ThreatEntry[] | undefined
  isLoading?: boolean
  slots?: TeamSlotData[]
  compact?: boolean
}

function getThreatBadge(level: ThreatEntry["threatLevel"]) {
  switch (level) {
    case "high":
      return { variant: "destructive" as const, icon: AlertTriangle, label: "High" }
    case "medium":
      return { variant: "secondary" as const, icon: Shield, label: "Med" }
    case "low":
      return { variant: "outline" as const, icon: Info, label: "Low" }
  }
}

export function ThreatList({ threats, isLoading, slots, compact }: ThreatListProps) {
  if (isLoading) {
    const skeleton = (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    )
    if (compact) return skeleton
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Threats</CardTitle>
        </CardHeader>
        <CardContent>{skeleton}</CardContent>
      </Card>
    )
  }

  if (!threats || threats.length === 0) {
    const empty = (
      <p className="text-sm text-muted-foreground">
        No significant threats identified. This could mean usage data is not available for this
        format.
      </p>
    )
    if (compact) return empty
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Threats</CardTitle>
        </CardHeader>
        <CardContent>{empty}</CardContent>
      </Card>
    )
  }

  // Build a lookup for team slot sprites
  const slotIds = new Set((slots ?? []).map((s) => s.pokemonId))

  const grid = (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {threats.map((threat) => {
        const badge = getThreatBadge(threat.threatLevel)
        const Icon = badge.icon

        return (
          <div
            key={threat.pokemonId}
            className={cn(
              "flex gap-3 p-3 rounded-lg border transition-colors",
              threat.threatLevel === "high" &&
                "border-red-300 bg-red-50/50 dark:border-red-900/50 dark:bg-red-950/20",
              threat.threatLevel === "medium" &&
                "border-amber-300 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20",
              threat.threatLevel === "low" && "border-border",
            )}
          >
            {/* Pokemon Sprite */}
            <PokemonSprite pokemonId={threat.pokemonId} size={40} className="shrink-0" />

            {/* Info */}
            <div className="flex-1 min-w-0 space-y-1.5">
              {/* Name + Badge + Usage */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium truncate">{threat.pokemonName}</span>
                <Badge variant={badge.variant} className="text-[10px] h-5 px-1.5 shrink-0">
                  <Icon className="h-3 w-3 mr-0.5" />
                  {badge.label}
                </Badge>
                <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                  {threat.usagePercent.toFixed(1)}%
                </span>
              </div>

              {/* Type Badges */}
              {threat.types && threat.types.length > 0 && (
                <div className="flex gap-1">
                  {threat.types.map((t) => (
                    <TypeBadge key={t} type={t} size="sm" />
                  ))}
                </div>
              )}

              {/* Reason */}
              <p className="text-[11px] text-muted-foreground line-clamp-2">{threat.reason}</p>

              {/* Threatened team members */}
              {threat.threatenedSlots && threat.threatenedSlots.length > 0 && (
                <div className="flex items-center gap-1.5 pt-0.5">
                  <span className="text-[10px] text-muted-foreground shrink-0">Threatens:</span>
                  <div className="flex gap-1 flex-wrap">
                    {threat.threatenedSlots.map((slotId) => {
                      if (!slotIds.has(slotId)) return null
                      return <PokemonSprite key={slotId} pokemonId={slotId} size={24} />
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )

  if (compact) return grid

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Threats ({threats.length})</CardTitle>
      </CardHeader>
      <CardContent>{grid}</CardContent>
    </Card>
  )
}
