import { formatShowdownLog, formatShowdownReplayJSON } from "@nasty-plot/battle-engine"
import type { BattleRecord } from "@nasty-plot/battle-engine"

function makeBattle(overrides?: Partial<BattleRecord>): BattleRecord {
  return {
    id: "test-battle-123",
    formatId: "gen9ou",
    gameType: "singles",
    mode: "play",
    team1Name: "Alice",
    team2Name: "Bob",
    team1Paste: "Garchomp @ Choice Scarf",
    team2Paste: "Great Tusk @ Leftovers",
    winnerId: "team1",
    turnCount: 25,
    protocolLog: "|player|p1|Alice|\n|player|p2|Bob|\n|turn|1\n|win|Alice",
    createdAt: "2025-01-15T10:00:00.000Z",
    ...overrides,
  }
}

describe("battle-export", () => {
  describe("formatShowdownLog", () => {
    it("returns the raw protocol log", () => {
      const battle = makeBattle()
      const log = formatShowdownLog(battle)
      expect(log).toBe(battle.protocolLog)
    })

    it("preserves all protocol lines", () => {
      const battle = makeBattle({
        protocolLog: "|turn|1\n|move|p1a: Garchomp|Earthquake|\n|win|Alice",
      })
      const log = formatShowdownLog(battle)
      expect(log).toContain("|turn|1")
      expect(log).toContain("|move|p1a: Garchomp|Earthquake|")
      expect(log).toContain("|win|Alice")
    })
  })

  describe("formatShowdownReplayJSON", () => {
    it("returns structured replay JSON", () => {
      const battle = makeBattle()
      const json = formatShowdownReplayJSON(battle)

      expect(json.id).toBe("test-battle-123")
      expect(json.format).toBe("gen9ou")
      expect(json.players).toEqual(["Alice", "Bob"])
      expect(json.turns).toBe(25)
      expect(json.winner).toBe("Alice")
      expect(json.log).toBe(battle.protocolLog)
    })

    it("maps team2 winner correctly", () => {
      const battle = makeBattle({ winnerId: "team2" })
      const json = formatShowdownReplayJSON(battle)
      expect(json.winner).toBe("Bob")
    })

    it("handles draw", () => {
      const battle = makeBattle({ winnerId: "draw" })
      const json = formatShowdownReplayJSON(battle)
      expect(json.winner).toBe("")
    })

    it("handles null winner", () => {
      const battle = makeBattle({ winnerId: null })
      const json = formatShowdownReplayJSON(battle)
      expect(json.winner).toBe("")
    })

    it("converts createdAt string to unix timestamp", () => {
      const battle = makeBattle({ createdAt: "2025-01-15T10:00:00.000Z" })
      const json = formatShowdownReplayJSON(battle)
      expect(json.uploadtime).toBe(
        Math.floor(new Date("2025-01-15T10:00:00.000Z").getTime() / 1000),
      )
    })

    it("handles Date object for createdAt", () => {
      const date = new Date("2025-01-15T10:00:00.000Z")
      const battle = makeBattle({ createdAt: date as unknown as string })
      const json = formatShowdownReplayJSON(battle)
      expect(json.uploadtime).toBe(Math.floor(date.getTime() / 1000))
    })
  })
})
