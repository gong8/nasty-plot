"use client"

import { cn } from "@nasty-plot/ui"
import { Hammer, Wrench, Swords, Film } from "lucide-react"
import type { ChatContextMode } from "@nasty-plot/core"

const MODE_CONFIG: Record<
  ChatContextMode,
  { label: string; icon: typeof Hammer; className: string }
> = {
  "guided-builder": {
    label: "Build",
    icon: Hammer,
    className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
  "team-editor": {
    label: "Team",
    icon: Wrench,
    className: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  },
  "battle-live": {
    label: "Battle",
    icon: Swords,
    className: "bg-red-500/15 text-red-600 dark:text-red-400",
  },
  "battle-replay": {
    label: "Replay",
    icon: Film,
    className: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
  },
}

interface ContextModeBadgeProps {
  mode: string
  className?: string
}

export function ContextModeBadge({ mode, className }: ContextModeBadgeProps) {
  const config = MODE_CONFIG[mode as ChatContextMode]
  if (!config) return null

  const Icon = config.icon

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none",
        config.className,
        className,
      )}
    >
      <Icon className="h-2.5 w-2.5" />
      {config.label}
    </span>
  )
}
