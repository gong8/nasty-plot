import { useQuery } from "@tanstack/react-query"

export interface PopularityData {
  moves: { name: string; usagePercent: number }[]
  items: { name: string; usagePercent: number }[]
  abilities: { name: string; usagePercent: number }[]
  natures: { name: string; count: number }[]
}

export function usePopularityData(pokemonId: string, formatId?: string) {
  return useQuery<PopularityData>({
    queryKey: ["popularity", pokemonId, formatId],
    queryFn: async () => {
      const res = await fetch(
        `/api/pokemon/${pokemonId}/popularity?format=${encodeURIComponent(formatId!)}`,
      )
      if (!res.ok) return { moves: [], items: [], abilities: [], natures: [] }
      const json = await res.json()
      return json.data
    },
    enabled: !!pokemonId && !!formatId,
    staleTime: Infinity,
  })
}
