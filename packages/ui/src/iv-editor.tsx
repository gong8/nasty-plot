"use client"

import { STATS, STAT_LABELS, STAT_COLORS } from "@nasty-plot/core"
import type { StatName, StatsTable } from "@nasty-plot/core"
import { cn } from "./utils"

interface IvEditorProps {
  ivs: StatsTable
  onChange: (stat: StatName, value: number) => void
  className?: string
}

export type { IvEditorProps }

export function IvEditor({ ivs, onChange, className }: IvEditorProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="grid grid-cols-3 gap-2">
        {STATS.map((stat) => (
          <div key={stat} className="space-y-1">
            <span className="text-xs font-medium" style={{ color: STAT_COLORS[stat] }}>
              {STAT_LABELS[stat]}
            </span>
            <input
              type="number"
              min={0}
              max={31}
              value={ivs[stat]}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10) || 0
                onChange(stat, Math.max(0, Math.min(31, v)))
              }}
              className={cn(
                "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground border-input bg-transparent dark:bg-input/30 w-full min-w-0 rounded-md border px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
                "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                "h-8 text-center",
              )}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
