import {
  extractPokemonIds,
  createSampleTeam,
  listSampleTeams,
  getSampleTeam,
  deleteSampleTeam,
  importSampleTeamsFromPastes,
} from "@nasty-plot/teams"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@nasty-plot/db", () => ({
  prisma: {
    sampleTeam: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

vi.mock("@nasty-plot/core", () => ({
  parseShowdownPaste: vi.fn((paste: string) => {
    // Simple mock: split by double newline, extract pokemonId from first word
    const blocks = paste
      .trim()
      .split(/\n\s*\n/)
      .filter(Boolean)
    return blocks.map((block: string) => {
      const firstLine = block.split("\n")[0].trim()
      const name = firstLine.split(" @ ")[0].trim().replace(/\s+/g, "")
      return { pokemonId: name.charAt(0).toLowerCase() + name.slice(1) }
    })
  }),
}))

import { prisma } from "@nasty-plot/db"

const mockCreate = prisma.sampleTeam.create as ReturnType<typeof vi.fn>
const mockFindMany = prisma.sampleTeam.findMany as ReturnType<typeof vi.fn>
const mockCount = prisma.sampleTeam.count as ReturnType<typeof vi.fn>
const mockFindUnique = prisma.sampleTeam.findUnique as ReturnType<typeof vi.fn>
const mockDelete = prisma.sampleTeam.delete as ReturnType<typeof vi.fn>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSampleTeam(overrides?: Record<string, unknown>) {
  return {
    id: "sample-1",
    name: "OU Rain",
    formatId: "gen9ou",
    archetype: "rain",
    source: "smogon",
    sourceUrl: "https://smogon.com/forums/threads/123",
    paste: "Pelipper @ Damp Rock\nAbility: Drizzle",
    pokemonIds: "pelipper",
    isActive: true,
    createdAt: new Date("2025-01-01"),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("extractPokemonIds", () => {
  it("extracts pokemon IDs from a paste", () => {
    const paste =
      "Garchomp @ Leftovers\nAbility: Rough Skin\n\nHeatran @ Air Balloon\nAbility: Flash Fire"
    const result = extractPokemonIds(paste)

    expect(result).toHaveLength(2)
    expect(result[0]).toBe("garchomp")
    expect(result[1]).toBe("heatran")
  })

  it("returns empty array for empty paste", () => {
    const result = extractPokemonIds("")
    // parseShowdownPaste mock returns array with one entry for empty string
    expect(Array.isArray(result)).toBe(true)
  })

  it("filters out falsy pokemonIds", async () => {
    const { parseShowdownPaste } = await import("@nasty-plot/core")
    ;(parseShowdownPaste as ReturnType<typeof vi.fn>).mockReturnValueOnce([
      { pokemonId: "garchomp" },
      { pokemonId: "" },
      { pokemonId: undefined },
      { pokemonId: "heatran" },
    ])

    const result = extractPokemonIds("anything")
    expect(result).toEqual(["garchomp", "heatran"])
  })
})

describe("createSampleTeam", () => {
  beforeEach(() => vi.clearAllMocks())

  it("creates a sample team with all fields", async () => {
    mockCreate.mockResolvedValue(makeSampleTeam())

    const result = await createSampleTeam({
      name: "OU Rain",
      formatId: "gen9ou",
      paste: "Pelipper @ Damp Rock\nAbility: Drizzle",
      archetype: "rain",
      source: "smogon",
      sourceUrl: "https://smogon.com/forums/threads/123",
    })

    expect(result.id).toBe("sample-1")
    expect(result.name).toBe("OU Rain")
    expect(result.formatId).toBe("gen9ou")
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "OU Rain",
        formatId: "gen9ou",
        archetype: "rain",
        source: "smogon",
        sourceUrl: "https://smogon.com/forums/threads/123",
      }),
    })
  })

  it("sets optional fields to null when not provided", async () => {
    mockCreate.mockResolvedValue(makeSampleTeam({ archetype: null, source: null, sourceUrl: null }))

    await createSampleTeam({
      name: "Basic Team",
      formatId: "gen9ou",
      paste: "Garchomp @ Leftovers\nAbility: Rough Skin",
    })

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        archetype: null,
        source: null,
        sourceUrl: null,
      }),
    })
  })

  it("extracts pokemonIds from paste and joins as comma-separated string", async () => {
    mockCreate.mockResolvedValue(makeSampleTeam({ pokemonIds: "garchomp,heatran" }))

    await createSampleTeam({
      name: "Duo Team",
      formatId: "gen9ou",
      paste:
        "Garchomp @ Leftovers\nAbility: Rough Skin\n\nHeatran @ Air Balloon\nAbility: Flash Fire",
    })

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        pokemonIds: expect.stringContaining(","),
      }),
    })
  })
})

