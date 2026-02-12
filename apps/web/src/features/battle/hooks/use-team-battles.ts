"use client"

import { useQuery } from "@tanstack/react-query"
import type { TeamBattleAnalytics } from "@nasty-plot/battle-engine"
import type { BattleSummary } from "../types"

interface BattlesResponse {
  battles: BattleSummary[]
  total: number
  page: number
  limit: number
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
