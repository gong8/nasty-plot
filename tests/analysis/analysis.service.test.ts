import { analyzeTeam } from "@nasty-plot/analysis"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@nasty-plot/teams", () => ({
  getTeam: vi.fn(),
}))

vi.mock("@nasty-plot/pokemon-data", () => ({
  getSpecies: vi.fn(),
  getAllSpecies: vi.fn(),
}))

vi.mock("@nasty-plot/smogon-data", () => ({
  getUsageStats: vi.fn(),
}))

vi.mock("#analysis/coverage.service", () => ({
  analyzeTypeCoverage: vi.fn(),
}))

vi.mock("#analysis/threat.service", () => ({
  identifyThreats: vi.fn(),
}))

vi.mock("#analysis/synergy.service", () => ({
  calculateSynergy: vi.fn(),
}))

vi.mock("@nasty-plot/formats", () => ({
  getFormat: vi.fn().mockReturnValue({
    id: "gen9ou",
    defaultLevel: 100,
  }),
}))

import { getTeam } from "@nasty-plot/teams"
import { getSpecies } from "@nasty-plot/pokemon-data"
import { getUsageStats } from "@nasty-plot/smogon-data"
import { analyzeTypeCoverage } from "#analysis/coverage.service"
import { identifyThreats } from "#analysis/threat.service"
import { calculateSynergy } from "#analysis/synergy.service"

