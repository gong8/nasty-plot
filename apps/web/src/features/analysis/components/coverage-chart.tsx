"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { AnalysisCard } from "@/components/analysis-card"
import { POKEMON_TYPES, type TypeCoverage } from "@nasty-plot/core"
import { cn, TypeBadge } from "@nasty-plot/ui"

type CoverageMode = "offensive" | "defensive"

interface CoverageChartProps {
  coverage: TypeCoverage | undefined
  compact?: boolean
}

function getCoverageLevel(count: number): {
  label: string
  className: string
} {
  if (count === 0)
    return {
      label: "None",
      className:
        "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 border-red-300 dark:border-red-500/30",
    }
  if (count === 1)
    return {
      label: "1x",
      className:
        "bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-300 dark:border-yellow-500/30",
    }
  if (count === 2)
    return {
      label: "2x",
      className:
        "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 border-green-300 dark:border-green-500/30",
    }
  return {
    label: `${count}x`,
    className:
      "bg-green-200 dark:bg-green-600/20 text-green-800 dark:text-green-300 border-green-400 dark:border-green-500/30",
  }
}

export function CoverageChart({ coverage, compact }: CoverageChartProps) {
  const [mode, setMode] = useState<CoverageMode>("offensive")

  if (!coverage) {
    if (compact) {
      return (
        <p className="text-sm text-muted-foreground">
          Add Pokemon to your team to see type coverage analysis.
        </p>
      )
    }
    return (
      <AnalysisCard
        title="Type Coverage"
        isEmpty
        emptyMessage="Add Pokemon to your team to see type coverage analysis."
      />
    )
  }

  const data = mode === "offensive" ? coverage.offensive : coverage.defensive

  const content = (
    <>
      <div className={compact ? "flex items-center justify-between mb-3" : ""}>
        {compact && <h4 className="text-sm font-medium">Type Coverage</h4>}
        <Tabs value={mode} onValueChange={(v) => setMode(v as CoverageMode)}>
          <TabsList className="h-7">
            <TabsTrigger value="offensive" className="text-xs h-6 px-2">
              Offensive
            </TabsTrigger>
            <TabsTrigger value="defensive" className="text-xs h-6 px-2">
              Defensive
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="grid grid-cols-6 gap-1.5">
        {POKEMON_TYPES.map((type) => {
          const count = data[type] ?? 0
          const { label, className } = getCoverageLevel(count)
          return (
            <Tooltip key={type}>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    "rounded-md p-1.5 text-center border cursor-default transition-all hover:scale-105",
                    className,
                  )}
                >
                  <TypeBadge
                    type={type}
                    size="sm"
                    className="text-[10px] truncate px-1 rounded min-w-0"
                  />
                  <div className="text-[10px] font-mono">{label}</div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">
                  {mode === "offensive"
                    ? `${count} team member${count !== 1 ? "s" : ""} can hit ${type} super-effectively`
                    : `${count} team member${count !== 1 ? "s" : ""} resist${count === 1 ? "s" : ""} ${type}`}
                </p>
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>

      {/* Warnings */}
      <div className="mt-3 space-y-1.5">
        {coverage.uncoveredTypes.length > 0 && (
          <div className="flex items-start gap-2">
            <Badge variant="destructive" className="text-[10px] shrink-0">
              Gap
            </Badge>
            <p className="text-xs text-muted-foreground">
              No SE coverage: {coverage.uncoveredTypes.join(", ")}
            </p>
          </div>
        )}
        {coverage.sharedWeaknesses.length > 0 && (
          <div className="flex items-start gap-2">
            <Badge variant="destructive" className="text-[10px] shrink-0">
              Weak
            </Badge>
            <p className="text-xs text-muted-foreground">
              Shared weaknesses: {coverage.sharedWeaknesses.join(", ")}
            </p>
          </div>
        )}
      </div>
    </>
  )

  if (compact) return content

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Type Coverage</CardTitle>
        </div>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  )
}
