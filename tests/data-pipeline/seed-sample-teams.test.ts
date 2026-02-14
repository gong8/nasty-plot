import { seedSampleTeams } from "@nasty-plot/data-pipeline"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@nasty-plot/db", () => ({
  prisma: {
    sampleTeam: {
      count: vi.fn(),
      deleteMany: vi.fn(),
    },
    dataSyncLog: {
      upsert: vi.fn(),
    },
  },
}))

vi.mock("@nasty-plot/teams", () => ({
  createSampleTeam: vi.fn(),
  extractPokemonIds: vi.fn(),
}))

vi.mock("@nasty-plot/smogon-data", () => ({
  upsertSyncLog: vi.fn(),
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
import { createSampleTeam, extractPokemonIds } from "@nasty-plot/teams"
import { upsertSyncLog } from "@nasty-plot/smogon-data"

const mockCount = prisma.sampleTeam.count as ReturnType<typeof vi.fn>
const mockDeleteMany = prisma.sampleTeam.deleteMany as ReturnType<typeof vi.fn>
const mockCreateSampleTeam = createSampleTeam as ReturnType<typeof vi.fn>
const mockExtractPokemonIds = extractPokemonIds as ReturnType<typeof vi.fn>
const mockUpsertSyncLog = upsertSyncLog as ReturnType<typeof vi.fn>

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("seedSampleTeams", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockExtractPokemonIds.mockReturnValue(["garchomp", "infernape"])
    mockCreateSampleTeam.mockResolvedValue({})
    mockUpsertSyncLog.mockResolvedValue(undefined)
  })

  it("skips seeding when teams already exist and force is false", async () => {
    mockCount.mockResolvedValue(5)

    const result = await seedSampleTeams(false)

    expect(result).toEqual({ seeded: 0, skipped: true })
    expect(mockCreateSampleTeam).not.toHaveBeenCalled()
  })

  it("seeds teams when none exist", async () => {
    mockCount.mockResolvedValue(0)

    const result = await seedSampleTeams(false)

    expect(result.skipped).toBe(false)
    expect(result.seeded).toBe(2)
    expect(mockCreateSampleTeam).toHaveBeenCalledTimes(2)
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
    mockExtractPokemonIds.mockReturnValue(["garchomp"])

    await seedSampleTeams(false)

    expect(mockCreateSampleTeam).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "OU Balance",
        formatId: "gen9ou",
        archetype: "balance",
        source: "curated-seed",
      }),
    )
  })

  it("joins multiple pokemonIds with commas in log output", async () => {
    mockCount.mockResolvedValue(0)
    mockExtractPokemonIds.mockReturnValue(["garchomp", "heatran", "rotomWash"])

    await seedSampleTeams(false)

    expect(mockCreateSampleTeam).toHaveBeenCalledTimes(2)
  })

  it("logs to DataSyncLog after seeding", async () => {
    mockCount.mockResolvedValue(0)

    await seedSampleTeams(false)

    expect(mockUpsertSyncLog).toHaveBeenCalledWith(
      "sample-teams",
      "all",
      expect.stringContaining("2/2"),
      "ok",
    )
  })

  it("logs partial status when some teams fail", async () => {
    mockCount.mockResolvedValue(0)
    mockCreateSampleTeam
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("DB constraint violation"))

    const result = await seedSampleTeams(false)

    expect(result.seeded).toBe(1)
    expect(mockUpsertSyncLog).toHaveBeenCalledWith(
      "sample-teams",
      "all",
      expect.stringContaining("1/2"),
      "partial",
    )
  })

  it("handles non-Error exceptions in team creation", async () => {
    mockCount.mockResolvedValue(0)
    mockCreateSampleTeam.mockResolvedValueOnce({}).mockRejectedValueOnce("string error")

    const result = await seedSampleTeams(false)

    expect(result.seeded).toBe(1)
  })

  it("does not delete when existing is 0 and force is true", async () => {
    mockCount.mockResolvedValue(0)

    await seedSampleTeams(true)

    expect(mockDeleteMany).not.toHaveBeenCalled()
  })

  it("filters out empty pokemonIds via extractPokemonIds", async () => {
    mockCount.mockResolvedValue(0)
    mockExtractPokemonIds.mockReturnValue(["garchomp", "heatran"])

    await seedSampleTeams(false)

    expect(mockExtractPokemonIds).toHaveBeenCalledTimes(2)
  })
})
