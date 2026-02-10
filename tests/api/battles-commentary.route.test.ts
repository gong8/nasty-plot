import { vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@nasty-plot/llm", () => ({
  buildTurnCommentaryContext: vi.fn().mockReturnValue({
    systemPrompt: "You are a battle commentator.",
    turnContext: "Turn 1: Garchomp used Earthquake!",
  }),
  buildPostBattleContext: vi.fn().mockReturnValue("Post-battle summary context"),
  buildTurnAnalysisContext: vi.fn().mockReturnValue("Turn analysis context"),
  getOpenAI: vi.fn().mockReturnValue({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          [Symbol.asyncIterator]: async function* () {
            yield { choices: [{ delta: { content: "Great " } }] }
            yield { choices: [{ delta: { content: "play!" } }] }
          },
        }),
      },
    },
  }),
  MODEL: "gpt-4o-mini",
}))

import {
  buildTurnCommentaryContext,
  buildPostBattleContext,
  buildTurnAnalysisContext,
} from "@nasty-plot/llm"
import { POST } from "../../apps/web/src/app/api/battles/commentary/route"

describe("POST /api/battles/commentary", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns SSE stream for turn commentary mode", async () => {
    const req = new NextRequest("http://localhost:3000/api/battles/commentary", {
      method: "POST",
      body: JSON.stringify({
        mode: "turn",
        state: { turn: 1, sides: {} },
        recentEntries: ["|move|p1a: Garchomp|Earthquake"],
        team1Name: "Player",
        team2Name: "Opponent",
      }),
      headers: { "Content-Type": "application/json" },
    })

    const response = await POST(req)

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("text/event-stream")
    expect(response.headers.get("Cache-Control")).toBe("no-cache")
    expect(buildTurnCommentaryContext).toHaveBeenCalledWith(
      { turn: 1, sides: {} },
      ["|move|p1a: Garchomp|Earthquake"],
      "Player",
      "Opponent",
    )

    // Read the SSE stream
    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let fullText = ""
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      fullText += decoder.decode(value, { stream: true })
    }
    expect(fullText).toContain("Great ")
    expect(fullText).toContain("play!")
    expect(fullText).toContain("[DONE]")
  })

  it("returns SSE stream for post-battle mode", async () => {
    const req = new NextRequest("http://localhost:3000/api/battles/commentary", {
      method: "POST",
      body: JSON.stringify({
        mode: "post-battle",
        allEntries: ["|move|p1a: Garchomp|Earthquake", "|win|p1"],
        team1Name: "Player",
        team2Name: "Opponent",
        winner: "Player",
        totalTurns: 10,
      }),
      headers: { "Content-Type": "application/json" },
    })

    const response = await POST(req)

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("text/event-stream")
    expect(buildPostBattleContext).toHaveBeenCalledWith(
      ["|move|p1a: Garchomp|Earthquake", "|win|p1"],
      "Player",
      "Opponent",
      "Player",
      10,
    )
  })

  it("returns SSE stream for turn-analysis mode", async () => {
    const req = new NextRequest("http://localhost:3000/api/battles/commentary", {
      method: "POST",
      body: JSON.stringify({
        mode: "turn-analysis",
        state: { turn: 3, sides: {} },
        turnEntries: ["|move|p1a: Garchomp|Swords Dance"],
        prevTurnEntries: ["|move|p2a: Dragapult|Draco Meteor"],
      }),
      headers: { "Content-Type": "application/json" },
    })

    const response = await POST(req)

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("text/event-stream")
    expect(buildTurnAnalysisContext).toHaveBeenCalledWith(
      { turn: 3, sides: {} },
      ["|move|p1a: Garchomp|Swords Dance"],
      ["|move|p2a: Dragapult|Draco Meteor"],
    )
  })

  it("returns 400 for invalid mode", async () => {
    const req = new NextRequest("http://localhost:3000/api/battles/commentary", {
      method: "POST",
      body: JSON.stringify({ mode: "invalid" }),
      headers: { "Content-Type": "application/json" },
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe("Invalid mode or missing data")
  })

  it("returns 400 for turn mode without state", async () => {
    const req = new NextRequest("http://localhost:3000/api/battles/commentary", {
      method: "POST",
      body: JSON.stringify({
        mode: "turn",
        recentEntries: ["|move|test"],
      }),
      headers: { "Content-Type": "application/json" },
    })

    const response = await POST(req)
    expect(response.status).toBe(400)
  })

  it("returns 400 for turn mode without recentEntries", async () => {
    const req = new NextRequest("http://localhost:3000/api/battles/commentary", {
      method: "POST",
      body: JSON.stringify({
        mode: "turn",
        state: { turn: 1 },
      }),
      headers: { "Content-Type": "application/json" },
    })

    const response = await POST(req)
    expect(response.status).toBe(400)
  })

  it("returns 400 for post-battle mode without allEntries", async () => {
    const req = new NextRequest("http://localhost:3000/api/battles/commentary", {
      method: "POST",
      body: JSON.stringify({
        mode: "post-battle",
        team1Name: "Player",
      }),
      headers: { "Content-Type": "application/json" },
    })

    const response = await POST(req)
    expect(response.status).toBe(400)
  })

  it("uses default team names when not provided", async () => {
    const req = new NextRequest("http://localhost:3000/api/battles/commentary", {
      method: "POST",
      body: JSON.stringify({
        mode: "turn",
        state: { turn: 1 },
        recentEntries: ["|move|test"],
      }),
      headers: { "Content-Type": "application/json" },
    })

    await POST(req)

    expect(buildTurnCommentaryContext).toHaveBeenCalledWith(
      { turn: 1 },
      ["|move|test"],
      "Player",
      "Opponent",
    )
  })
})
