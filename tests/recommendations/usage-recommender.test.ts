import { getUsageBasedRecommendations } from "@nasty-plot/recommendations"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@nasty-plot/db", () => ({
  prisma: {
    teammateCorr: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock("@nasty-plot/pokemon-data", () => ({
  getSpecies: vi.fn(),
  getAllSpecies: vi.fn(),
}))

import { prisma } from "@nasty-plot/db"
import { getSpecies } from "@nasty-plot/pokemon-data"

const mockCorrFindMany = prisma.teammateCorr.findMany as ReturnType<typeof vi.fn>
const mockGetSpecies = getSpecies as ReturnType<typeof vi.fn>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockSpecies(id: string) {
  return {
    id,
    name: id.charAt(0).toUpperCase() + id.slice(1),
    num: 1,
    types: ["Normal"] as [string],
    baseStats: { hp: 80, atk: 80, def: 80, spa: 80, spd: 80, spe: 80 },
    abilities: { "0": "Ability" },
    weightkg: 50,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getUsageBasedRecommendations", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // -----------------------------------------------------------------------
  // Empty inputs
  // -----------------------------------------------------------------------

  it("returns empty array when teamPokemonIds is empty", async () => {
    const result = await getUsageBasedRecommendations([], "gen9ou")
    expect(result).toEqual([])
    expect(mockCorrFindMany).not.toHaveBeenCalled()
  })

  it("returns empty array when no correlations exist", async () => {
    mockCorrFindMany.mockResolvedValue([])

    const result = await getUsageBasedRecommendations(["pikachu"], "gen9ou")
    expect(result).toEqual([])
  })

  // -----------------------------------------------------------------------
  // Prisma query
  // -----------------------------------------------------------------------

  it("queries prisma with correct filters", async () => {
    mockCorrFindMany.mockResolvedValue([])

    await getUsageBasedRecommendations(["garchomp", "heatran"], "gen9ou")

    expect(mockCorrFindMany).toHaveBeenCalledWith({
      where: {
        formatId: "gen9ou",
        pokemonAId: { in: ["garchomp", "heatran"] },
        pokemonBId: { notIn: ["garchomp", "heatran"] },
      },
      orderBy: { correlationPercent: "desc" },
    })
  })

  // -----------------------------------------------------------------------
  // Score calculation
  // -----------------------------------------------------------------------

  describe("score aggregation", () => {
    it("aggregates correlation scores across multiple team members", async () => {
      mockCorrFindMany.mockResolvedValue([
        { pokemonAId: "garchomp", pokemonBId: "heatran", correlationPercent: 30 },
        { pokemonAId: "corviknight", pokemonBId: "heatran", correlationPercent: 25 },
      ])

      mockGetSpecies.mockImplementation((id: string) => {
        if (id === "heatran") return mockSpecies("heatran")
        if (id === "garchomp") return mockSpecies("garchomp")
        if (id === "corviknight") return mockSpecies("corviknight")
        return null
      })

      const result = await getUsageBasedRecommendations(["garchomp", "corviknight"], "gen9ou")

      const heatranRec = result.find((r) => r.pokemonId === "heatran")
      expect(heatranRec).toBeDefined()
      expect(heatranRec!.score).toBe(55)
    })

    it("caps score at 100", async () => {
      mockCorrFindMany.mockResolvedValue([
        { pokemonAId: "mon1", pokemonBId: "superMon", correlationPercent: 80 },
        { pokemonAId: "mon2", pokemonBId: "superMon", correlationPercent: 90 },
      ])

      mockGetSpecies.mockImplementation((id: string) => {
        return mockSpecies(id)
      })

      const result = await getUsageBasedRecommendations(["mon1", "mon2"], "gen9ou")

      const rec = result.find((r) => r.pokemonId === "superMon")
      expect(rec).toBeDefined()
      expect(rec!.score).toBe(100)
    })

    it("calculates score as avgCorrelation * 2 rounded", async () => {
      mockCorrFindMany.mockResolvedValue([
        { pokemonAId: "garchomp", pokemonBId: "clefable", correlationPercent: 15 },
      ])

      mockGetSpecies.mockImplementation((id: string) => mockSpecies(id))

      const result = await getUsageBasedRecommendations(["garchomp"], "gen9ou")

      const rec = result.find((r) => r.pokemonId === "clefable")
      expect(rec).toBeDefined()
      expect(rec!.score).toBe(30)
    })
  })

  // -----------------------------------------------------------------------
  // Reasons
  // -----------------------------------------------------------------------

  describe("reasons", () => {
    it("includes usage reasons with partner names", async () => {
      mockCorrFindMany.mockResolvedValue([
        { pokemonAId: "garchomp", pokemonBId: "heatran", correlationPercent: 25.5 },
      ])

      mockGetSpecies.mockImplementation((id: string) => mockSpecies(id))

      const result = await getUsageBasedRecommendations(["garchomp"], "gen9ou")

      expect(result).toHaveLength(1)
      const rec = result[0]
      expect(rec.reasons).toHaveLength(1)
      expect(rec.reasons[0].type).toBe("usage")
      expect(rec.reasons[0].description).toContain("Garchomp")
      expect(rec.reasons[0].description).toContain("25.5%")
      expect(rec.reasons[0].weight).toBe(25.5)
    })

    it("limits reasons to top 3", async () => {
      mockCorrFindMany.mockResolvedValue([
        { pokemonAId: "a", pokemonBId: "target", correlationPercent: 30 },
        { pokemonAId: "b", pokemonBId: "target", correlationPercent: 25 },
        { pokemonAId: "c", pokemonBId: "target", correlationPercent: 20 },
        { pokemonAId: "d", pokemonBId: "target", correlationPercent: 15 },
        { pokemonAId: "e", pokemonBId: "target", correlationPercent: 10 },
      ])

      mockGetSpecies.mockImplementation((id: string) => mockSpecies(id))

      const result = await getUsageBasedRecommendations(["a", "b", "c", "d", "e"], "gen9ou")

      const rec = result.find((r) => r.pokemonId === "target")
      expect(rec).toBeDefined()
      expect(rec!.reasons.length).toBeLessThanOrEqual(3)
    })

    it("uses pokemonAId as fallback name when species doesn't exist", async () => {
      mockCorrFindMany.mockResolvedValue([
        { pokemonAId: "fakemon", pokemonBId: "target", correlationPercent: 20 },
      ])

      mockGetSpecies.mockImplementation((id: string) => {
        if (id === "target") return mockSpecies("target")
        return null
      })

      const result = await getUsageBasedRecommendations(["fakemon"], "gen9ou")

      if (result.length > 0) {
        expect(result[0].reasons[0].description).toContain("fakemon")
      }
    })
  })

  // -----------------------------------------------------------------------
  // Sorting and limiting
  // -----------------------------------------------------------------------

  it("returns results sorted by score descending", async () => {
    mockCorrFindMany.mockResolvedValue([
      { pokemonAId: "garchomp", pokemonBId: "heatran", correlationPercent: 30 },
      { pokemonAId: "garchomp", pokemonBId: "clefable", correlationPercent: 10 },
      { pokemonAId: "garchomp", pokemonBId: "rotom", correlationPercent: 20 },
    ])

    mockGetSpecies.mockImplementation((id: string) => mockSpecies(id))

    const result = await getUsageBasedRecommendations(["garchomp"], "gen9ou")

    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].score).toBeGreaterThanOrEqual(result[i].score)
    }
  })

  it("respects the limit parameter", async () => {
    const correlations = Array.from({ length: 20 }, (_, i) => ({
      pokemonAId: "garchomp",
      pokemonBId: `mon-${i}`,
      correlationPercent: 20 - i,
    }))

    mockCorrFindMany.mockResolvedValue(correlations)
    mockGetSpecies.mockImplementation((id: string) => mockSpecies(id))

    const result = await getUsageBasedRecommendations(["garchomp"], "gen9ou", 5)
    expect(result.length).toBeLessThanOrEqual(5)
  })

  it("uses default limit of 10", async () => {
    const correlations = Array.from({ length: 20 }, (_, i) => ({
      pokemonAId: "garchomp",
      pokemonBId: `mon-${i}`,
      correlationPercent: 20 - i * 0.5,
    }))

    mockCorrFindMany.mockResolvedValue(correlations)
    mockGetSpecies.mockImplementation((id: string) => mockSpecies(id))

    const result = await getUsageBasedRecommendations(["garchomp"], "gen9ou")
    expect(result.length).toBeLessThanOrEqual(10)
  })

  // -----------------------------------------------------------------------
  // Species validation
  // -----------------------------------------------------------------------

  it("skips recommended Pokemon that don't exist in the Dex", async () => {
    mockCorrFindMany.mockResolvedValue([
      { pokemonAId: "garchomp", pokemonBId: "fakemon", correlationPercent: 50 },
      { pokemonAId: "garchomp", pokemonBId: "heatran", correlationPercent: 30 },
    ])

    mockGetSpecies.mockImplementation((id: string) => {
      if (id === "fakemon") return null
      return mockSpecies(id)
    })

    const result = await getUsageBasedRecommendations(["garchomp"], "gen9ou")

    const ids = result.map((r) => r.pokemonId)
    expect(ids).not.toContain("fakemon")
    expect(ids).toContain("heatran")
  })

  it("skips recommended Pokemon when species is null/undefined", async () => {
    mockCorrFindMany.mockResolvedValue([
      { pokemonAId: "garchomp", pokemonBId: "nullmon", correlationPercent: 40 },
    ])

    mockGetSpecies.mockImplementation((id: string) => {
      if (id === "nullmon") return null
      return mockSpecies(id)
    })

    const result = await getUsageBasedRecommendations(["garchomp"], "gen9ou")
    expect(result).toHaveLength(0)
  })

  it("returns empty array when all correlated species are non-existent", async () => {
    mockCorrFindMany.mockResolvedValue([
      { pokemonAId: "garchomp", pokemonBId: "fake1", correlationPercent: 50 },
      { pokemonAId: "garchomp", pokemonBId: "fake2", correlationPercent: 40 },
    ])

    mockGetSpecies.mockImplementation(() => null)

    const result = await getUsageBasedRecommendations(["garchomp"], "gen9ou")
    expect(result).toEqual([])
  })

  // -----------------------------------------------------------------------
  // Return shape
  // -----------------------------------------------------------------------

  it("returns correctly shaped Recommendation objects", async () => {
    mockCorrFindMany.mockResolvedValue([
      { pokemonAId: "garchomp", pokemonBId: "heatran", correlationPercent: 25 },
    ])

    mockGetSpecies.mockImplementation((id: string) => mockSpecies(id))

    const result = await getUsageBasedRecommendations(["garchomp"], "gen9ou")

    expect(result).toHaveLength(1)
    const rec = result[0]
    expect(rec).toHaveProperty("pokemonId", "heatran")
    expect(rec).toHaveProperty("pokemonName")
    expect(rec).toHaveProperty("score")
    expect(rec).toHaveProperty("reasons")
    expect(typeof rec.pokemonName).toBe("string")
    expect(typeof rec.score).toBe("number")
    expect(rec.score).toBeGreaterThanOrEqual(0)
    expect(rec.score).toBeLessThanOrEqual(100)
    expect(Array.isArray(rec.reasons)).toBe(true)
  })
})
