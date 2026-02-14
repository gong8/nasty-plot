import { getRecommendations } from "@nasty-plot/recommendations"
import type { PokemonType } from "@nasty-plot/core"
import { DEFAULT_LEVEL, DEFAULT_EVS, DEFAULT_IVS, MAX_SINGLE_EV } from "@nasty-plot/core"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@nasty-plot/teams", () => ({
  getTeam: vi.fn(),
}))

vi.mock("@nasty-plot/pokemon-data", () => ({
  getSpecies: vi.fn(),
  listSpecies: vi.fn(),
}))

vi.mock("#recommendations/usage-recommender", () => ({
  getUsageBasedRecommendations: vi.fn(),
}))

vi.mock("#recommendations/coverage-recommender", () => ({
  getCoverageBasedRecommendations: vi.fn(),
}))

import { getTeam } from "@nasty-plot/teams"
import { getSpecies } from "@nasty-plot/pokemon-data"
import { getUsageBasedRecommendations } from "#recommendations/usage-recommender"
import { getCoverageBasedRecommendations } from "#recommendations/coverage-recommender"

const mockGetTeam = getTeam as ReturnType<typeof vi.fn>
const mockGetSpecies = getSpecies as ReturnType<typeof vi.fn>
const mockUsageRecs = getUsageBasedRecommendations as ReturnType<typeof vi.fn>
const mockCoverageRecs = getCoverageBasedRecommendations as ReturnType<typeof vi.fn>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSpecies(id: string, name: string, types: PokemonType[]) {
  return {
    id,
    name,
    num: 1,
    types,
    baseStats: { hp: 80, atk: 80, def: 80, spa: 80, spd: 80, spe: 80 },
    abilities: { "0": "Ability" },
    weightkg: 50,
  }
}

function makeSlot(position: number, pokemonId: string, species?: ReturnType<typeof makeSpecies>) {
  return {
    position,
    pokemonId,
    species,
    ability: "Ability",
    item: "Leftovers",
    nature: "Hardy",
    teraType: undefined,
    level: DEFAULT_LEVEL,
    moves: ["tackle", undefined, undefined, undefined],
    evs: { ...DEFAULT_EVS },
    ivs: { ...DEFAULT_IVS },
  }
}

