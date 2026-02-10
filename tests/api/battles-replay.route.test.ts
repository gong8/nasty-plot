import { vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@nasty-plot/db", () => ({
  prisma: {
    battle: {
      findUnique: vi.fn(),
    },
  },
}))

import { prisma } from "@nasty-plot/db"
import { GET } from "../../apps/web/src/app/api/battles/[battleId]/replay/route"

describe("GET /api/battles/[battleId]/replay", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns replay data with protocol log and turns", async () => {
    const mockBattle = {
      id: "replay-battle-id",
      formatId: "gen9ou",
      gameType: "singles",
      team1Name: "Player",
      team2Name: "Opponent",
      winnerId: "team1",
      turnCount: 10,
      protocolLog: "|start\n|move|p1a: Garchomp|Earthquake|p2a: Dragapult\n|turn|1",
      createdAt: new Date().toISOString(),
      turns: [
        {
          turnNumber: 1,
          team1Action: "move earthquake",
          team2Action: "move draco meteor",
          stateSnapshot: "{}",
        },
        { turnNumber: 2, team1Action: "move stone edge", team2Action: "switch dragapult" },
      ],
    }
    ;(prisma.battle.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockBattle)

    const req = new NextRequest("http://localhost:3000/api/battles/replay-battle-id/replay")
    const response = await GET(req, {
      params: Promise.resolve({ battleId: "replay-battle-id" }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.id).toBe("replay-battle-id")
    expect(data.protocolLog).toContain("|start")
    expect(data.turns).toHaveLength(2)
    expect(data.team1Name).toBe("Player")
    expect(data.winnerId).toBe("team1")
    expect(prisma.battle.findUnique).toHaveBeenCalledWith({
      where: { id: "replay-battle-id" },
      select: expect.objectContaining({
        id: true,
        protocolLog: true,
        turns: { orderBy: { turnNumber: "asc" } },
      }),
    })
  })

  it("returns 404 when battle not found", async () => {
    ;(prisma.battle.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const req = new NextRequest("http://localhost:3000/api/battles/nonexistent/replay")
    const response = await GET(req, {
      params: Promise.resolve({ battleId: "nonexistent" }),
    })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe("Battle not found")
  })
})
