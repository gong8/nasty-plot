"use client"

import { useQuery } from "@tanstack/react-query"
import type { SampleTeamData } from "@nasty-plot/teams"
import { fetchJson } from "@/lib/api-client"

/** API returns SampleTeamData without the Date-typed createdAt field */
type SampleTeamApiData = Omit<SampleTeamData, "createdAt">

export function useSampleTeams(formatId?: string) {
  return useQuery<SampleTeamApiData[]>({
    queryKey: ["sample-teams", formatId],
    queryFn: () => fetchJson<SampleTeamApiData[]>(`/api/sample-teams?formatId=${formatId}`),
    enabled: !!formatId,
    staleTime: 5 * 60 * 1000,
  })
}