function makeTeamData(slots: ReturnType<typeof makeSlot>[]) {
  return {
    id: "team-1",
    name: "Test Team",
    formatId: "gen9ou",
    mode: "freeform",
    source: "manual",
    isArchived: false,
    slots,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getRecommendations", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("throws when team is not found", async () => {
    mockGetTeam.mockResolvedValue(null)

    await expect(getRecommendations("nonexistent")).rejects.toThrow("Team not found: nonexistent")
  })

  it("loads team via getTeam", async () => {
    mockGetTeam.mockResolvedValue(makeTeamData([makeSlot(1, "pikachu")]))
    mockGetSpecies.mockReturnValue(makeSpecies("pikachu", "Pikachu", ["Electric"]))
    mockUsageRecs.mockResolvedValue([])
    mockCoverageRecs.mockResolvedValue([])

    await getRecommendations("team-1")

    expect(mockGetTeam).toHaveBeenCalledWith("team-1")
  })

  it("calls both usage and coverage recommenders", async () => {
    mockGetTeam.mockResolvedValue(makeTeamData([makeSlot(1, "garchomp")]))
    mockGetSpecies.mockReturnValue(makeSpecies("garchomp", "Garchomp", ["Dragon", "Ground"]))
    mockUsageRecs.mockResolvedValue([])
    mockCoverageRecs.mockResolvedValue([])

    await getRecommendations("team-1")

    expect(mockUsageRecs).toHaveBeenCalledTimes(1)
    expect(mockCoverageRecs).toHaveBeenCalledTimes(1)
  })

  it("passes teamPokemonIds to usage recommender", async () => {
    mockGetTeam.mockResolvedValue(makeTeamData([makeSlot(1, "garchomp"), makeSlot(2, "heatran")]))
    mockGetSpecies.mockImplementation((id: string) => {
      if (id === "garchomp") return makeSpecies("garchomp", "Garchomp", ["Dragon", "Ground"])
      if (id === "heatran") return makeSpecies("heatran", "Heatran", ["Fire", "Steel"])
      return null
    })
    mockUsageRecs.mockResolvedValue([])
    mockCoverageRecs.mockResolvedValue([])

    await getRecommendations("team-1")

    expect(mockUsageRecs).toHaveBeenCalledWith(["garchomp", "heatran"], "gen9ou", 20)
  })

  it("passes converted slots to coverage recommender", async () => {
    mockGetTeam.mockResolvedValue(makeTeamData([makeSlot(1, "pikachu")]))
    mockGetSpecies.mockReturnValue(makeSpecies("pikachu", "Pikachu", ["Electric"]))
    mockUsageRecs.mockResolvedValue([])
    mockCoverageRecs.mockResolvedValue([])

    await getRecommendations("team-1")

    const coverageArgs = mockCoverageRecs.mock.calls[0]
    expect(coverageArgs[0]).toHaveLength(1)
    expect(coverageArgs[0][0].pokemonId).toBe("pikachu")
    expect(coverageArgs[1]).toBe("gen9ou")
    expect(coverageArgs[2]).toBe(20)
  })

  describe("score merging", () => {
    it("applies default weights (0.6 usage, 0.4 coverage)", async () => {
      mockGetTeam.mockResolvedValue(makeTeamData([makeSlot(1, "pikachu")]))
      mockGetSpecies.mockReturnValue(makeSpecies("pikachu", "Pikachu", ["Electric"]))

      mockUsageRecs.mockResolvedValue([
        {
          pokemonId: "heatran",
          pokemonName: "Heatran",
          score: 80,
          reasons: [{ type: "usage", description: "Used with Pikachu", weight: 40 }],
        },
      ])
      mockCoverageRecs.mockResolvedValue([
        {
          pokemonId: "heatran",
          pokemonName: "Heatran",
          score: 60,
          reasons: [{ type: "coverage", description: "Covers gaps", weight: 30 }],
        },
      ])

      const result = await getRecommendations("team-1")

      const rec = result.find((r) => r.pokemonId === "heatran")
      expect(rec).toBeDefined()
      expect(rec!.score).toBe(72)
    })

    it("applies custom weights when provided", async () => {
      mockGetTeam.mockResolvedValue(makeTeamData([makeSlot(1, "pikachu")]))
      mockGetSpecies.mockReturnValue(makeSpecies("pikachu", "Pikachu", ["Electric"]))

      mockUsageRecs.mockResolvedValue([
        { pokemonId: "heatran", pokemonName: "Heatran", score: 80, reasons: [] },
      ])
      mockCoverageRecs.mockResolvedValue([
        { pokemonId: "heatran", pokemonName: "Heatran", score: 60, reasons: [] },
      ])

      const result = await getRecommendations("team-1", 10, {
        usage: 0.3,
        coverage: 0.7,
      })

      const rec = result.find((r) => r.pokemonId === "heatran")
      expect(rec).toBeDefined()
      expect(rec!.score).toBe(66)
    })

    it("handles Pokemon appearing only in usage recs", async () => {
      mockGetTeam.mockResolvedValue(makeTeamData([makeSlot(1, "pikachu")]))
      mockGetSpecies.mockReturnValue(makeSpecies("pikachu", "Pikachu", ["Electric"]))

      mockUsageRecs.mockResolvedValue([
        {
          pokemonId: "clefable",
          pokemonName: "Clefable",
          score: 50,
          reasons: [{ type: "usage", description: "Used with Pikachu", weight: 25 }],
        },
      ])
      mockCoverageRecs.mockResolvedValue([])

      const result = await getRecommendations("team-1")

      const rec = result.find((r) => r.pokemonId === "clefable")
      expect(rec).toBeDefined()
      expect(rec!.score).toBe(30)
    })

    it("handles Pokemon appearing only in coverage recs", async () => {
      mockGetTeam.mockResolvedValue(makeTeamData([makeSlot(1, "pikachu")]))
      mockGetSpecies.mockReturnValue(makeSpecies("pikachu", "Pikachu", ["Electric"]))

      mockUsageRecs.mockResolvedValue([])
      mockCoverageRecs.mockResolvedValue([
        {
          pokemonId: "garchomp",
          pokemonName: "Garchomp",
          score: 90,
          reasons: [{ type: "coverage", description: "Covers gaps", weight: 45 }],
        },
      ])

      const result = await getRecommendations("team-1")

      const rec = result.find((r) => r.pokemonId === "garchomp")
      expect(rec).toBeDefined()
      expect(rec!.score).toBe(36)
    })

    it("merges reasons from both recommenders", async () => {
      mockGetTeam.mockResolvedValue(makeTeamData([makeSlot(1, "pikachu")]))
      mockGetSpecies.mockReturnValue(makeSpecies("pikachu", "Pikachu", ["Electric"]))

      mockUsageRecs.mockResolvedValue([
        {
          pokemonId: "heatran",
          pokemonName: "Heatran",
          score: 80,
          reasons: [{ type: "usage", description: "Usage reason", weight: 40 }],
        },
      ])
      mockCoverageRecs.mockResolvedValue([
        {
          pokemonId: "heatran",
          pokemonName: "Heatran",
          score: 60,
          reasons: [{ type: "coverage", description: "Coverage reason", weight: 30 }],
        },
      ])

      const result = await getRecommendations("team-1")

      const rec = result.find((r) => r.pokemonId === "heatran")
      expect(rec).toBeDefined()
      expect(rec!.reasons).toHaveLength(2)

      const reasonTypes = rec!.reasons.map((r) => r.type)
      expect(reasonTypes).toContain("usage")
      expect(reasonTypes).toContain("coverage")
    })

    it("caps composite score at 100", async () => {
      mockGetTeam.mockResolvedValue(makeTeamData([makeSlot(1, "pikachu")]))
      mockGetSpecies.mockReturnValue(makeSpecies("pikachu", "Pikachu", ["Electric"]))

      mockUsageRecs.mockResolvedValue([
        { pokemonId: "superMon", pokemonName: "SuperMon", score: 100, reasons: [] },
      ])
      mockCoverageRecs.mockResolvedValue([
        { pokemonId: "superMon", pokemonName: "SuperMon", score: 100, reasons: [] },
      ])

      const result = await getRecommendations("team-1")

      const rec = result.find((r) => r.pokemonId === "superMon")
      expect(rec).toBeDefined()
      expect(rec!.score).toBeLessThanOrEqual(100)
    })
  })

  it("returns results sorted by composite score descending", async () => {
    mockGetTeam.mockResolvedValue(makeTeamData([makeSlot(1, "pikachu")]))
    mockGetSpecies.mockReturnValue(makeSpecies("pikachu", "Pikachu", ["Electric"]))

    mockUsageRecs.mockResolvedValue([
      { pokemonId: "a", pokemonName: "A", score: 90, reasons: [] },
      { pokemonId: "b", pokemonName: "B", score: 50, reasons: [] },
      { pokemonId: "c", pokemonName: "C", score: 70, reasons: [] },
    ])
    mockCoverageRecs.mockResolvedValue([
      { pokemonId: "a", pokemonName: "A", score: 30, reasons: [] },
      { pokemonId: "b", pokemonName: "B", score: 80, reasons: [] },
      { pokemonId: "c", pokemonName: "C", score: 50, reasons: [] },
    ])

    const result = await getRecommendations("team-1")

    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].score).toBeGreaterThanOrEqual(result[i].score)
    }
  })

  it("respects the limit parameter", async () => {
    mockGetTeam.mockResolvedValue(makeTeamData([makeSlot(1, "pikachu")]))
    mockGetSpecies.mockReturnValue(makeSpecies("pikachu", "Pikachu", ["Electric"]))

    const usageRecs = Array.from({ length: 15 }, (_, i) => ({
      pokemonId: `mon-${i}`,
      pokemonName: `Mon${i}`,
      score: 50 + i,
      reasons: [],
    }))

    mockUsageRecs.mockResolvedValue(usageRecs)
    mockCoverageRecs.mockResolvedValue([])

    const result = await getRecommendations("team-1", 5)
    expect(result.length).toBeLessThanOrEqual(5)
  })

  it("defaults to limit of 10", async () => {
    mockGetTeam.mockResolvedValue(makeTeamData([makeSlot(1, "pikachu")]))
    mockGetSpecies.mockReturnValue(makeSpecies("pikachu", "Pikachu", ["Electric"]))

    const usageRecs = Array.from({ length: 20 }, (_, i) => ({
      pokemonId: `mon-${i}`,
      pokemonName: `Mon${i}`,
      score: 90 - i,
      reasons: [],
    }))

    mockUsageRecs.mockResolvedValue(usageRecs)
    mockCoverageRecs.mockResolvedValue([])

    const result = await getRecommendations("team-1")
    expect(result.length).toBeLessThanOrEqual(10)
  })

  it("returns empty array when both sub-recommenders return nothing", async () => {
    mockGetTeam.mockResolvedValue(makeTeamData([makeSlot(1, "pikachu")]))
    mockGetSpecies.mockReturnValue(makeSpecies("pikachu", "Pikachu", ["Electric"]))

    mockUsageRecs.mockResolvedValue([])
    mockCoverageRecs.mockResolvedValue([])

    const result = await getRecommendations("team-1")
    expect(result).toEqual([])
  })

  it("passes slot with undefined species through to recommenders", async () => {
    const slot = makeSlot(1, "nonexistent")
    mockGetTeam.mockResolvedValue(makeTeamData([slot]))
    mockUsageRecs.mockResolvedValue([])
    mockCoverageRecs.mockResolvedValue([])

    await getRecommendations("team-1")

    const coverageCall = mockCoverageRecs.mock.calls[0]
    const mappedSlots = coverageCall[0]
    expect(mappedSlots).toHaveLength(1)
    expect(mappedSlots[0].pokemonId).toBe("nonexistent")
    expect(mappedSlots[0].species).toBeUndefined()
  })

  it("passes domain slots with species to recommenders", async () => {
    const species = makeSpecies("garchomp", "Garchomp", ["Dragon", "Ground"])
    const slot = {
      ...makeSlot(1, "garchomp", species),
      ability: "Rough Skin",
      item: "Choice Scarf",
      nature: "Jolly",
      teraType: "Fire",
      evs: { hp: 4, atk: MAX_SINGLE_EV, def: 0, spa: 0, spd: 0, spe: MAX_SINGLE_EV },
    }

    mockGetTeam.mockResolvedValue(makeTeamData([slot]))
    mockUsageRecs.mockResolvedValue([])
    mockCoverageRecs.mockResolvedValue([])

    await getRecommendations("team-1")

    const coverageCall = mockCoverageRecs.mock.calls[0]
    const mappedSlots = coverageCall[0]
    expect(mappedSlots).toHaveLength(1)
    expect(mappedSlots[0].pokemonId).toBe("garchomp")
    expect(mappedSlots[0].species?.types).toEqual(["Dragon", "Ground"])
    expect(mappedSlots[0].ability).toBe("Rough Skin")
    expect(mappedSlots[0].item).toBe("Choice Scarf")
    expect(mappedSlots[0].nature).toBe("Jolly")
    expect(mappedSlots[0].teraType).toBe("Fire")
    expect(mappedSlots[0].evs.atk).toBe(MAX_SINGLE_EV)
    expect(mappedSlots[0].evs.spe).toBe(MAX_SINGLE_EV)
  })

  it("returns correctly shaped Recommendation objects", async () => {
    mockGetTeam.mockResolvedValue(makeTeamData([makeSlot(1, "pikachu")]))
    mockGetSpecies.mockReturnValue(makeSpecies("pikachu", "Pikachu", ["Electric"]))

    mockUsageRecs.mockResolvedValue([
      {
        pokemonId: "heatran",
        pokemonName: "Heatran",
        score: 60,
        reasons: [{ type: "usage", description: "Common teammate", weight: 30 }],
      },
    ])
    mockCoverageRecs.mockResolvedValue([])

    const result = await getRecommendations("team-1")

    expect(result.length).toBeGreaterThan(0)
    const rec = result[0]
    expect(rec).toHaveProperty("pokemonId")
    expect(rec).toHaveProperty("pokemonName")
    expect(rec).toHaveProperty("score")
    expect(rec).toHaveProperty("reasons")
    expect(typeof rec.pokemonId).toBe("string")
    expect(typeof rec.pokemonName).toBe("string")
    expect(typeof rec.score).toBe("number")
    expect(Array.isArray(rec.reasons)).toBe(true)
  })
})
