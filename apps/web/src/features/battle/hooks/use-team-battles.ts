"use client"

import { useQuery } from "@tanstack/react-query"

interface BattleSummary {
  id: string
  formatId: string
  gameType: string
  mode: string
  aiDifficulty: string | null
  team1Name: string
  team2Name: string
  team1Id: string | null
  team2Id: string | null
  batchId: string | null
  winnerId: string | null
  turnCount: number
  createdAt: string
}

interface BattlesResponse {
  battles: BattleSummary[]
  total: number
  page: number
  limit: number
}

interface TeamBattleAnalytics {
  totalBattles: number
  wins: number
  losses: number
  draws: number
  winRate: number
  avgTurnCount: number
  battlesByFormat: Record<string, { total: number; wins: number; losses: number }>
  recentTrend: {
    battleId: string
    result: "win" | "loss" | "draw"
    turnCount: number
    createdAt: string
    opponentName: string
  }[]
}

export function useTeamBattles(teamId: string | undefined, page = 1) {
  return useQuery<BattlesResponse>({
    queryKey: ["team-battles", teamId, page],
    queryFn: async () => {
      const res = await fetch(`/api/battles?teamId=${teamId}&page=${page}&limit=20`)
      if (!res.ok) throw new Error("Failed to fetch battles")
      return res.json()
    },
    enabled: !!teamId,
  })
}

export function useTeamBattleStats(teamId: string | undefined) {
  return useQuery<TeamBattleAnalytics>({
    queryKey: ["team-battle-stats", teamId],
    queryFn: async () => {
      const res = await fetch(`/api/teams/${teamId}/battles/stats`)
      if (!res.ok) throw new Error("Failed to fetch battle stats")
      return res.json()
    },
    enabled: !!teamId,
  })
}

export type { BattleSummary, BattlesResponse, TeamBattleAnalytics }
