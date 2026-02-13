"use client"

import { useMutation } from "@tanstack/react-query"
import { postJson } from "@/lib/api-client"

interface ImportInput {
  replayUrl?: string
  rawLog?: string
  autoMatchTeams?: boolean
  autoCreateTeams?: boolean
  inferSets?: boolean
}

interface ImportResult {
  battle: {
    id: string
    formatId: string
    team1Name: string
    team2Name: string
    team1Id: string | null
    team2Id: string | null
    winnerId: string | null
    turnCount: number
  }
  teamMatching: {
    team1: {
      action: string
      teamId: string | null
      teamName: string | null
      confidence: number | null
    }
    team2: {
      action: string
      teamId: string | null
      teamName: string | null
      confidence: number | null
    }
  }
}

export function useBattleImport() {
  return useMutation<ImportResult, Error, ImportInput>({
    mutationFn: (input) => postJson<ImportResult>("/api/battles/import", input),
  })
}

export type { ImportInput, ImportResult }
