"use client";

import { cn } from "./utils";
import { STAT_COLORS, STAT_LABELS } from "@nasty-plot/core";
import type { StatName } from "@nasty-plot/core";

interface StatBarProps {
  stat: StatName;
  value: number;
  max?: number;
  className?: string;
}

export function StatBar({ stat, value, max = 255, className }: StatBarProps) {
  const color = STAT_COLORS[stat];
  const label = STAT_LABELS[stat];
  const percent = Math.min(100, (value / max) * 100);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="text-xs font-medium w-8 text-right text-muted-foreground">
        {label}
      </span>
      <span className="text-xs font-mono w-8 text-right">
        {value}
      </span>
      <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${percent}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
