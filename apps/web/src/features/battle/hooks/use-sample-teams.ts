"use client"

import { useQuery } from "@tanstack/react-query"
import type { SampleTeamData } from "@nasty-plot/teams"

/** API returns SampleTeamData without the Date-typed createdAt field */
type SampleTeamApiData = Omit<SampleTeamData, "createdAt">

async function fetchSampleTeams(formatId: string): Promise<SampleTeamApiData[]> {
  const res = await fetch(`/api/sample-teams?formatId=${formatId}`)
  if (!res.ok) throw new Error("Failed to fetch sample teams")
  return res.json()
}

export function useSampleTeams(formatId?: string) {
  return useQuery<SampleTeamApiData[]>({
    queryKey: ["sample-teams", formatId],
    queryFn: () => fetchSampleTeams(formatId!),
    enabled: !!formatId,
    staleTime: 5 * 60 * 1000,
  })
}
