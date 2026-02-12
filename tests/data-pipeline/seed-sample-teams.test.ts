import { seedSampleTeams } from "@nasty-plot/data-pipeline"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@nasty-plot/db", () => ({
  prisma: {
    sampleTeam: {
      count: vi.fn(),
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    dataSyncLog: {
      upsert: vi.fn(),
    },
  },
}))

vi.mock("@nasty-plot/core", () => ({
  parseShowdownPaste: vi.fn(),
}))

vi.mock("#data-pipeline/data/sample-teams", () => ({
  SAMPLE_TEAMS: [
    {
      name: "OU Balance",
      formatId: "gen9ou",
      archetype: "balance",
      source: "curated-seed",
      paste:
        "Garchomp @ Leftovers\nAbility: Rough Skin\nEVs: 252 Atk / 4 SpD / 252 Spe\nJolly Nature\n- Earthquake\n- Dragon Claw\n- Swords Dance\n- Scale Shot",
    },
    {
      name: "UU Offense",
      formatId: "gen9uu",
      archetype: "offense",
      source: "curated-seed",
      paste:
        "Infernape @ Life Orb\nAbility: Blaze\nEVs: 252 SpA / 4 SpD / 252 Spe\nTimid Nature\n- Fire Blast\n- Close Combat\n- Grass Knot\n- U-turn",
    },
  ],
}))

import { prisma } from "@nasty-plot/db"
import { parseShowdownPaste } from "@nasty-plot/core"

const mockCount = prisma.sampleTeam.count as ReturnType<typeof vi.fn>
const mockDeleteMany = prisma.sampleTeam.deleteMany as ReturnType<typeof vi.fn>
const mockCreate = prisma.sampleTeam.create as ReturnType<typeof vi.fn>
const mockUpsert = prisma.dataSyncLog.upsert as ReturnType<typeof vi.fn>
const mockParse = parseShowdownPaste as ReturnType<typeof vi.fn>

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("seedSampleTeams", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockParse.mockReturnValue([{ pokemonId: "garchomp" }, { pokemonId: "infernape" }])
    mockCreate.mockResolvedValue({})
    mockUpsert.mockResolvedValue({})
  })

  it("skips seeding when teams already exist and force is false", async () => {
    mockCount.mockResolvedValue(5)

    const result = await seedSampleTeams(false)

    expect(result).toEqual({ seeded: 0, skipped: true })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it("seeds teams when none exist", async () => {
    mockCount.mockResolvedValue(0)

    const result = await seedSampleTeams(false)

    expect(result.skipped).toBe(false)
    expect(result.seeded).toBe(2)
    expect(mockCreate).toHaveBeenCalledTimes(2)
  })

  it("deletes existing teams and re-seeds when force is true", async () => {
    mockCount.mockResolvedValue(3)
    mockDeleteMany.mockResolvedValue({ count: 3 })

    const result = await seedSampleTeams(true)

    expect(mockDeleteMany).toHaveBeenCalledWith({ where: { source: "curated-seed" } })
    expect(result.skipped).toBe(false)
    expect(result.seeded).toBe(2)
  })

  it("creates sample teams with correct data", async () => {
    mockCount.mockResolvedValue(0)
    mockParse.mockReturnValue([{ pokemonId: "garchomp" }])

    await seedSampleTeams(false)

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "OU Balance",
        formatId: "gen9ou",
        archetype: "balance",
        source: "curated-seed",
        isActive: true,
        pokemonIds: "garchomp",
      }),
    })
  })

  it("joins multiple pokemonIds with commas", async () => {
    mockCount.mockResolvedValue(0)
    mockParse.mockReturnValue([
      { pokemonId: "garchomp" },
      { pokemonId: "heatran" },
      { pokemonId: "rotomWash" },
    ])

    await seedSampleTeams(false)

    const firstCall = mockCreate.mock.calls[0][0]
    expect(firstCall.data.pokemonIds).toBe("garchomp,heatran,rotomWash")
  })

  it("logs to DataSyncLog after seeding", async () => {
    mockCount.mockResolvedValue(0)

    await seedSampleTeams(false)

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { source_formatId: { source: "sample-teams", formatId: "all" } },
        update: expect.objectContaining({
          status: "ok",
          message: expect.stringContaining("2/2"),
        }),
        create: expect.objectContaining({
          source: "sample-teams",
          formatId: "all",
          status: "ok",
        }),
      }),
    )
  })

  it("logs partial status when some teams fail", async () => {
    mockCount.mockResolvedValue(0)
    mockCreate.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error("DB constraint violation"))

    const result = await seedSampleTeams(false)

    expect(result.seeded).toBe(1)
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          status: "partial",
          message: expect.stringContaining("1/2"),
        }),
      }),
    )
  })

  it("handles non-Error exceptions in team creation", async () => {
    mockCount.mockResolvedValue(0)
    mockCreate.mockResolvedValueOnce({}).mockRejectedValueOnce("string error")

    const result = await seedSampleTeams(false)

    expect(result.seeded).toBe(1)
  })

  it("does not delete when existing is 0 and force is true", async () => {
    mockCount.mockResolvedValue(0)

    await seedSampleTeams(true)

    expect(mockDeleteMany).not.toHaveBeenCalled()
  })

  it("filters out empty pokemonIds", async () => {
    mockCount.mockResolvedValue(0)
    mockParse.mockReturnValue([
      { pokemonId: "garchomp" },
      { pokemonId: "" },
      { pokemonId: "heatran" },
    ])

    await seedSampleTeams(false)

    const firstCall = mockCreate.mock.calls[0][0]
    expect(firstCall.data.pokemonIds).toBe("garchomp,heatran")
  })
})
