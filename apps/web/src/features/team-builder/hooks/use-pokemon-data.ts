import { useQuery } from "@tanstack/react-query"
import type { PokemonSpecies } from "@nasty-plot/core"

export function usePokemonQuery(pokemonId: string | null) {
  return useQuery<PokemonSpecies>({
    queryKey: ["pokemon", pokemonId],
    queryFn: async () => {
      const res = await fetch(`/api/pokemon/${pokemonId}`)
      if (!res.ok) throw new Error("Not found")
      const json = await res.json()
      return json.data
    },
    enabled: !!pokemonId,
  })
}

export function useLearnsetQuery(pokemonId: string | null, formatId?: string) {
  return useQuery<string[]>({
    queryKey: ["learnset", pokemonId, formatId],
    queryFn: async () => {
      let url = `/api/pokemon/${pokemonId}/learnset`
      if (formatId) url += `?format=${encodeURIComponent(formatId)}`
      const res = await fetch(url)
      if (!res.ok) return []
      const json = await res.json()
      const moves = json.data ?? []
      return moves.map((m: { name: string }) => m.name)
    },
    enabled: !!pokemonId,
  })
}
