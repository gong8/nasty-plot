"use client"

import { useMutation } from "@tanstack/react-query"

interface ImportInput {
  replayUrl?: string
  rawLog?: string
  autoMatchTeams?: boolean
  autoCreateTeams?: boolean
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
    mutationFn: async (input) => {
      const res = await fetch("/api/battles/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || "Import failed")
      }
      return res.json()
    },
  })
}

export type { ImportInput, ImportResult }
