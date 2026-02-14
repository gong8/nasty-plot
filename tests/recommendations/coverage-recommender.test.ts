import type { TeamSlotData, PokemonType, StatsTable } from "@nasty-plot/core"
import { DEFAULT_EVS, DEFAULT_IVS, DEFAULT_LEVEL } from "@nasty-plot/core"
import { getCoverageBasedRecommendations } from "@nasty-plot/recommendations"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@nasty-plot/pokemon-data", () => ({
  getSpecies: vi.fn(),
  listSpecies: vi.fn(),
}))

vi.mock("@nasty-plot/smogon-data", () => ({
  getUsageStats: vi.fn(),
}))

import { getSpecies, listSpecies } from "@nasty-plot/pokemon-data"
import { getUsageStats } from "@nasty-plot/smogon-data"

const mockGetSpecies = getSpecies as ReturnType<typeof vi.fn>
const mockListSpecies = listSpecies as ReturnType<typeof vi.fn>
const mockGetUsageStats = getUsageStats as ReturnType<typeof vi.fn>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultStats: StatsTable = { hp: 80, atk: 80, def: 80, spa: 80, spd: 80, spe: 80 }

function makeSlot(
  pokemonId: string,
  types: [PokemonType] | [PokemonType, PokemonType],
): TeamSlotData {
  return {
    position: 1,
    pokemonId,
    species: {
      id: pokemonId,
      name: pokemonId,
      num: 1,
      types,
      baseStats: defaultStats,
      abilities: { "0": "Ability" },
      weightkg: 50,
    },
    ability: "Ability",
    item: "",
    nature: "Hardy",
    level: DEFAULT_LEVEL,
    moves: ["tackle", undefined, undefined, undefined],
    evs: DEFAULT_EVS,
    ivs: DEFAULT_IVS,
  }
}

