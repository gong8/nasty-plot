import { vi } from "vitest"
import { NextRequest } from "next/server"

const { mockListBattles, mockCreateBattle } = vi.hoisted(() => ({
  mockListBattles: vi.fn(),
  mockCreateBattle: vi.fn(),
}))

vi.mock("@nasty-plot/battle-engine/db", () => ({
  listBattles: mockListBattles,
  createBattle: mockCreateBattle,
}))

import { GET, POST } from "../../apps/web/src/app/api/battles/route"

describe("GET /api/battles", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns battles list with pagination", async () => {
    const mockBattles = [
      {
        id: "b1",
        formatId: "gen9ou",
        gameType: "singles",
        mode: "play",
        aiDifficulty: "heuristic",
        team1Name: "Player",
        team2Name: "Opponent",
        winnerId: "team1",
        turnCount: 15,
        createdAt: new Date().toISOString(),
      },
    ]
    mockListBattles.mockResolvedValue({ battles: mockBattles, total: 1, page: 1, limit: 10 })

    const req = new NextRequest("http://localhost:3000/api/battles?page=1&limit=10")
    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.battles).toEqual(mockBattles)
    expect(data.total).toBe(1)
    expect(data.page).toBe(1)
    expect(data.limit).toBe(10)
    expect(mockListBattles).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 10 }))
  })

  it("handles empty results", async () => {
    mockListBattles.mockResolvedValue({ battles: [], total: 0, page: 1, limit: 20 })

    const req = new NextRequest("http://localhost:3000/api/battles")
    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.battles).toEqual([])
    expect(data.total).toBe(0)
  })

  it("applies default pagination when no params", async () => {
    mockListBattles.mockResolvedValue({ battles: [], total: 0, page: 1, limit: 20 })

    const req = new NextRequest("http://localhost:3000/api/battles")
    const response = await GET(req)
    const data = await response.json()

    expect(data.page).toBe(1)
    expect(data.limit).toBe(20)
    expect(mockListBattles).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 20 }))
  })
})

describe("POST /api/battles", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("creates battle with valid data", async () => {
    const mockBattle = {
      id: "new-battle-id",
      formatId: "gen9ou",
      gameType: "singles",
      mode: "play",
      team1Paste: "Garchomp @ Choice Scarf\nAbility: Rough Skin",
      team2Paste: "Dragapult @ Choice Specs\nAbility: Infiltrator",
      protocolLog: "|start\n|turn|1",
    }
    mockCreateBattle.mockResolvedValue(mockBattle)

    const req = new NextRequest("http://localhost:3000/api/battles", {
      method: "POST",
      body: JSON.stringify({
        formatId: "gen9ou",
        team1Paste: "Garchomp @ Choice Scarf\nAbility: Rough Skin",
        team2Paste: "Dragapult @ Choice Specs\nAbility: Infiltrator",
        protocolLog: "|start\n|turn|1",
      }),
      headers: { "Content-Type": "application/json" },
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.id).toBe("new-battle-id")
    expect(mockCreateBattle).toHaveBeenCalledWith(
      expect.objectContaining({
        formatId: "gen9ou",
        team1Paste: "Garchomp @ Choice Scarf\nAbility: Rough Skin",
        team2Paste: "Dragapult @ Choice Specs\nAbility: Infiltrator",
        protocolLog: "|start\n|turn|1",
      }),
    )
  })

  it("returns 400 when required fields missing", async () => {
    const req = new NextRequest("http://localhost:3000/api/battles", {
      method: "POST",
      body: JSON.stringify({ formatId: "gen9ou" }),
      headers: { "Content-Type": "application/json" },
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe("Validation failed")
    expect(data.details).toBeDefined()
  })

  it("returns 400 when protocolLog is missing", async () => {
    const req = new NextRequest("http://localhost:3000/api/battles", {
      method: "POST",
      body: JSON.stringify({
        formatId: "gen9ou",
        team1Paste: "some paste",
        team2Paste: "some paste",
      }),
      headers: { "Content-Type": "application/json" },
    })

    const response = await POST(req)
    expect(response.status).toBe(400)
  })

  it("creates battle with turns data", async () => {
    const mockBattle = { id: "battle-with-turns" }
    mockCreateBattle.mockResolvedValue(mockBattle)

    const turns = [
      {
        turnNumber: 1,
        team1Action: "move earthquake",
        team2Action: "move draco meteor",
        stateSnapshot: "{}",
        winProbTeam1: 0.55,
      },
    ]

    const req = new NextRequest("http://localhost:3000/api/battles", {
      method: "POST",
      body: JSON.stringify({
        formatId: "gen9ou",
        team1Paste: "paste1",
        team2Paste: "paste2",
        protocolLog: "|turn|1",
        turns,
      }),
      headers: { "Content-Type": "application/json" },
    })

    const response = await POST(req)
    expect(response.status).toBe(201)
    expect(mockCreateBattle).toHaveBeenCalledWith(
      expect.objectContaining({
        formatId: "gen9ou",
        team1Paste: "paste1",
        team2Paste: "paste2",
        protocolLog: "|turn|1",
        turns: expect.arrayContaining([
          expect.objectContaining({ turnNumber: 1, winProbTeam1: 0.55 }),
        ]),
      }),
    )
  })
})
