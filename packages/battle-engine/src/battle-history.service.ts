/**
 * Battle History Analytics Service
 *
 * Computes analytics for a team's battle history.
 */

import type { BattleRecord } from "./export/battle-export.service"

export interface TeamBattleAnalytics {
  totalBattles: number
  wins: number
  losses: number
  draws: number
  winRate: number
  avgTurnCount: number
  battlesByFormat: Record<string, { total: number; wins: number; losses: number }>
  recentTrend: {
    battleId: string
    result: "win" | "loss" | "draw"
    turnCount: number
    createdAt: string
    opponentName: string
  }[]
}

/**
 * Compute analytics for battles involving a given team.
 * Pure function — no DB access.
 */
export function computeTeamBattleAnalytics(
  teamId: string,
  battles: (BattleRecord & { team1Id?: string | null; team2Id?: string | null })[],
): TeamBattleAnalytics {
  let wins = 0
  let losses = 0
  let draws = 0
  let totalTurns = 0
  const battlesByFormat: Record<string, { total: number; wins: number; losses: number }> = {}
  const recentTrend: TeamBattleAnalytics["recentTrend"] = []

  // Sort by date descending for recent trend
  const sorted = [...battles].sort((a, b) => {
    const aTime =
      a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime()
    const bTime =
      b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime()
    return bTime - aTime
  })

  for (const battle of sorted) {
    // Determine which side this team is on
    const isTeam1 = battle.team1Id === teamId
    const isTeam2 = battle.team2Id === teamId
    if (!isTeam1 && !isTeam2) continue

    const teamSide = isTeam1 ? "team1" : "team2"
    const opponentName = isTeam1 ? battle.team2Name : battle.team1Name

    // Determine result
    let result: "win" | "loss" | "draw"
    if (battle.winnerId === "draw" || !battle.winnerId) {
      result = battle.winnerId === "draw" ? "draw" : "draw"
      draws++
    } else if (battle.winnerId === teamSide) {
      result = "win"
      wins++
    } else {
      result = "loss"
      losses++
    }

    totalTurns += battle.turnCount

    // Format breakdown
    if (!battlesByFormat[battle.formatId]) {
      battlesByFormat[battle.formatId] = { total: 0, wins: 0, losses: 0 }
    }
    battlesByFormat[battle.formatId].total++
    if (result === "win") battlesByFormat[battle.formatId].wins++
    if (result === "loss") battlesByFormat[battle.formatId].losses++

    // Recent trend (last 20)
    if (recentTrend.length < 20) {
      recentTrend.push({
        battleId: battle.id,
        result,
        turnCount: battle.turnCount,
        createdAt:
          battle.createdAt instanceof Date ? battle.createdAt.toISOString() : battle.createdAt,
        opponentName,
      })
    }
  }

  const totalBattles = wins + losses + draws

  return {
    totalBattles,
    wins,
    losses,
    draws,
    winRate: totalBattles > 0 ? Math.round((wins / totalBattles) * 1000) / 10 : 0,
    avgTurnCount: totalBattles > 0 ? Math.round((totalTurns / totalBattles) * 10) / 10 : 0,
    battlesByFormat,
    recentTrend,
  }
}
