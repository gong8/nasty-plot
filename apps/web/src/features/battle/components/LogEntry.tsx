"use client"

import {
  Sword,
  Heart,
  Skull,
  ArrowRightLeft,
  Shield,
  CloudRain,
  Sparkles,
  Flame,
  Zap,
  AlertTriangle,
  Target,
  Star,
  type LucideIcon,
} from "lucide-react"
import type { BattleLogEntry } from "@nasty-plot/battle-engine"
import { cn } from "@nasty-plot/ui"

const TYPE_ICONS: Record<string, LucideIcon> = {
  move: Sword,
  damage: Flame,
  heal: Heart,
  status: AlertTriangle,
  boost: Zap,
  unboost: Zap,
  switch: ArrowRightLeft,
  faint: Skull,
  weather: CloudRain,
  terrain: Sparkles,
  hazard: Target,
  screen: Shield,
  item: Star,
  ability: Zap,
  tera: Sparkles,
  crit: AlertTriangle,
  supereffective: Zap,
  resisted: Shield,
  immune: Shield,
  win: Star,
}

const TYPE_COLORS: Record<string, string> = {
  move: "text-foreground",
  damage: "text-red-500 dark:text-red-400",
  heal: "text-green-500 dark:text-green-400",
  status: "text-purple-500 dark:text-purple-400",
  boost: "text-blue-500 dark:text-blue-400",
  unboost: "text-orange-500 dark:text-orange-400",
  switch: "text-cyan-500 dark:text-cyan-400",
  faint: "text-red-700 dark:text-red-500 font-bold",
  weather: "text-yellow-600 dark:text-yellow-400",
  terrain: "text-green-600 dark:text-green-400",
  hazard: "text-amber-600 dark:text-amber-400",
  screen: "text-blue-500 dark:text-blue-400",
  item: "text-yellow-500 dark:text-yellow-400",
  ability: "text-indigo-500 dark:text-indigo-400",
  tera: "text-pink-500 dark:text-pink-400 font-bold",
  crit: "text-orange-500 dark:text-orange-400 italic",
  supereffective: "text-green-500 dark:text-green-400 italic",
  resisted: "text-muted-foreground italic",
  immune: "text-muted-foreground italic",
  win: "font-bold text-foreground",
  info: "text-muted-foreground",
  start: "text-muted-foreground",
  end: "text-muted-foreground",
  cant: "text-muted-foreground",
}

/**
 * Format a log message with rich text:
 * - Move names (after "used") in italic
 * - Damage percentages (XX%) in monospace
 */
export function formatLogMessage(message: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  let key = 0

  // Pattern: text after "used " until "!"
  const moveRegex = /used (.+?)!/
  const moveMatch = message.match(moveRegex)

  if (moveMatch) {
    const moveIdx = message.indexOf(`used ${moveMatch[1]}!`)
    const before = message.slice(0, moveIdx + 5) // "...used "
    const moveName = moveMatch[1]
    const after = message.slice(moveIdx + 5 + moveName.length)

    parts.push(<span key={key++}>{formatWithPercentages(before)}</span>)
    parts.push(
      <em key={key++} className="font-medium">
        {moveName}
      </em>,
    )
    parts.push(<span key={key++}>{formatWithPercentages(after)}</span>)
  } else {
    parts.push(<span key={key++}>{formatWithPercentages(message)}</span>)
  }

  return <>{parts}</>
}

function formatWithPercentages(text: string): React.ReactNode {
  const parts = text.split(/(\d+%)/g)
  return parts.map((part, i) => {
    if (/^\d+%$/.test(part)) {
      return (
        <code key={i} className="text-xs px-0.5 rounded bg-muted font-mono">
          {part}
        </code>
      )
    }
    return part
  })
}

interface LogEntryProps {
  entry: BattleLogEntry
  className?: string
}

export function LogEntry({ entry, className }: LogEntryProps) {
  const Icon = TYPE_ICONS[entry.type]
  const colorClass = TYPE_COLORS[entry.type] || "text-muted-foreground"

  return (
    <div className={cn("flex items-start gap-2 py-0.5 px-2", colorClass, className)}>
      {Icon && <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0 opacity-70" />}
      <span className="text-sm leading-relaxed font-mono">{formatLogMessage(entry.message)}</span>
    </div>
  )
}
