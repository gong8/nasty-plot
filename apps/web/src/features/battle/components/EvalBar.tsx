"use client"

import { cn } from "@/lib/utils"

interface EvalBarProps {
  p1WinProb: number // 0-100
  p2WinProb: number // 0-100
  p1Name?: string
  p2Name?: string
  className?: string
}

export function EvalBar({ p1WinProb, p2WinProb, className }: EvalBarProps) {
  const p1Rounded = Math.round(p1WinProb)
  const p2Rounded = Math.round(p2WinProb)

  return (
    <div
      className={cn("relative w-7 flex-shrink-0 rounded-lg overflow-hidden select-none", className)}
    >
      {/* Opponent (p2) — muted dark, fills from top */}
      <div
        className="absolute inset-x-0 top-0 transition-all duration-700 ease-out bg-muted-foreground/25"
        style={{ height: `${p2WinProb}%` }}
      />
      {/* Player (p1) — primary brand color, fills from bottom */}
      <div
        className="absolute inset-x-0 bottom-0 transition-all duration-700 ease-out bg-primary/80"
        style={{ height: `${p1WinProb}%` }}
      />

      {/* Opponent number — pinned near top */}
      <span className="absolute top-1.5 inset-x-0 text-center text-[10px] font-semibold tabular-nums leading-none text-muted-foreground z-10">
        {p2Rounded}
      </span>

      {/* Player number — pinned near bottom */}
      <span className="absolute bottom-1.5 inset-x-0 text-center text-[10px] font-semibold tabular-nums leading-none text-primary-foreground z-10">
        {p1Rounded}
      </span>
    </div>
  )
}
