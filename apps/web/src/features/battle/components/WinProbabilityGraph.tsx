"use client"

import { useMemo } from "react"
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  ReferenceLine,
  Tooltip,
  CartesianGrid,
} from "recharts"
import type { ReplayFrame } from "@nasty-plot/battle-engine"
import { cn } from "@/lib/utils"

interface WinProbabilityGraphProps {
  frames: ReplayFrame[]
  currentTurn?: number
  p1Name?: string
  className?: string
}

export function WinProbabilityGraph({
  frames,
  currentTurn,
  p1Name = "Player",
  className,
}: WinProbabilityGraphProps) {
  const data = useMemo(
    () =>
      frames
        .filter((f) => f.winProbTeam1 != null)
        .map((f) => ({
          turn: f.turnNumber,
          winProb: f.winProbTeam1!,
        })),
    [frames],
  )

  if (data.length < 2) return null

  return (
    <div className={cn("w-full h-[200px]", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis
            dataKey="turn"
            tick={{ fontSize: 11 }}
            label={{ value: "Turn", position: "insideBottom", offset: -2, fontSize: 11 }}
          />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
          <ReferenceLine
            y={50}
            stroke="hsl(var(--muted-foreground))"
            strokeDasharray="3 3"
            opacity={0.5}
          />
          {currentTurn != null && (
            <ReferenceLine
              x={currentTurn}
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              opacity={0.7}
            />
          )}
          <Tooltip
            formatter={(value) => [`${Math.round(Number(value ?? 0))}%`, p1Name]}
            labelFormatter={(label) => `Turn ${label}`}
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "6px",
              fontSize: 12,
            }}
          />
          <Line
            type="monotone"
            dataKey="winProb"
            stroke="hsl(210, 100%, 56%)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
