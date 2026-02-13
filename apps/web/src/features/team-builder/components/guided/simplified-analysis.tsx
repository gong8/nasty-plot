"use client"

import { type TeamAnalysis, POKEMON_TYPES, type PokemonType } from "@nasty-plot/core"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn, TypeBadge } from "@nasty-plot/ui"
import { SkeletonList } from "@/components/skeleton-list"
import { EmptyState } from "@/components/empty-state"
import { Progress } from "@/components/ui/progress"
import { Shield, Swords, Gauge, AlertTriangle } from "lucide-react"

interface SimplifiedAnalysisProps {
  analysis: TeamAnalysis | null
  isLoading: boolean
  filledSlotCount: number
}

function getTypeCoverageStatus(
  type: PokemonType,
  analysis: TeamAnalysis,
): "covered" | "weakness" | "neutral" {
  const isCovered = analysis.coverage.offensive[type] > 0
  const isWeakness = analysis.coverage.sharedWeaknesses.includes(type)

  if (isWeakness) return "weakness"
  if (isCovered) return "covered"
  return "neutral"
}

function getThreatLevelColor(level: "high" | "medium" | "low"): string {
  switch (level) {
    case "high":
      return "bg-red-500/15 text-red-400 border-red-500/30"
    case "medium":
      return "bg-yellow-500/15 text-yellow-400 border-yellow-500/30"
    case "low":
      return "bg-green-500/15 text-green-400 border-green-500/30"
  }
}

function getSynergyTier(score: number): { color: string; barColor: string; label: string } {
  if (score < 30) return { color: "text-red-400", barColor: "bg-red-500", label: "Weak" }
  if (score <= 60) return { color: "text-yellow-400", barColor: "bg-yellow-500", label: "Moderate" }
  return { color: "text-green-400", barColor: "bg-green-500", label: "Strong" }
}

function SynergyCard({ synergyScore }: { synergyScore: number }) {
  const synergy = getSynergyTier(synergyScore)
  return (
    <Card className="gap-3 py-3">
      <CardHeader className="px-4 py-0">
        <CardTitle className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5 text-primary" />
            Team Synergy
          </span>
          <span className="font-normal">
            <span className={cn("font-semibold", synergy.color)}>{synergyScore}</span>
            <span className="text-muted-foreground text-[10px] ml-1">/ 100 ({synergy.label})</span>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 py-0">
        <div className="relative">
          <Progress value={synergyScore} className="h-2" />
          <div
            className={cn("absolute inset-0 h-2 rounded-full transition-all", synergy.barColor)}
            style={{ width: `${synergyScore}%` }}
          />
        </div>
      </CardContent>
    </Card>
  )
}

export function SimplifiedAnalysis({
  analysis,
  isLoading,
  filledSlotCount,
}: SimplifiedAnalysisProps) {
  if (filledSlotCount === 0 && !isLoading) {
    return <EmptyState dashed>Add Pokemon to see analysis</EmptyState>
  }

  if (isLoading) {
    return <SkeletonList count={5} height="h-20" className="space-y-3" />
  }

  if (!analysis) {
    return null
  }

  const coveredCount = POKEMON_TYPES.filter((t) => analysis.coverage.offensive[t] > 0).length

  return (
    <div className="space-y-3">
      {/* Type Coverage Map */}
      <Card className="gap-3 py-3">
        <CardHeader className="px-4 py-0">
          <CardTitle className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5">
              <Swords className="h-3.5 w-3.5 text-primary" />
              Type Coverage
            </span>
            <span className="text-muted-foreground font-normal">
              {coveredCount}/{POKEMON_TYPES.length} covered
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 py-0">
          <div className="grid grid-cols-6 gap-1.5">
            {POKEMON_TYPES.map((type) => {
              const status = getTypeCoverageStatus(type, analysis)
              return (
                <TypeBadge
                  key={type}
                  type={type}
                  size="sm"
                  className={cn(
                    "text-[8px] min-w-0 px-1 py-0.5",
                    status === "covered" && "opacity-100 ring-1 ring-green-400/50",
                    status === "weakness" && "opacity-100 ring-1 ring-red-400/50",
                    status === "neutral" && "opacity-40",
                  )}
                />
              )
            })}
          </div>
          <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full ring-1 ring-green-400/50 bg-green-400/30" />
              SE Coverage
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full ring-1 ring-red-400/50 bg-red-400/30" />
              Shared Weakness
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/30" />
              Neutral
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Top Threats */}
      {analysis.threats.length > 0 && (
        <Card className="gap-3 py-3">
          <CardHeader className="px-4 py-0">
            <CardTitle className="flex items-center gap-1.5 text-xs">
              <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
              Top Threats
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 py-0">
            <div className="space-y-2">
              {analysis.threats.slice(0, 3).map((threat) => (
                <div
                  key={threat.pokemonId}
                  className="flex items-start gap-2 rounded-md bg-muted/50 p-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium truncate">{threat.pokemonName}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {threat.usagePercent.toFixed(1)}%
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                      {threat.reason}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "shrink-0 text-[10px] px-1.5 py-0 border",
                      getThreatLevelColor(threat.threatLevel),
                    )}
                  >
                    {threat.threatLevel}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Synergy Score */}
      {analysis.synergyScore != null && <SynergyCard synergyScore={analysis.synergyScore} />}

      {/* Speed Tiers */}
      {analysis.speedTiers.length > 0 && filledSlotCount > 1 && (
        <Card className="gap-3 py-3">
          <CardHeader className="px-4 py-0">
            <CardTitle className="flex items-center gap-1.5 text-xs">
              <Gauge className="h-3.5 w-3.5 text-primary" />
              Speed Tiers
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 py-0">
            <div className="space-y-1">
              {[...analysis.speedTiers]
                .sort((a, b) => b.speed - a.speed)
                .map((entry) => (
                  <div key={entry.pokemonId} className="flex items-center justify-between text-xs">
                    <span className="truncate text-muted-foreground">{entry.pokemonName}</span>
                    <span className="shrink-0 ml-2 font-mono text-[11px] font-medium">
                      {entry.speed}
                      {entry.boosted && <span className="text-yellow-400 ml-0.5">+</span>}
                    </span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Suggestions */}
      {analysis.suggestions.length > 0 && (
        <Card className="gap-3 py-3">
          <CardHeader className="px-4 py-0">
            <CardTitle className="text-xs text-muted-foreground">Suggestions</CardTitle>
          </CardHeader>
          <CardContent className="px-4 py-0">
            <ul className="space-y-1.5">
              {analysis.suggestions.slice(0, 3).map((suggestion, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 rounded-md bg-muted/50 px-2 py-1.5 text-[11px] text-muted-foreground leading-snug"
                >
                  <span className="shrink-0 mt-0.5 text-primary">&#x2022;</span>
                  {suggestion}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
