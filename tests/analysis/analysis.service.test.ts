import { analyzeTeam } from "@nasty-plot/analysis"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@nasty-plot/db", () => ({
  prisma: {
    team: {
      findUnique: vi.fn(),
    },
    usageStats: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock("@pkmn/dex", () => ({
  Dex: {
    forGen: vi.fn().mockReturnValue({
      species: { get: vi.fn(), all: vi.fn() },
      moves: { get: vi.fn(), all: vi.fn() },
      abilities: { get: vi.fn(), all: vi.fn() },
      items: { get: vi.fn(), all: vi.fn() },
      learnsets: { get: vi.fn() },
    }),
    species: {
      get: vi.fn(),
    },
  },
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

import { prisma } from "@nasty-plot/db"
import { Dex } from "@pkmn/dex"
import { analyzeTypeCoverage } from "#analysis/coverage.service"
import { identifyThreats } from "#analysis/threat.service"
import { calculateSynergy } from "#analysis/synergy.service"

const mockTeamFindUnique = prisma.team.findUnique as ReturnType<typeof vi.fn>
const mockUsageFindMany = prisma.usageStats.findMany as ReturnType<typeof vi.fn>
const mockSpeciesGet = Dex.species.get as ReturnType<typeof vi.fn>
const mockCoverage = analyzeTypeCoverage as ReturnType<typeof vi.fn>
const mockThreats = identifyThreats as ReturnType<typeof vi.fn>
const mockSynergy = calculateSynergy as ReturnType<typeof vi.fn>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDbTeam(slots: unknown[] = []) {
  return {
    id: "team-1",
    name: "Test Team",
    formatId: "gen9ou",
    mode: "freeform",
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    slots,
  }
}

function makeDbSlot(overrides?: Record<string, unknown>) {
  return {
    id: 1,
    teamId: "team-1",
    position: 1,
    pokemonId: "garchomp",
    nickname: null,
    ability: "Rough Skin",
    item: "Leftovers",
    nature: "Jolly",
    teraType: null,
    level: 100,
    move1: "Earthquake",
    move2: "Dragon Claw",
    move3: null,
    move4: null,
    evHp: 0,
    evAtk: 252,
    evDef: 0,
    evSpA: 0,
    evSpD: 4,
    evSpe: 252,
    ivHp: 31,
    ivAtk: 31,
    ivDef: 31,
    ivSpA: 31,
    ivSpD: 31,
    ivSpe: 31,
    ...overrides,
  }
}

function mockSpeciesData(id: string, types: string[]) {
  return {
    exists: true,
    name: id.charAt(0).toUpperCase() + id.slice(1),
    num: 1,
    types,
    baseStats: { hp: 108, atk: 130, def: 95, spa: 80, spd: 85, spe: 102 },
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

    mockUsageFindMany.mockResolvedValue([])
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
    mockTeamFindUnique.mockResolvedValue(null)

    await expect(analyzeTeam("nonexistent")).rejects.toThrow("Team not found")
  })

  it("returns a TeamAnalysis object", async () => {
    mockTeamFindUnique.mockResolvedValue(makeDbTeam([makeDbSlot()]))
    mockSpeciesGet.mockReturnValue(mockSpeciesData("garchomp", ["Dragon", "Ground"]))

    const result = await analyzeTeam("team-1")

    expect(result).toHaveProperty("coverage")
    expect(result).toHaveProperty("threats")
    expect(result).toHaveProperty("synergyScore")
    expect(result).toHaveProperty("speedTiers")
    expect(result).toHaveProperty("suggestions")
  })

  it("calls analyzeTypeCoverage with converted slots", async () => {
    mockTeamFindUnique.mockResolvedValue(makeDbTeam([makeDbSlot()]))
    mockSpeciesGet.mockReturnValue(mockSpeciesData("garchomp", ["Dragon", "Ground"]))

    await analyzeTeam("team-1")

    expect(mockCoverage).toHaveBeenCalledTimes(1)
    const passedSlots = mockCoverage.mock.calls[0][0]
    expect(passedSlots).toHaveLength(1)
    expect(passedSlots[0].pokemonId).toBe("garchomp")
  })

  it("calls identifyThreats with slots and formatId", async () => {
    mockTeamFindUnique.mockResolvedValue(makeDbTeam([makeDbSlot()]))
    mockSpeciesGet.mockReturnValue(mockSpeciesData("garchomp", ["Dragon", "Ground"]))

    await analyzeTeam("team-1")

    expect(mockThreats).toHaveBeenCalledWith(expect.any(Array), "gen9ou")
  })

  it("calls calculateSynergy with converted slots", async () => {
    mockTeamFindUnique.mockResolvedValue(makeDbTeam([makeDbSlot()]))
    mockSpeciesGet.mockReturnValue(mockSpeciesData("garchomp", ["Dragon", "Ground"]))

    await analyzeTeam("team-1")

    expect(mockSynergy).toHaveBeenCalledTimes(1)
  })

  it("calculates speed tiers", async () => {
    mockTeamFindUnique.mockResolvedValue(makeDbTeam([makeDbSlot()]))
    mockSpeciesGet.mockReturnValue(mockSpeciesData("garchomp", ["Dragon", "Ground"]))

    const result = await analyzeTeam("team-1")

    expect(Array.isArray(result.speedTiers)).toBe(true)
    if (result.speedTiers.length > 0) {
      expect(result.speedTiers[0]).toHaveProperty("pokemonId")
      expect(result.speedTiers[0]).toHaveProperty("speed")
      expect(result.speedTiers[0]).toHaveProperty("nature")
    }
  })

  it("generates suggestions based on analysis", async () => {
    mockTeamFindUnique.mockResolvedValue(makeDbTeam([makeDbSlot()]))
    mockSpeciesGet.mockReturnValue(mockSpeciesData("garchomp", ["Dragon", "Ground"]))
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
    mockTeamFindUnique.mockResolvedValue(makeDbTeam([makeDbSlot()]))
    mockSpeciesGet.mockReturnValue(mockSpeciesData("garchomp", ["Dragon", "Ground"]))

    const result = await analyzeTeam("team-1")

    const fillSuggestion = result.suggestions.find((s: string) => s.includes("only has"))
    expect(fillSuggestion).toBeDefined()
  })

  it("handles team with multiple slots", async () => {
    mockTeamFindUnique.mockResolvedValue(
      makeDbTeam([
        makeDbSlot({ position: 1, pokemonId: "garchomp" }),
        makeDbSlot({ position: 2, pokemonId: "heatran", id: 2 }),
      ]),
    )

    mockSpeciesGet.mockImplementation((id: string) => {
      if (id === "garchomp") return mockSpeciesData("garchomp", ["Dragon", "Ground"])
      if (id === "heatran") return mockSpeciesData("heatran", ["Fire", "Steel"])
      return { exists: false }
    })

    const result = await analyzeTeam("team-1")

    expect(result).toBeDefined()
    expect(result.speedTiers.length).toBe(2)
  })

  it("suggests addressing shared weaknesses", async () => {
    mockTeamFindUnique.mockResolvedValue(makeDbTeam([makeDbSlot()]))
    mockSpeciesGet.mockReturnValue(mockSpeciesData("garchomp", ["Dragon", "Ground"]))
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
    mockTeamFindUnique.mockResolvedValue(makeDbTeam([makeDbSlot()]))
    mockSpeciesGet.mockReturnValue(mockSpeciesData("garchomp", ["Dragon", "Ground"]))
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
    mockTeamFindUnique.mockResolvedValue(makeDbTeam([makeDbSlot()]))
    mockSpeciesGet.mockReturnValue(mockSpeciesData("garchomp", ["Dragon", "Ground"]))
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
    mockTeamFindUnique.mockResolvedValue(makeDbTeam([makeDbSlot()]))
    mockSpeciesGet.mockReturnValue(mockSpeciesData("garchomp", ["Dragon", "Ground"]))
    mockSynergy.mockReturnValue(30)

    const result = await analyzeTeam("team-1")

    const synergySuggestion = result.suggestions.find((s: string) => s.includes("synergy is low"))
    expect(synergySuggestion).toBeDefined()
  })

  it("does not suggest synergy improvement when score is adequate", async () => {
    mockTeamFindUnique.mockResolvedValue(makeDbTeam([makeDbSlot()]))
    mockSpeciesGet.mockReturnValue(mockSpeciesData("garchomp", ["Dragon", "Ground"]))
    mockSynergy.mockReturnValue(60)

    const result = await analyzeTeam("team-1")

    const synergySuggestion = result.suggestions.find((s: string) => s.includes("synergy is low"))
    expect(synergySuggestion).toBeUndefined()
  })

  it("includes benchmark speed tiers from format usage data", async () => {
    mockTeamFindUnique.mockResolvedValue(makeDbTeam([makeDbSlot()]))
    mockSpeciesGet.mockImplementation((id: string) => {
      if (id === "garchomp") return mockSpeciesData("garchomp", ["Dragon", "Ground"])
      if (id === "ironValiant")
        return {
          ...mockSpeciesData("ironValiant", ["Fairy", "Fighting"]),
          baseStats: { hp: 74, atk: 130, def: 90, spa: 120, spd: 60, spe: 116 },
        }
      if (id === "greatTusk")
        return {
          ...mockSpeciesData("greatTusk", ["Ground", "Fighting"]),
          baseStats: { hp: 115, atk: 131, def: 131, spa: 53, spd: 53, spe: 87 },
        }
      return { exists: false }
    })

    mockUsageFindMany.mockResolvedValue([
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
    mockTeamFindUnique.mockResolvedValue(makeDbTeam([makeDbSlot()]))
    mockSpeciesGet.mockReturnValue(mockSpeciesData("garchomp", ["Dragon", "Ground"]))

    // garchomp is already on the team — it should be skipped as a benchmark
    mockUsageFindMany.mockResolvedValue([
      { pokemonId: "garchomp", rank: 1, formatId: "gen9ou", usagePercent: 25 },
    ])

    const result = await analyzeTeam("team-1")

    const benchmarks = result.speedTiers.filter(
      (entry: { isBenchmark?: boolean }) => entry.isBenchmark,
    )
    expect(benchmarks.length).toBe(0)
  })

  it("limits benchmarks to 10 entries", async () => {
    mockTeamFindUnique.mockResolvedValue(makeDbTeam([makeDbSlot()]))
    mockSpeciesGet.mockImplementation((id: string) => {
      if (id === "garchomp") return mockSpeciesData("garchomp", ["Dragon", "Ground"])
      return {
        exists: true,
        name: id.charAt(0).toUpperCase() + id.slice(1),
        num: 1,
        types: ["Normal"],
        baseStats: { hp: 80, atk: 80, def: 80, spa: 80, spd: 80, spe: 80 },
        abilities: { "0": "Pressure" },
        weightkg: 50,
      }
    })

    // 15 usage entries that are NOT on the team
    const usageEntries = Array.from({ length: 15 }, (_, i) => ({
      pokemonId: `pokemon${i}`,
      rank: i + 1,
      formatId: "gen9ou",
      usagePercent: 20 - i,
    }))
    mockUsageFindMany.mockResolvedValue(usageEntries)

    const result = await analyzeTeam("team-1")

    const benchmarks = result.speedTiers.filter(
      (entry: { isBenchmark?: boolean }) => entry.isBenchmark,
    )
    expect(benchmarks.length).toBe(10)
  })

  it("skips benchmark entries for non-existent species", async () => {
    mockTeamFindUnique.mockResolvedValue(makeDbTeam([makeDbSlot()]))
    mockSpeciesGet.mockImplementation((id: string) => {
      if (id === "garchomp") return mockSpeciesData("garchomp", ["Dragon", "Ground"])
      return { exists: false }
    })

    mockUsageFindMany.mockResolvedValue([
      { pokemonId: "fakemon", rank: 1, formatId: "gen9ou", usagePercent: 25 },
    ])

    const result = await analyzeTeam("team-1")

    const benchmarks = result.speedTiers.filter(
      (entry: { isBenchmark?: boolean }) => entry.isBenchmark,
    )
    expect(benchmarks.length).toBe(0)
  })

  it("speed tiers are sorted by speed descending", async () => {
    mockTeamFindUnique.mockResolvedValue(
      makeDbTeam([
        makeDbSlot({ position: 1, pokemonId: "garchomp" }),
        makeDbSlot({ position: 2, pokemonId: "ferrothorn", id: 2 }),
      ]),
    )

    mockSpeciesGet.mockImplementation((id: string) => {
      if (id === "garchomp") return mockSpeciesData("garchomp", ["Dragon", "Ground"])
      if (id === "ferrothorn")
        return {
          ...mockSpeciesData("ferrothorn", ["Grass", "Steel"]),
          baseStats: { hp: 74, atk: 94, def: 131, spa: 54, spd: 116, spe: 20 },
        }
      return { exists: false }
    })

    const result = await analyzeTeam("team-1")

    if (result.speedTiers.length >= 2) {
      expect(result.speedTiers[0].speed).toBeGreaterThanOrEqual(result.speedTiers[1].speed)
    }
  })
})
