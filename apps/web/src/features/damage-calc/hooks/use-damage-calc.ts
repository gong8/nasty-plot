"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import type { DamageCalcInput, DamageCalcResult, MatchupMatrixEntry } from "@nasty-plot/core"
import { postApiData } from "@/lib/api-client"

export function useDamageCalc() {
  return useMutation({
    mutationFn: (input: DamageCalcInput) =>
      postApiData<DamageCalcResult>("/api/damage-calc", input),
  })
}

export function useMatchupMatrix(teamId: string | undefined, formatId: string | undefined) {
  return useQuery({
    queryKey: ["matchup-matrix", teamId, formatId],
    enabled: !!teamId && !!formatId,
    queryFn: () =>
      postApiData<MatchupMatrixEntry[][]>("/api/damage-calc/matchup-matrix", { teamId, formatId }),
  })
}