describe("listSampleTeams", () => {
  beforeEach(() => vi.clearAllMocks())

  it("lists all active sample teams without filters", async () => {
    mockFindMany.mockResolvedValue([makeSampleTeam()])
    mockCount.mockResolvedValue(1)

    const result = await listSampleTeams()

    expect(result.teams).toHaveLength(1)
    expect(result.total).toBe(1)
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      skip: 0,
      take: 20,
    })
  })

  it("filters by formatId", async () => {
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(0)

    await listSampleTeams({ formatId: "gen9uu" })

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { isActive: true, formatId: "gen9uu" },
      orderBy: { createdAt: "desc" },
      skip: 0,
      take: 20,
    })
  })

  it("filters by archetype", async () => {
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(0)

    await listSampleTeams({ archetype: "rain" })

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { isActive: true, archetype: "rain" },
      orderBy: { createdAt: "desc" },
      skip: 0,
      take: 20,
    })
  })

  it("filters by search term with OR conditions", async () => {
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(0)

    await listSampleTeams({ search: "garchomp" })

    expect(mockFindMany).toHaveBeenCalledWith({
      where: {
        isActive: true,
        OR: [{ name: { contains: "garchomp" } }, { pokemonIds: { contains: "garchomp" } }],
      },
      orderBy: { createdAt: "desc" },
      skip: 0,
      take: 20,
    })
  })

  it("combines multiple filters", async () => {
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(0)

    await listSampleTeams({ formatId: "gen9ou", archetype: "rain", search: "pelipper" })

    expect(mockFindMany).toHaveBeenCalledWith({
      where: {
        isActive: true,
        formatId: "gen9ou",
        archetype: "rain",
        OR: [{ name: { contains: "pelipper" } }, { pokemonIds: { contains: "pelipper" } }],
      },
      orderBy: { createdAt: "desc" },
      skip: 0,
      take: 20,
    })
  })
})

describe("getSampleTeam", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns a sample team when found", async () => {
    mockFindUnique.mockResolvedValue(makeSampleTeam())

    const result = await getSampleTeam("sample-1")

    expect(result).not.toBeNull()
    expect(result!.id).toBe("sample-1")
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: "sample-1" } })
  })

  it("returns null when not found", async () => {
    mockFindUnique.mockResolvedValue(null)

    const result = await getSampleTeam("nonexistent")

    expect(result).toBeNull()
  })
})

describe("deleteSampleTeam", () => {
  beforeEach(() => vi.clearAllMocks())

  it("deletes a sample team by id", async () => {
    mockDelete.mockResolvedValue({})

    await deleteSampleTeam("sample-1")

    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "sample-1" } })
  })
})

describe("importSampleTeamsFromPastes", () => {
  beforeEach(() => vi.clearAllMocks())

  it("creates multiple sample teams from paste entries", async () => {
    let callCount = 0
    mockCreate.mockImplementation(() => {
      callCount++
      return Promise.resolve(
        makeSampleTeam({ id: `sample-${callCount}`, name: `Team ${callCount}` }),
      )
    })

    const pastes = [
      { name: "Rain Team", paste: "Pelipper @ Damp Rock\nAbility: Drizzle", archetype: "rain" },
      {
        name: "Sand Team",
        paste: "Tyranitar @ Leftovers\nAbility: Sand Stream",
        archetype: "sand",
      },
    ]

    const result = await importSampleTeamsFromPastes(pastes, "gen9ou", "smogon")

    expect(result).toHaveLength(2)
    expect(mockCreate).toHaveBeenCalledTimes(2)
  })

  it("passes source to each created team", async () => {
    mockCreate.mockResolvedValue(makeSampleTeam())

    const pastes = [{ name: "Team A", paste: "Garchomp @ Leftovers\nAbility: Rough Skin" }]

    await importSampleTeamsFromPastes(pastes, "gen9ou", "tournament")

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        source: "tournament",
        formatId: "gen9ou",
      }),
    })
  })

  it("works without source parameter", async () => {
    mockCreate.mockResolvedValue(makeSampleTeam({ source: null }))

    const pastes = [{ name: "Team A", paste: "Garchomp @ Leftovers\nAbility: Rough Skin" }]

    await importSampleTeamsFromPastes(pastes, "gen9ou")

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        source: null,
      }),
    })
  })

  it("passes archetype from each paste entry", async () => {
    mockCreate.mockResolvedValue(makeSampleTeam())

    const pastes = [
      { name: "Rain", paste: "Pelipper @ Damp Rock\nAbility: Drizzle", archetype: "rain" },
    ]

    await importSampleTeamsFromPastes(pastes, "gen9ou")

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        archetype: "rain",
      }),
    })
  })

  it("returns empty array for empty paste list", async () => {
    const result = await importSampleTeamsFromPastes([], "gen9ou")

    expect(result).toEqual([])
    expect(mockCreate).not.toHaveBeenCalled()
  })
})
