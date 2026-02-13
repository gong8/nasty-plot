"use client"

import { STATS, STAT_LABELS, STAT_COLORS } from "@nasty-plot/core"
import type { StatsTable } from "@nasty-plot/core"
import { cn } from "./utils"

interface CalculatedStatsDisplayProps {
  stats: StatsTable
  className?: string
}

export type { CalculatedStatsDisplayProps }

export function CalculatedStatsDisplay({ stats, className }: CalculatedStatsDisplayProps) {
  return (
    <div className={cn("grid grid-cols-3 gap-2", className)}>
      {STATS.map((stat) => (
        <div key={stat} className="rounded-md border p-2 text-center">
          <div className="text-xs font-medium" style={{ color: STAT_COLORS[stat] }}>
            {STAT_LABELS[stat]}
          </div>
          <div className="text-lg font-bold tabular-nums">{stats[stat]}</div>
        </div>
      ))}
    </div>
  )
}
