"use client"

import { cn } from "@/lib/utils"

interface DamageNumberProps {
  value: string | null // e.g. "-45%" or "+20%"
  side?: "p1" | "p2"
  slotIndex?: number
  className?: string
}

export function DamageNumber({ value, side, slotIndex = 0, className }: DamageNumberProps) {
  if (!value) return null

  const isHeal = value.startsWith("+")

  return (
    <div
      className={cn(
        "absolute z-30 pointer-events-none",
        side === "p1" ? "bottom-[40%] left-[25%]" : "top-[20%] right-[25%]",
        "animate-[battle-damage-number_1s_ease-out_forwards]",
        className,
      )}
    >
      <span
        className={cn(
          "text-lg font-black tabular-nums",
          "drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]",
          isHeal ? "text-green-400" : "text-red-400",
        )}
      >
        {value}
      </span>
    </div>
  )
}
