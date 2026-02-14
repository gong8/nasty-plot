import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  calculateAllStats,
  type PokemonSpecies,
  type StatsTable,
  type NatureName,
} from "@nasty-plot/core"
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

/** Derives abilities list and calculated stats from species data + current set. */
export function useSpeciesDerived(
  speciesData: PokemonSpecies | undefined,
  ivs: StatsTable,
  evs: StatsTable,
  level: number,
  nature: NatureName,
) {
  const abilities = useMemo(() => {
    if (!speciesData?.abilities) return []
    return Object.values(speciesData.abilities)
  }, [speciesData])

  const calculatedStats = useMemo(() => {
    if (!speciesData?.baseStats) return null
    return calculateAllStats(speciesData.baseStats, ivs, evs, level, nature)
  }, [speciesData, ivs, evs, level, nature])

  return { abilities, calculatedStats }
}
