import { prisma } from "@nasty-plot/db"

describe("prisma client", () => {
  it("exports a prisma object", () => {
    expect(prisma).toBeDefined()
    expect(typeof prisma).toBe("object")
  })

  it("has expected model accessors", () => {
    expect(prisma.team).toBeDefined()
    expect(prisma.teamSlot).toBeDefined()
    expect(prisma.format).toBeDefined()
    expect(prisma.usageStats).toBeDefined()
    expect(prisma.smogonSet).toBeDefined()
    expect(prisma.teammateCorr).toBeDefined()
    expect(prisma.checkCounter).toBeDefined()
    expect(prisma.dataSyncLog).toBeDefined()
    expect(prisma.chatSession).toBeDefined()
    expect(prisma.chatMessage).toBeDefined()
    expect(prisma.battle).toBeDefined()
    expect(prisma.battleTurn).toBeDefined()
    expect(prisma.batchSimulation).toBeDefined()
    expect(prisma.sampleTeam).toBeDefined()
  })

  it("model accessors are objects with CRUD methods", () => {
    const expectedMethods = ["findMany", "findFirst", "create", "update", "delete"]
    for (const method of expectedMethods) {
      expect(typeof (prisma.team as Record<string, unknown>)[method]).toBe("function")
    }
  })

  it("reuses the same client instance (singleton)", async () => {
    const { prisma: prisma2 } = await import("@nasty-plot/db")
    expect(prisma2).toBe(prisma)
  })
})
