import type {
  ChatContextMode,
  TeamChatContextData,
  BattleLiveChatContextData,
  BattleReplayChatContextData,
  ChatContextData,
} from "@nasty-plot/core"

// ---------------------------------------------------------------------------
// chat-context.ts exports only types — verify they satisfy expected shapes
// ---------------------------------------------------------------------------

describe("ChatContextMode type", () => {
  it("accepts valid context modes", () => {
    const modes: ChatContextMode[] = [
      "guided-builder",
      "team-editor",
      "battle-live",
      "battle-replay",
    ]
    expect(modes).toHaveLength(4)
  })
})

describe("TeamChatContextData type", () => {
  it("satisfies the expected shape", () => {
    const data: TeamChatContextData = {
      teamId: "team-1",
      teamName: "My Team",
      formatId: "gen9ou",
    }
    expect(data.teamId).toBe("team-1")
    expect(data.teamName).toBe("My Team")
    expect(data.formatId).toBe("gen9ou")
  })

  it("allows optional paste field", () => {
    const data: TeamChatContextData = {
      teamId: "team-1",
      teamName: "My Team",
      formatId: "gen9ou",
      paste: "Garchomp @ Leftovers",
    }
    expect(data.paste).toBe("Garchomp @ Leftovers")
  })
})

describe("BattleLiveChatContextData type", () => {
  it("satisfies the expected shape", () => {
    const data: BattleLiveChatContextData = {
      formatId: "gen9ou",
      team1Name: "Team A",
      team2Name: "Team B",
    }
    expect(data.formatId).toBe("gen9ou")
  })

  it("allows optional aiDifficulty", () => {
    const data: BattleLiveChatContextData = {
      formatId: "gen9ou",
      team1Name: "Team A",
      team2Name: "Team B",
      aiDifficulty: "expert",
    }
    expect(data.aiDifficulty).toBe("expert")
  })
})

describe("BattleReplayChatContextData type", () => {
  it("satisfies the expected shape", () => {
    const data: BattleReplayChatContextData = {
      battleId: "battle-1",
      formatId: "gen9ou",
      team1Name: "Team A",
      team2Name: "Team B",
      turnCount: 25,
    }
    expect(data.turnCount).toBe(25)
  })

  it("allows optional winnerId", () => {
    const data: BattleReplayChatContextData = {
      battleId: "battle-1",
      formatId: "gen9ou",
      team1Name: "Team A",
      team2Name: "Team B",
      turnCount: 25,
      winnerId: "p1",
    }
    expect(data.winnerId).toBe("p1")
  })
})

describe("ChatContextData union type", () => {
  it("accepts TeamChatContextData", () => {
    const data: ChatContextData = {
      teamId: "team-1",
      teamName: "My Team",
      formatId: "gen9ou",
    }
    expect(data).toBeDefined()
  })

  it("accepts BattleLiveChatContextData", () => {
    const data: ChatContextData = {
      formatId: "gen9ou",
      team1Name: "A",
      team2Name: "B",
    }
    expect(data).toBeDefined()
  })

  it("accepts BattleReplayChatContextData", () => {
    const data: ChatContextData = {
      battleId: "b-1",
      formatId: "gen9ou",
      team1Name: "A",
      team2Name: "B",
      turnCount: 10,
    }
    expect(data).toBeDefined()
  })
})
