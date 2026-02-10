"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import type {
  DamageCalcInput,
  DamageCalcResult,
  MatchupMatrixEntry,
  ApiResponse,
} from "@/shared/types";

export function useDamageCalc() {
  return useMutation({
    mutationFn: async (input: DamageCalcInput): Promise<DamageCalcResult> => {
      const res = await fetch("/api/damage-calc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Calculation failed");
      }
      const json: ApiResponse<DamageCalcResult> = await res.json();
      return json.data;
    },
  });
}

export function useMatchupMatrix(teamId: string | undefined, formatId: string | undefined) {
  return useQuery({
    queryKey: ["matchup-matrix", teamId, formatId],
    enabled: !!teamId && !!formatId,
    queryFn: async (): Promise<MatchupMatrixEntry[][]> => {
      const res = await fetch("/api/damage-calc/matchup-matrix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, formatId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Matrix calculation failed");
      }
      const json: ApiResponse<MatchupMatrixEntry[][]> = await res.json();
      return json.data;
    },
  });
}
