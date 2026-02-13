import { useQuery } from "@tanstack/react-query"
import type { PokemonSpecies } from "@nasty-plot/core"
import { fetchApiData } from "@/lib/api-client"

export function usePokemonQuery(pokemonId: string | null) {
  return useQuery<PokemonSpecies>({
    queryKey: ["pokemon", pokemonId],
    queryFn: () => fetchApiData<PokemonSpecies>(`/api/pokemon/${pokemonId}`),
    enabled: !!pokemonId,
  })
}

export function useLearnsetQuery(pokemonId: string | null, formatId?: string) {
  return useQuery<string[]>({
    queryKey: ["learnset", pokemonId, formatId],
    queryFn: async () => {
      let url = `/api/pokemon/${pokemonId}/learnset`
      if (formatId) url += `?formatId=${encodeURIComponent(formatId)}`
      try {
        const moves = await fetchApiData<{ name: string }[]>(url)
        return moves.map((m) => m.name)
      } catch {
        return []
      }
    },
    enabled: !!pokemonId,
  })
}
