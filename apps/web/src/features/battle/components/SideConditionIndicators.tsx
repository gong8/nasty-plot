"use client"

import { Shield, Flame, Bug, Wind, Snowflake } from "lucide-react"
import type { SideConditions } from "@nasty-plot/battle-engine"
import { cn } from "@nasty-plot/ui"

interface SideConditionIndicatorsProps {
  conditions: SideConditions
  side: "player" | "opponent"
  className?: string
}

type ConditionDef = {
  key: keyof SideConditions
  Icon: typeof Flame
  color: string
  label: (value: number | boolean) => string
}

const CONDITION_DEFS: ConditionDef[] = [
  {
    key: "stealthRock",
    Icon: Flame,
    color: "text-amber-600 dark:text-amber-400",
    label: () => "SR",
  },
  {
    key: "spikes",
    Icon: Bug,
    color: "text-amber-600 dark:text-amber-400",
    label: (v) => `Spk\u00d7${v}`,
  },
  {
    key: "toxicSpikes",
    Icon: Bug,
    color: "text-purple-600 dark:text-purple-400",
    label: (v) => `TSpk\u00d7${v}`,
  },
  { key: "stickyWeb", Icon: Bug, color: "text-amber-600 dark:text-amber-400", label: () => "Web" },
  {
    key: "reflect",
    Icon: Shield,
    color: "text-blue-500 dark:text-blue-400",
    label: (v) => `Ref(${v})`,
  },
  {
    key: "lightScreen",
    Icon: Shield,
    color: "text-yellow-500 dark:text-yellow-400",
    label: (v) => `LS(${v})`,
  },
  {
    key: "auroraVeil",
    Icon: Snowflake,
    color: "text-cyan-500 dark:text-cyan-400",
    label: (v) => `AV(${v})`,
  },
  {
    key: "tailwind",
    Icon: Wind,
    color: "text-teal-500 dark:text-teal-400",
    label: (v) => `TW(${v})`,
  },
]

export function SideConditionIndicators({
  conditions,
  side,
  className,
}: SideConditionIndicatorsProps) {
  const indicators = CONDITION_DEFS.filter(({ key }) => conditions[key]).map(
    ({ key, Icon, color, label }) => ({
      icon: <Icon className="h-3 w-3" />,
      label: label(conditions[key] as number),
      color,
    }),
  )

  if (indicators.length === 0) return null

  return (
    <div
      className={cn(
        "flex flex-wrap gap-1",
        side === "player" ? "justify-start" : "justify-end",
        className,
      )}
    >
      {indicators.map((ind, i) => (
        <div
          key={i}
          className={cn(
            "flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium",
            "bg-black/10 dark:bg-white/10 backdrop-blur-sm",
            ind.color,
          )}
          title={ind.label}
        >
          {ind.icon}
          <span>{ind.label}</span>
        </div>
      ))}
    </div>
  )
}