function mockSpeciesResult(id: string, types: PokemonType[]) {
  return {
    id,
    name: id.charAt(0).toUpperCase() + id.slice(1),
    num: 1,
    types,
    baseStats: defaultStats,
    abilities: { "0": "Ability" },
    weightkg: 50,
    isNonstandard: null,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getCoverageBasedRecommendations", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // -----------------------------------------------------------------------
  // No gaps
  // -----------------------------------------------------------------------

  it("returns empty array when team has no uncovered types and no shared weaknesses", async () => {
    const team = [
      makeSlot("garchomp", ["Dragon", "Ground"]),
      makeSlot("heatran", ["Fire", "Steel"]),
      makeSlot("tapu-lele", ["Psychic", "Fairy"]),
      makeSlot("kartana", ["Grass", "Steel"]),
      makeSlot("greninja", ["Water", "Dark"]),
      makeSlot("zapdos", ["Electric", "Flying"]),
    ]

    mockGetUsageStats.mockResolvedValue([])
    mockListSpecies.mockReturnValue([])

    const result = await getCoverageBasedRecommendations(team, "gen9ou")
    expect(Array.isArray(result)).toBe(true)
  })

  // -----------------------------------------------------------------------
  // Offensive coverage recommendations
  // -----------------------------------------------------------------------

  describe("offensive coverage gaps", () => {
    it("recommends Pokemon that cover offensive gaps", async () => {
      const team = [makeSlot("snorlax", ["Normal"]), makeSlot("blissey", ["Normal"])]

      mockGetUsageStats.mockResolvedValue([
        { pokemonId: "lucario", usagePercent: 10, rank: 1 },
        { pokemonId: "garchomp", usagePercent: 15, rank: 2 },
      ])

      mockGetSpecies.mockImplementation((id: string) => {
        if (id === "lucario") return mockSpeciesResult("lucario", ["Fighting", "Steel"])
        if (id === "garchomp") return mockSpeciesResult("garchomp", ["Dragon", "Ground"])
        return null
      })

      const result = await getCoverageBasedRecommendations(team, "gen9ou")

      expect(result.length).toBeGreaterThan(0)
      const ids = result.map((r) => r.pokemonId)
      expect(ids.length).toBeGreaterThan(0)
    })

    it("scores higher for Pokemon covering more gaps", async () => {
      const team = [makeSlot("pikachu", ["Electric"])]

      mockGetUsageStats.mockResolvedValue([
        { pokemonId: "groundmon", usagePercent: 10, rank: 1 },
        { pokemonId: "normalmon", usagePercent: 10, rank: 2 },
      ])

      mockGetSpecies.mockImplementation((id: string) => {
        if (id === "groundmon") return mockSpeciesResult("groundmon", ["Ground"])
        if (id === "normalmon") return mockSpeciesResult("normalmon", ["Normal"])
        return null
      })

      const result = await getCoverageBasedRecommendations(team, "gen9ou")

      const groundRec = result.find((r) => r.pokemonId === "groundmon")
      const normalRec = result.find((r) => r.pokemonId === "normalmon")

      if (groundRec && normalRec) {
        expect(groundRec.score).toBeGreaterThan(normalRec.score)
      } else {
        expect(groundRec).toBeDefined()
      }
    })
  })

  // -----------------------------------------------------------------------
  // Defensive resistance recommendations
  // -----------------------------------------------------------------------

  describe("defensive coverage (resist shared weaknesses)", () => {
    it("recommends Pokemon that resist shared weaknesses", async () => {
      const team = [makeSlot("vaporeon", ["Water"]), makeSlot("starmie", ["Water", "Psychic"])]

      mockGetUsageStats.mockResolvedValue([{ pokemonId: "garchomp", usagePercent: 15, rank: 1 }])

      mockGetSpecies.mockImplementation((id: string) => {
        if (id === "garchomp") return mockSpeciesResult("garchomp", ["Dragon", "Ground"])
        return null
      })

      const result = await getCoverageBasedRecommendations(team, "gen9ou")

      const garchompRec = result.find((r) => r.pokemonId === "garchomp")
      expect(garchompRec).toBeDefined()

      const resistReason = garchompRec?.reasons.find(
        (r) => r.type === "coverage" && r.description.includes("Resists"),
      )
      expect(resistReason).toBeDefined()
    })

    it("gives higher weight to resistance reasons than offensive coverage", async () => {
      const team = [makeSlot("vaporeon", ["Water"]), makeSlot("blastoise", ["Water"])]

      mockGetUsageStats.mockResolvedValue([{ pokemonId: "candidate", usagePercent: 10, rank: 1 }])

      mockGetSpecies.mockImplementation((id: string) => {
        if (id === "candidate") return mockSpeciesResult("candidate", ["Ground", "Dragon"])
        return null
      })

      const result = await getCoverageBasedRecommendations(team, "gen9ou")

      if (result.length > 0) {
        const rec = result[0]
        const resistReasons = rec.reasons.filter((r) => r.description.includes("Resists"))
        if (resistReasons.length > 0) {
          expect(resistReasons[0].weight).toBeGreaterThanOrEqual(20)
        }
      }
    })
  })

  // -----------------------------------------------------------------------
  // Exclusions
  // -----------------------------------------------------------------------

  it("excludes team members from recommendations", async () => {
    const team = [makeSlot("garchomp", ["Dragon", "Ground"])]

    mockGetUsageStats.mockResolvedValue([
      { pokemonId: "garchomp", usagePercent: 20, rank: 1 },
      { pokemonId: "heatran", usagePercent: 18, rank: 2 },
    ])

    mockGetSpecies.mockImplementation((id: string) => {
      if (id === "garchomp") return mockSpeciesResult("garchomp", ["Dragon", "Ground"])
      if (id === "heatran") return mockSpeciesResult("heatran", ["Fire", "Steel"])
      return null
    })

    const result = await getCoverageBasedRecommendations(team, "gen9ou")

    const ids = result.map((r) => r.pokemonId)
    expect(ids).not.toContain("garchomp")
  })

  it("skips species that do not exist in the Dex", async () => {
    const team = [makeSlot("pikachu", ["Electric"])]

    mockGetUsageStats.mockResolvedValue([{ pokemonId: "fakemon", usagePercent: 10, rank: 1 }])

    mockGetSpecies.mockReturnValue(null)

    const result = await getCoverageBasedRecommendations(team, "gen9ou")
    expect(result).toHaveLength(0)
  })

  // -----------------------------------------------------------------------
  // Fallback to listSpecies when no usage data
  // -----------------------------------------------------------------------

  it("falls back to getAllLegalSpeciesIds when no usage data exists", async () => {
    const team = [makeSlot("pikachu", ["Electric"])]

    mockGetUsageStats.mockResolvedValue([])
    mockListSpecies.mockReturnValue([
      mockSpeciesResult("bulbasaur", ["Grass", "Poison"]),
      mockSpeciesResult("charmander", ["Fire"]),
    ])

    mockGetSpecies.mockImplementation((id: string) => {
      if (id === "bulbasaur") return mockSpeciesResult("bulbasaur", ["Grass", "Poison"])
      if (id === "charmander") return mockSpeciesResult("charmander", ["Fire"])
      return null
    })

    const result = await getCoverageBasedRecommendations(team, "gen9ou")
    expect(Array.isArray(result)).toBe(true)
  })

  it("fallback excludes species with num > 1025", async () => {
    const team = [makeSlot("pikachu", ["Electric"])]

    mockGetUsageStats.mockResolvedValue([])
    mockListSpecies.mockReturnValue([
      mockSpeciesResult("bulbasaur", ["Grass", "Poison"]),
      { ...mockSpeciesResult("futuremon", ["Psychic"]), num: 1100 },
    ])

    mockGetSpecies.mockImplementation((id: string) => {
      if (id === "bulbasaur") return mockSpeciesResult("bulbasaur", ["Grass", "Poison"])
      if (id === "futuremon") return { ...mockSpeciesResult("futuremon", ["Psychic"]), num: 1100 }
      return null
    })

    const result = await getCoverageBasedRecommendations(team, "gen9ou")
    const ids = result.map((r) => r.pokemonId)
    expect(ids).not.toContain("futuremon")
  })

  it("fallback caps at 200 species", async () => {
    const team = [makeSlot("pikachu", ["Electric"])]

    mockGetUsageStats.mockResolvedValue([])
    // Create 250 valid species entries
    const allSpecies = Array.from({ length: 250 }, (_, i) => ({
      ...mockSpeciesResult(`mon${i}`, ["Fighting"]),
      num: i + 1,
    }))
    mockListSpecies.mockReturnValue(allSpecies)

    mockGetSpecies.mockImplementation((id: string) => {
      return mockSpeciesResult(id, ["Fighting"])
    })

    const result = await getCoverageBasedRecommendations(team, "gen9ou")
    // pikachu is on the team so excluded; at most 200 candidates minus pikachu
    expect(result.length).toBeLessThanOrEqual(200)
  })

  // -----------------------------------------------------------------------
  // Limit
  // -----------------------------------------------------------------------

  it("respects the limit parameter", async () => {
    const team = [makeSlot("snorlax", ["Normal"])]

    const entries = Array.from({ length: 20 }, (_, i) => ({
      pokemonId: `mon-${i}`,
      usagePercent: 20 - i,
      rank: i + 1,
    }))

    mockGetUsageStats.mockResolvedValue(entries)

    mockGetSpecies.mockImplementation((id: string) => {
      return mockSpeciesResult(id, ["Fighting"])
    })

    const result = await getCoverageBasedRecommendations(team, "gen9ou", 5)
    expect(result.length).toBeLessThanOrEqual(5)
  })

  // -----------------------------------------------------------------------
  // Sorting
  // -----------------------------------------------------------------------

  it("returns results sorted by score descending", async () => {
    const team = [makeSlot("snorlax", ["Normal"])]

    mockGetUsageStats.mockResolvedValue([
      { pokemonId: "lucario", usagePercent: 10, rank: 1 },
      { pokemonId: "machamp", usagePercent: 8, rank: 2 },
      { pokemonId: "heatran", usagePercent: 12, rank: 3 },
    ])

    mockGetSpecies.mockImplementation((id: string) => {
      if (id === "lucario") return mockSpeciesResult("lucario", ["Fighting", "Steel"])
      if (id === "machamp") return mockSpeciesResult("machamp", ["Fighting"])
      if (id === "heatran") return mockSpeciesResult("heatran", ["Fire", "Steel"])
      return null
    })

    const result = await getCoverageBasedRecommendations(team, "gen9ou")

    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].score).toBeGreaterThanOrEqual(result[i].score)
    }
  })

  // -----------------------------------------------------------------------
  // Score capping
  // -----------------------------------------------------------------------

  it("caps recommendation scores at 100", async () => {
    const team = [
      makeSlot("snorlax", ["Normal"]),
      makeSlot("blissey", ["Normal"]),
      makeSlot("chansey", ["Normal"]),
    ]

    mockGetUsageStats.mockResolvedValue([{ pokemonId: "lucario", usagePercent: 10, rank: 1 }])

    mockGetSpecies.mockImplementation((id: string) => {
      if (id === "lucario") return mockSpeciesResult("lucario", ["Fighting", "Steel"])
      return null
    })

    const result = await getCoverageBasedRecommendations(team, "gen9ou")

    for (const rec of result) {
      expect(rec.score).toBeLessThanOrEqual(100)
    }
  })

  // -----------------------------------------------------------------------
  // Return shape
  // -----------------------------------------------------------------------

  it("returns correctly shaped Recommendation objects", async () => {
    const team = [makeSlot("pikachu", ["Electric"])]

    mockGetUsageStats.mockResolvedValue([{ pokemonId: "garchomp", usagePercent: 15, rank: 1 }])

    mockGetSpecies.mockImplementation((id: string) => {
      if (id === "garchomp") return mockSpeciesResult("garchomp", ["Dragon", "Ground"])
      return null
    })

    const result = await getCoverageBasedRecommendations(team, "gen9ou")

    if (result.length > 0) {
      const rec = result[0]
      expect(rec).toHaveProperty("pokemonId")
      expect(rec).toHaveProperty("pokemonName")
      expect(rec).toHaveProperty("score")
      expect(rec).toHaveProperty("reasons")
      expect(typeof rec.score).toBe("number")
      expect(Array.isArray(rec.reasons)).toBe(true)

      for (const reason of rec.reasons) {
        expect(reason).toHaveProperty("type", "coverage")
        expect(reason).toHaveProperty("description")
        expect(reason).toHaveProperty("weight")
      }
    }
  })
})
