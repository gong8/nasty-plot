"use client"

import { useQuery } from "@tanstack/react-query"
import type { TeamBattleAnalytics } from "@nasty-plot/battle-engine"
import type { BattleSummary } from "../types"
import { fetchJson } from "@/lib/api-client"

interface BattlesResponse {
  battles: BattleSummary[]
  total: number
  page: number
  limit: number
}

export function useTeamBattles(teamId: string | undefined, page = 1) {
  return useQuery<BattlesResponse>({
    queryKey: ["team-battles", teamId, page],
    queryFn: () =>
      fetchJson<BattlesResponse>(`/api/battles?teamId=${teamId}&page=${page}&limit=20`),
    enabled: !!teamId,
  })
}

export function useTeamBattleStats(teamId: string | undefined) {
  return useQuery<TeamBattleAnalytics>({
    queryKey: ["team-battle-stats", teamId],
    queryFn: () => fetchJson<TeamBattleAnalytics>(`/api/teams/${teamId}/battles/stats`),
    enabled: !!teamId,
  })
}

export type { BattleSummary, BattlesResponse, TeamBattleAnalytics }
