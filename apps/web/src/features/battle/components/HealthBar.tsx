"use client"

import { useRef, useEffect, useState } from "react"
import { cn } from "@nasty-plot/ui"
import { calcHpPercent } from "@nasty-plot/battle-engine"

const GLOW_DURATION_MS = 600

interface HealthBarProps {
  hp: number
  maxHp: number
  className?: string
  showText?: boolean
  animate?: boolean
}

export function getHealthColor(percent: number): string {
  if (percent > 50) return "bg-green-500"
  if (percent > 20) return "bg-yellow-500"
  return "bg-red-500"
}

export function getHealthColorHex(percent: number): string {
  if (percent > 50) return "#22c55e"
  if (percent > 20) return "#eab308"
  return "#ef4444"
}

export function HealthBar({
  hp,
  maxHp,
  className,
  showText = true,
  animate = true,
}: HealthBarProps) {
  const percent = calcHpPercent(hp, maxHp)
  const prevPercentRef = useRef(percent)
  const [glowClass, setGlowClass] = useState("")

  useEffect(() => {
    const prev = prevPercentRef.current
    prevPercentRef.current = percent

    if (prev === percent || !animate) return

    const animation = percent < prev ? "animate-battle-damage-glow" : "animate-battle-heal-glow"
    setGlowClass(animation) // eslint-disable-line react-hooks/set-state-in-effect -- animation trigger on value change
    const timeout = setTimeout(() => setGlowClass(""), GLOW_DURATION_MS)
    return () => clearTimeout(timeout)
  }, [percent, animate])

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn(
          "flex-1 h-2.5 bg-muted rounded-full overflow-hidden border border-border",
          glowClass,
        )}
      >
        <div
          className={cn(
            "h-full rounded-full",
            getHealthColor(percent),
            animate && "transition-all duration-500 ease-out",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      {showText && (
        <span className="text-xs font-mono text-muted-foreground min-w-[72px] text-right">
          {hp}/{maxHp}
        </span>
      )}
    </div>
  )
}
