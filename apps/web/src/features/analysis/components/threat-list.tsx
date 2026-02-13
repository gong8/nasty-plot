"use client"

import { Badge } from "@/components/ui/badge"
import { SkeletonList } from "@/components/skeleton-list"
import { AnalysisCard } from "@/components/analysis-card"
import { AlertTriangle, Shield, Info } from "lucide-react"
import { cn, PokemonSprite, TypeBadge } from "@nasty-plot/ui"
import type { ThreatEntry, TeamSlotData } from "@nasty-plot/core"

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

function ThreatGrid({ threats, slots }: { threats: ThreatEntry[]; slots?: TeamSlotData[] }) {
  const slotIds = new Set((slots ?? []).map((s) => s.pokemonId))

  return (
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
            <PokemonSprite pokemonId={threat.pokemonId} size={40} className="shrink-0" />

            <div className="flex-1 min-w-0 space-y-1.5">
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

              {threat.types && threat.types.length > 0 && (
                <div className="flex gap-1">
                  {threat.types.map((t) => (
                    <TypeBadge key={t} type={t} size="sm" />
                  ))}
                </div>
              )}

              <p className="text-[11px] text-muted-foreground line-clamp-2">{threat.reason}</p>

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
}

const EMPTY_MSG =
  "No significant threats identified. This could mean usage data is not available for this format."

export function ThreatList({ threats, isLoading, slots, compact }: ThreatListProps) {
  if (compact) {
    if (isLoading) return <SkeletonList count={4} height="h-24" layout="grid-2" />
    if (!threats || threats.length === 0) {
      return <p className="text-sm text-muted-foreground">{EMPTY_MSG}</p>
    }
    return <ThreatGrid threats={threats} slots={slots} />
  }

  const title = threats && threats.length > 0 ? `Threats (${threats.length})` : "Threats"

  return (
    <AnalysisCard
      title={title}
      isLoading={isLoading}
      isEmpty={!threats || threats.length === 0}
      emptyMessage={EMPTY_MSG}
      skeletonCount={4}
      skeletonHeight="h-24"
      skeletonLayout="grid-2"
    >
      <ThreatGrid threats={threats!} slots={slots} />
    </AnalysisCard>
  )
}
