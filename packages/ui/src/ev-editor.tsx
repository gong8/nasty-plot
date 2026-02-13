"use client"

import { Slider as SliderPrimitive } from "radix-ui"
import { STATS, STAT_LABELS, STAT_COLORS, MAX_SINGLE_EV, MAX_TOTAL_EVS } from "@nasty-plot/core"
import type { StatName, StatsTable } from "@nasty-plot/core"
import { cn } from "./utils"

interface EvEditorProps {
  evs: StatsTable
  onChange: (stat: StatName, value: number) => void
  showRemaining?: boolean
  className?: string
}

export type { EvEditorProps }

function getTotalEvs(evs: StatsTable): number {
  return STATS.reduce((sum, stat) => sum + evs[stat], 0)
}

export function EvEditor({ evs, onChange, showRemaining = true, className }: EvEditorProps) {
  const evTotal = getTotalEvs(evs)
  const evRemaining = MAX_TOTAL_EVS - evTotal

  return (
    <div className={cn("space-y-3", className)}>
      {showRemaining && (
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">EVs</span>
          <span
            className={cn(
              "text-xs",
              evRemaining < 0 ? "text-destructive font-medium" : "text-muted-foreground",
            )}
          >
            {evTotal} / {MAX_TOTAL_EVS} ({evRemaining} remaining)
          </span>
        </div>
      )}
      {STATS.map((stat) => (
        <div key={stat} className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: STAT_COLORS[stat] }}>
              {STAT_LABELS[stat]}
            </span>
            <span className="text-xs tabular-nums">{evs[stat]}</span>
          </div>
          <SliderPrimitive.Root
            min={0}
            max={MAX_SINGLE_EV}
            step={4}
            value={[evs[stat]]}
            onValueChange={([v]) => onChange(stat, v)}
            className="relative flex w-full touch-none items-center select-none data-disabled:opacity-50"
          >
            <SliderPrimitive.Track className="bg-muted relative grow overflow-hidden rounded-full h-1.5 w-full">
              <SliderPrimitive.Range className="bg-primary absolute h-full" />
            </SliderPrimitive.Track>
            <SliderPrimitive.Thumb className="border-primary ring-ring/50 block size-4 shrink-0 rounded-full border bg-white shadow-sm transition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50" />
          </SliderPrimitive.Root>
        </div>
      ))}
    </div>
  )
}
