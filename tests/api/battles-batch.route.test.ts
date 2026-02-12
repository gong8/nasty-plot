import { vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@nasty-plot/db", () => ({
  prisma: {
    batchSimulation: {
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock("@nasty-plot/battle-engine", () => ({
  runBatchSimulation: vi.fn().mockReturnValue(
    new Promise(() => {}), // Never resolves — fire-and-forget
  ),
}))

vi.mock("@nasty-plot/core", () => ({
  parseShowdownPaste: vi
    .fn()
    .mockReturnValue([
      { pokemonId: "garchomp", moves: ["earthquake", "dragonclaw", "swordsDance", "stealthRock"] },
    ]),
}))

import { prisma } from "@nasty-plot/db"
import { POST } from "../../apps/web/src/app/api/battles/batch/route"

describe("POST /api/battles/batch", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("creates batch simulation record and returns 201", async () => {
    const mockBatch = {
      id: "batch-123",
      formatId: "gen9ou",
      status: "running",
      totalGames: 100,
    }
    ;(prisma.batchSimulation.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockBatch)

    const req = new NextRequest("http://localhost:3000/api/battles/batch", {
      method: "POST",
      body: JSON.stringify({
        formatId: "gen9ou",
        team1Paste: "Garchomp paste",
        team2Paste: "Dragapult paste",
        totalGames: 100,
      }),
      headers: { "Content-Type": "application/json" },
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.id).toBe("batch-123")
    expect(data.status).toBe("running")
    expect(prisma.batchSimulation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          formatId: "gen9ou",
          totalGames: 100,
          status: "running",
        }),
      }),
    )
  })

  it("caps totalGames at 500", async () => {
    const mockBatch = { id: "batch-capped", status: "running" }
    ;(prisma.batchSimulation.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockBatch)

    const req = new NextRequest("http://localhost:3000/api/battles/batch", {
      method: "POST",
      body: JSON.stringify({
        formatId: "gen9ou",
        team1Paste: "paste1",
        team2Paste: "paste2",
        totalGames: 1000,
      }),
      headers: { "Content-Type": "application/json" },
    })

    await POST(req)

    expect(prisma.batchSimulation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ totalGames: 500 }),
      }),
    )
  })

  it("returns 400 when missing required fields", async () => {
    const req = new NextRequest("http://localhost:3000/api/battles/batch", {
      method: "POST",
      body: JSON.stringify({ formatId: "gen9ou" }),
      headers: { "Content-Type": "application/json" },
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe("Missing required fields")
  })

  it("returns 400 when team pastes are missing", async () => {
    const req = new NextRequest("http://localhost:3000/api/battles/batch", {
      method: "POST",
      body: JSON.stringify({
        formatId: "gen9ou",
        totalGames: 50,
      }),
      headers: { "Content-Type": "application/json" },
    })

    const response = await POST(req)
    expect(response.status).toBe(400)
  })
})
