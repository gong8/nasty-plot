"use client"

import { Card, CardContent } from "@/components/ui/card"
import type { TeamBattleAnalytics } from "../hooks/use-team-battles"

interface BattleStatsCardsProps {
  stats: TeamBattleAnalytics | undefined
  isLoading: boolean
}

export function BattleStatsCards({ stats, isLoading }: BattleStatsCardsProps) {
  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="py-4 px-4">
              <div className="h-4 w-16 bg-muted rounded animate-pulse mb-2" />
              <div className="h-8 w-12 bg-muted rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const cards = [
    { label: "Win Rate", value: `${stats.winRate}%`, color: "text-green-500" },
    { label: "Total Battles", value: `${stats.totalBattles}`, color: "" },
    { label: "Avg Turns", value: `${stats.avgTurnCount}`, color: "" },
    {
      label: "Record",
      value: `${stats.wins}W - ${stats.losses}L - ${stats.draws}D`,
      color: "",
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="py-4 px-4">
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className={`text-xl font-bold ${card.color}`}>{card.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
