"use client"

import { useQuery } from "@tanstack/react-query"

export interface SampleTeamData {
  id: string
  name: string
  formatId: string
  archetype: string | null
  source: string | null
  sourceUrl: string | null
  paste: string
  pokemonIds: string
  isActive: boolean
}

async function fetchSampleTeams(formatId: string): Promise<SampleTeamData[]> {
  const res = await fetch(`/api/sample-teams?formatId=${formatId}`)
  if (!res.ok) throw new Error("Failed to fetch sample teams")
  return res.json()
}

export function useSampleTeams(formatId?: string) {
  return useQuery<SampleTeamData[]>({
    queryKey: ["sample-teams", formatId],
    queryFn: () => fetchSampleTeams(formatId!),
    enabled: !!formatId,
    staleTime: 5 * 60 * 1000,
  })
}
