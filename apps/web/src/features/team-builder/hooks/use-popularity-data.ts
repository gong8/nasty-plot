import { useQuery } from "@tanstack/react-query"
import type { NatureName } from "@nasty-plot/core"
import { fetchApiData } from "@/lib/api-client"

export interface PopularityData {
  moves: { name: string; usagePercent: number }[]
  items: { name: string; usagePercent: number }[]
  abilities: { name: string; usagePercent: number }[]
  natures: { name: NatureName; count: number }[]
}

const EMPTY_POPULARITY: PopularityData = { moves: [], items: [], abilities: [], natures: [] }

export function usePopularityData(pokemonId: string, formatId?: string) {
  return useQuery<PopularityData>({
    queryKey: ["popularity", pokemonId, formatId],
    queryFn: async () => {
      try {
        return await fetchApiData<PopularityData>(
          `/api/pokemon/${pokemonId}/popularity?formatId=${encodeURIComponent(formatId!)}`,
        )
      } catch {
        return EMPTY_POPULARITY
      }
    },
    enabled: !!pokemonId && !!formatId,
    staleTime: Infinity,
  })
}