const mockGetTeam = getTeam as ReturnType<typeof vi.fn>
const mockGetSpecies = getSpecies as ReturnType<typeof vi.fn>
const mockGetUsageStats = getUsageStats as ReturnType<typeof vi.fn>
const mockCoverage = analyzeTypeCoverage as ReturnType<typeof vi.fn>
const mockThreats = identifyThreats as ReturnType<typeof vi.fn>
const mockSynergy = calculateSynergy as ReturnType<typeof vi.fn>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTeamData(slots: unknown[] = []) {
  return {
    id: "team-1",
    name: "Test Team",
    formatId: "gen9ou",
    mode: "freeform",
    source: "manual",
    notes: undefined,
    isArchived: false,
    slots,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function makeSlot(overrides?: Record<string, unknown>) {
  return {
    position: 1,
    pokemonId: "garchomp",
    species: makeSpecies("garchomp", ["Dragon", "Ground"]),
    ability: "Rough Skin",
    item: "Leftovers",
    nature: "Jolly",
    teraType: undefined,
    level: 100,
    moves: ["Earthquake", "Dragon Claw", undefined, undefined],
    evs: { hp: 0, atk: 252, def: 0, spa: 0, spd: 4, spe: 252 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    ...overrides,
  }
}

function makeSpecies(id: string, types: string[], baseStatsOverride?: Record<string, number>) {
  return {
    id,
    name: id.charAt(0).toUpperCase() + id.slice(1),
    num: 1,
    types,
    baseStats: baseStatsOverride ?? { hp: 108, atk: 130, def: 95, spa: 80, spd: 85, spe: 102 },
    abilities: { "0": "Rough Skin" },
    weightkg: 95,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("analyzeTeam", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockGetUsageStats.mockResolvedValue([])
    mockCoverage.mockReturnValue({
      offensive: {},
      defensive: {},
      uncoveredTypes: [],
      sharedWeaknesses: [],
    })
    mockThreats.mockResolvedValue([])
    mockSynergy.mockReturnValue(75)
  })

  it("throws when team not found", async () => {
    mockGetTeam.mockResolvedValue(null)

    await expect(analyzeTeam("nonexistent")).rejects.toThrow("Team not found")
  })

  it("returns a TeamAnalysis object", async () => {
    mockGetTeam.mockResolvedValue(makeTeamData([makeSlot()]))
    mockGetSpecies.mockReturnValue(makeSpecies("garchomp", ["Dragon", "Ground"]))

    const result = await analyzeTeam("team-1")

    expect(result).toHaveProperty("coverage")
    expect(result).toHaveProperty("threats")
    expect(result).toHaveProperty("synergyScore")
    expect(result).toHaveProperty("speedTiers")
    expect(result).toHaveProperty("suggestions")
  })

  it("calls analyzeTypeCoverage with converted slots", async () => {
    mockGetTeam.mockResolvedValue(makeTeamData([makeSlot()]))
    mockGetSpecies.mockReturnValue(makeSpecies("garchomp", ["Dragon", "Ground"]))

    await analyzeTeam("team-1")

    expect(mockCoverage).toHaveBeenCalledTimes(1)
    const passedSlots = mockCoverage.mock.calls[0][0]
    expect(passedSlots).toHaveLength(1)
    expect(passedSlots[0].pokemonId).toBe("garchomp")
  })

  it("calls identifyThreats with slots and formatId", async () => {
    mockGetTeam.mockResolvedValue(makeTeamData([makeSlot()]))
    mockGetSpecies.mockReturnValue(makeSpecies("garchomp", ["Dragon", "Ground"]))

    await analyzeTeam("team-1")

    expect(mockThreats).toHaveBeenCalledWith(expect.any(Array), "gen9ou")
  })

  it("calls calculateSynergy with converted slots", async () => {
    mockGetTeam.mockResolvedValue(makeTeamData([makeSlot()]))
    mockGetSpecies.mockReturnValue(makeSpecies("garchomp", ["Dragon", "Ground"]))

    await analyzeTeam("team-1")

    expect(mockSynergy).toHaveBeenCalledTimes(1)
  })

  it("calculates speed tiers", async () => {
    mockGetTeam.mockResolvedValue(makeTeamData([makeSlot()]))
    mockGetSpecies.mockReturnValue(makeSpecies("garchomp", ["Dragon", "Ground"]))

    const result = await analyzeTeam("team-1")

    expect(Array.isArray(result.speedTiers)).toBe(true)
    if (result.speedTiers.length > 0) {
      expect(result.speedTiers[0]).toHaveProperty("pokemonId")
      expect(result.speedTiers[0]).toHaveProperty("speed")
      expect(result.speedTiers[0]).toHaveProperty("nature")
    }
  })

  it("generates suggestions based on analysis", async () => {
    mockGetTeam.mockResolvedValue(makeTeamData([makeSlot()]))
    mockGetSpecies.mockReturnValue(makeSpecies("garchomp", ["Dragon", "Ground"]))
    mockCoverage.mockReturnValue({
      offensive: {},
      defensive: {},
      uncoveredTypes: ["Fairy", "Steel"],
      sharedWeaknesses: [],
    })

    const result = await analyzeTeam("team-1")

    expect(result.suggestions.length).toBeGreaterThan(0)
  })

  it("suggests filling team when less than 6 Pokemon", async () => {
    mockGetTeam.mockResolvedValue(makeTeamData([makeSlot()]))
    mockGetSpecies.mockReturnValue(makeSpecies("garchomp", ["Dragon", "Ground"]))

    const result = await analyzeTeam("team-1")

    const fillSuggestion = result.suggestions.find((s: string) => s.includes("only has"))
    expect(fillSuggestion).toBeDefined()
  })

  it("handles team with multiple slots", async () => {
    mockGetTeam.mockResolvedValue(
      makeTeamData([
        makeSlot({
          position: 1,
          pokemonId: "garchomp",
          species: makeSpecies("garchomp", ["Dragon", "Ground"]),
        }),
        makeSlot({
          position: 2,
          pokemonId: "heatran",
          species: makeSpecies("heatran", ["Fire", "Steel"]),
        }),
      ]),
    )

    mockGetSpecies.mockImplementation((id: string) => {
      if (id === "garchomp") return makeSpecies("garchomp", ["Dragon", "Ground"])
      if (id === "heatran") return makeSpecies("heatran", ["Fire", "Steel"])
      return null
    })

    const result = await analyzeTeam("team-1")

    expect(result).toBeDefined()
    expect(result.speedTiers.length).toBe(2)
  })

  it("suggests addressing shared weaknesses", async () => {
    mockGetTeam.mockResolvedValue(makeTeamData([makeSlot()]))
    mockGetSpecies.mockReturnValue(makeSpecies("garchomp", ["Dragon", "Ground"]))
    mockCoverage.mockReturnValue({
      offensive: {},
      defensive: {},
      uncoveredTypes: [],
      sharedWeaknesses: ["Ice", "Fairy"],
    })

    const result = await analyzeTeam("team-1")

    const iceSuggestion = result.suggestions.find((s: string) => s.includes("weak to Ice"))
    const fairySuggestion = result.suggestions.find((s: string) => s.includes("weak to Fairy"))
    expect(iceSuggestion).toBeDefined()
    expect(fairySuggestion).toBeDefined()
  })

  it("suggests counters for multiple high threats (plural)", async () => {
    mockGetTeam.mockResolvedValue(makeTeamData([makeSlot()]))
    mockGetSpecies.mockReturnValue(makeSpecies("garchomp", ["Dragon", "Ground"]))
    mockThreats.mockResolvedValue([
      { pokemonId: "ironValiant", pokemonName: "Iron Valiant", threatLevel: "high" },
      { pokemonId: "greatTusk", pokemonName: "Great Tusk", threatLevel: "high" },
    ])

    const result = await analyzeTeam("team-1")

    const threatSuggestion = result.suggestions.find(
      (s: string) => s.includes("Iron Valiant") && s.includes("Great Tusk"),
    )
    expect(threatSuggestion).toBeDefined()
    expect(threatSuggestion).toContain("are")
    expect(threatSuggestion).toContain("threats")
  })

  it("suggests counters for a single high threat (singular)", async () => {
    mockGetTeam.mockResolvedValue(makeTeamData([makeSlot()]))
    mockGetSpecies.mockReturnValue(makeSpecies("garchomp", ["Dragon", "Ground"]))
    mockThreats.mockResolvedValue([
      { pokemonId: "ironValiant", pokemonName: "Iron Valiant", threatLevel: "high" },
    ])

    const result = await analyzeTeam("team-1")

    const threatSuggestion = result.suggestions.find((s: string) => s.includes("Iron Valiant"))
    expect(threatSuggestion).toBeDefined()
    expect(threatSuggestion).toContain("is a")
    expect(threatSuggestion).not.toContain("threats")
  })

  it("suggests improving synergy when score is low", async () => {
    mockGetTeam.mockResolvedValue(makeTeamData([makeSlot()]))
    mockGetSpecies.mockReturnValue(makeSpecies("garchomp", ["Dragon", "Ground"]))
    mockSynergy.mockReturnValue(30)

    const result = await analyzeTeam("team-1")

    const synergySuggestion = result.suggestions.find((s: string) => s.includes("synergy is low"))
    expect(synergySuggestion).toBeDefined()
  })

  it("does not suggest synergy improvement when score is adequate", async () => {
    mockGetTeam.mockResolvedValue(makeTeamData([makeSlot()]))
    mockGetSpecies.mockReturnValue(makeSpecies("garchomp", ["Dragon", "Ground"]))
    mockSynergy.mockReturnValue(60)

    const result = await analyzeTeam("team-1")

    const synergySuggestion = result.suggestions.find((s: string) => s.includes("synergy is low"))
    expect(synergySuggestion).toBeUndefined()
  })

  it("includes benchmark speed tiers from format usage data", async () => {
    mockGetTeam.mockResolvedValue(makeTeamData([makeSlot()]))
    mockGetSpecies.mockImplementation((id: string) => {
      if (id === "garchomp") return makeSpecies("garchomp", ["Dragon", "Ground"])
      if (id === "ironValiant")
        return makeSpecies("ironValiant", ["Fairy", "Fighting"], {
          hp: 74,
          atk: 130,
          def: 90,
          spa: 120,
          spd: 60,
          spe: 116,
        })
      if (id === "greatTusk")
        return makeSpecies("greatTusk", ["Ground", "Fighting"], {
          hp: 115,
          atk: 131,
          def: 131,
          spa: 53,
          spd: 53,
          spe: 87,
        })
      return null
    })

    mockGetUsageStats.mockResolvedValue([
      { pokemonId: "ironValiant", rank: 1, formatId: "gen9ou", usagePercent: 20 },
      { pokemonId: "greatTusk", rank: 2, formatId: "gen9ou", usagePercent: 15 },
    ])

    const result = await analyzeTeam("team-1")

    const benchmarks = result.speedTiers.filter(
      (entry: { isBenchmark?: boolean }) => entry.isBenchmark,
    )
    expect(benchmarks.length).toBe(2)
    expect(benchmarks[0].nature).toBe("Jolly")
    expect(benchmarks[0].evs).toBe(252)
  })

  it("skips benchmark entries for Pokemon already on the team", async () => {
    mockGetTeam.mockResolvedValue(makeTeamData([makeSlot()]))
    mockGetSpecies.mockReturnValue(makeSpecies("garchomp", ["Dragon", "Ground"]))

    // garchomp is already on the team — it should be skipped as a benchmark
    mockGetUsageStats.mockResolvedValue([
      { pokemonId: "garchomp", rank: 1, formatId: "gen9ou", usagePercent: 25 },
    ])

    const result = await analyzeTeam("team-1")

    const benchmarks = result.speedTiers.filter(
      (entry: { isBenchmark?: boolean }) => entry.isBenchmark,
    )
    expect(benchmarks.length).toBe(0)
  })

  it("limits benchmarks to 10 entries", async () => {
    mockGetTeam.mockResolvedValue(makeTeamData([makeSlot()]))
    mockGetSpecies.mockImplementation((id: string) => {
      if (id === "garchomp") return makeSpecies("garchomp", ["Dragon", "Ground"])
      return makeSpecies(id, ["Normal"])
    })

    // 15 usage entries that are NOT on the team
    const usageEntries = Array.from({ length: 15 }, (_, i) => ({
      pokemonId: `pokemon${i}`,
      rank: i + 1,
      formatId: "gen9ou",
      usagePercent: 20 - i,
    }))
    mockGetUsageStats.mockResolvedValue(usageEntries)

    const result = await analyzeTeam("team-1")

    const benchmarks = result.speedTiers.filter(
      (entry: { isBenchmark?: boolean }) => entry.isBenchmark,
    )
    expect(benchmarks.length).toBe(10)
  })

  it("skips benchmark entries for non-existent species", async () => {
    mockGetTeam.mockResolvedValue(makeTeamData([makeSlot()]))
    mockGetSpecies.mockImplementation((id: string) => {
      if (id === "garchomp") return makeSpecies("garchomp", ["Dragon", "Ground"])
      return null
    })

    mockGetUsageStats.mockResolvedValue([
      { pokemonId: "fakemon", rank: 1, formatId: "gen9ou", usagePercent: 25 },
    ])

    const result = await analyzeTeam("team-1")

    const benchmarks = result.speedTiers.filter(
      (entry: { isBenchmark?: boolean }) => entry.isBenchmark,
    )
    expect(benchmarks.length).toBe(0)
  })

  it("speed tiers are sorted by speed descending", async () => {
    mockGetTeam.mockResolvedValue(
      makeTeamData([
        makeSlot({
          position: 1,
          pokemonId: "garchomp",
          species: makeSpecies("garchomp", ["Dragon", "Ground"]),
        }),
        makeSlot({
          position: 2,
          pokemonId: "ferrothorn",
          species: makeSpecies("ferrothorn", ["Grass", "Steel"], {
            hp: 74,
            atk: 94,
            def: 131,
            spa: 54,
            spd: 116,
            spe: 20,
          }),
        }),
      ]),
    )

    mockGetSpecies.mockImplementation((id: string) => {
      if (id === "garchomp") return makeSpecies("garchomp", ["Dragon", "Ground"])
      if (id === "ferrothorn")
        return makeSpecies("ferrothorn", ["Grass", "Steel"], {
          hp: 74,
          atk: 94,
          def: 131,
          spa: 54,
          spd: 116,
          spe: 20,
        })
      return null
    })

    const result = await analyzeTeam("team-1")

    if (result.speedTiers.length >= 2) {
      expect(result.speedTiers[0].speed).toBeGreaterThanOrEqual(result.speedTiers[1].speed)
    }
  })
})
