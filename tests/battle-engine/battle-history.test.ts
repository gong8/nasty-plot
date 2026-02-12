import { computeTeamBattleAnalytics } from "@nasty-plot/battle-engine"
import type { BattleRecord } from "@nasty-plot/battle-engine"

type BattleWithTeams = BattleRecord & { team1Id?: string | null; team2Id?: string | null }

function makeBattle(overrides: Partial<BattleWithTeams>): BattleWithTeams {
  return {
    id: `battle-${Math.random().toString(36).slice(2)}`,
    formatId: "gen9ou",
    gameType: "singles",
    mode: "play",
    team1Name: "Alice",
    team2Name: "Bob",
    team1Paste: "",
    team2Paste: "",
    team1Id: null,
    team2Id: null,
    winnerId: null,
    turnCount: 20,
    protocolLog: "",
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

describe("battle-history", () => {
  const teamId = "my-team-id"

  describe("computeTeamBattleAnalytics", () => {
    it("returns zeros for empty battles", () => {
      const result = computeTeamBattleAnalytics(teamId, [])
      expect(result.totalBattles).toBe(0)
      expect(result.wins).toBe(0)
      expect(result.losses).toBe(0)
      expect(result.draws).toBe(0)
      expect(result.winRate).toBe(0)
      expect(result.avgTurnCount).toBe(0)
      expect(result.recentTrend).toHaveLength(0)
    })

    it("counts wins when team is team1", () => {
      const battles = [
        makeBattle({ team1Id: teamId, winnerId: "team1", turnCount: 15 }),
        makeBattle({ team1Id: teamId, winnerId: "team2", turnCount: 25 }),
        makeBattle({ team1Id: teamId, winnerId: "team1", turnCount: 10 }),
      ]
      const result = computeTeamBattleAnalytics(teamId, battles)
      expect(result.wins).toBe(2)
      expect(result.losses).toBe(1)
      expect(result.totalBattles).toBe(3)
      expect(result.winRate).toBeCloseTo(66.7, 0)
    })

    it("counts wins when team is team2", () => {
      const battles = [
        makeBattle({ team2Id: teamId, winnerId: "team2" }),
        makeBattle({ team2Id: teamId, winnerId: "team1" }),
      ]
      const result = computeTeamBattleAnalytics(teamId, battles)
      expect(result.wins).toBe(1)
      expect(result.losses).toBe(1)
    })

    it("handles draws", () => {
      const battles = [
        makeBattle({ team1Id: teamId, winnerId: "draw" }),
        makeBattle({ team1Id: teamId, winnerId: "team1" }),
      ]
      const result = computeTeamBattleAnalytics(teamId, battles)
      expect(result.draws).toBe(1)
      expect(result.wins).toBe(1)
    })

    it("computes average turn count", () => {
      const battles = [
        makeBattle({ team1Id: teamId, winnerId: "team1", turnCount: 10 }),
        makeBattle({ team1Id: teamId, winnerId: "team1", turnCount: 30 }),
      ]
      const result = computeTeamBattleAnalytics(teamId, battles)
      expect(result.avgTurnCount).toBe(20)
    })

    it("breaks down by format", () => {
      const battles = [
        makeBattle({ team1Id: teamId, winnerId: "team1", formatId: "gen9ou" }),
        makeBattle({ team1Id: teamId, winnerId: "team2", formatId: "gen9ou" }),
        makeBattle({ team1Id: teamId, winnerId: "team1", formatId: "gen9uu" }),
      ]
      const result = computeTeamBattleAnalytics(teamId, battles)
      expect(result.battlesByFormat["gen9ou"]).toEqual({ total: 2, wins: 1, losses: 1 })
      expect(result.battlesByFormat["gen9uu"]).toEqual({ total: 1, wins: 1, losses: 0 })
    })

    it("limits recent trend to 20 entries", () => {
      const battles = Array.from({ length: 30 }, (_, i) =>
        makeBattle({
          team1Id: teamId,
          winnerId: "team1",
          createdAt: new Date(Date.now() - i * 1000).toISOString(),
        }),
      )
      const result = computeTeamBattleAnalytics(teamId, battles)
      expect(result.recentTrend).toHaveLength(20)
    })

    it("sorts recent trend by date descending", () => {
      const battles = [
        makeBattle({
          team1Id: teamId,
          winnerId: "team1",
          createdAt: "2025-01-01T00:00:00Z",
        }),
        makeBattle({
          team1Id: teamId,
          winnerId: "team2",
          createdAt: "2025-01-03T00:00:00Z",
        }),
        makeBattle({
          team1Id: teamId,
          winnerId: "team1",
          createdAt: "2025-01-02T00:00:00Z",
        }),
      ]
      const result = computeTeamBattleAnalytics(teamId, battles)
      expect(result.recentTrend[0].result).toBe("loss") // Jan 3
      expect(result.recentTrend[1].result).toBe("win") // Jan 2
      expect(result.recentTrend[2].result).toBe("win") // Jan 1
    })

    it("skips battles not involving the team", () => {
      const battles = [
        makeBattle({ team1Id: "other-team", team2Id: "another-team", winnerId: "team1" }),
        makeBattle({ team1Id: teamId, winnerId: "team1" }),
      ]
      const result = computeTeamBattleAnalytics(teamId, battles)
      expect(result.totalBattles).toBe(1)
    })

    it("shows correct opponent name", () => {
      const battles = [
        makeBattle({
          team1Id: teamId,
          team1Name: "My Team",
          team2Name: "Opponent Team",
          winnerId: "team1",
        }),
      ]
      const result = computeTeamBattleAnalytics(teamId, battles)
      expect(result.recentTrend[0].opponentName).toBe("Opponent Team")
    })
  })
})
