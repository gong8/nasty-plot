import { vi } from "vitest"
import { NextRequest } from "next/server"
import { asMock } from "../test-utils"

vi.mock("@nasty-plot/db", () => ({
  prisma: {
    battle: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

import { prisma } from "@nasty-plot/db"
import { GET, DELETE } from "../../apps/web/src/app/api/battles/[battleId]/route"

describe("GET /api/battles/[battleId]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns battle with turns", async () => {
    const mockBattle = {
      id: "test-battle-id",
      formatId: "gen9ou",
      gameType: "singles",
      mode: "play",
      team1Paste: "paste1",
      team2Paste: "paste2",
      protocolLog: "|start\n|turn|1",
      turns: [
        {
          turnNumber: 1,
          team1Action: "move earthquake",
          team2Action: "move draco meteor",
          stateSnapshot: "{}",
        },
      ],
    }
    asMock(prisma.battle.findUnique).mockResolvedValue(mockBattle)

    const req = new NextRequest("http://localhost:3000/api/battles/test-battle-id")
    const response = await GET(req, {
      params: Promise.resolve({ battleId: "test-battle-id" }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.id).toBe("test-battle-id")
    expect(data.turns).toHaveLength(1)
    expect(prisma.battle.findUnique).toHaveBeenCalledWith({
      where: { id: "test-battle-id" },
      include: { turns: { orderBy: { turnNumber: "asc" } } },
    })
  })

  it("returns 404 when not found", async () => {
    asMock(prisma.battle.findUnique).mockResolvedValue(null)

    const req = new NextRequest("http://localhost:3000/api/battles/nonexistent")
    const response = await GET(req, {
      params: Promise.resolve({ battleId: "nonexistent" }),
    })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe("Battle not found")
  })
})

describe("DELETE /api/battles/[battleId]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("deletes battle and returns success", async () => {
    asMock(prisma.battle.delete).mockResolvedValue({})

    const req = new NextRequest("http://localhost:3000/api/battles/test-battle-id", {
      method: "DELETE",
    })
    const response = await DELETE(req, {
      params: Promise.resolve({ battleId: "test-battle-id" }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(prisma.battle.delete).toHaveBeenCalledWith({
      where: { id: "test-battle-id" },
    })
  })

  it("returns 404 when battle not found", async () => {
    asMock(prisma.battle.delete).mockRejectedValue(new Error("Record not found"))

    const req = new NextRequest("http://localhost:3000/api/battles/nonexistent", {
      method: "DELETE",
    })
    const response = await DELETE(req, {
      params: Promise.resolve({ battleId: "nonexistent" }),
    })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe("Battle not found")
  })
})
