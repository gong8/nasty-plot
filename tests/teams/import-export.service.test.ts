import {
  importShowdownPaste,
  importIntoTeam,
  exportShowdownPaste,
  createTeamFromExtractedData,
} from "@nasty-plot/teams"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@nasty-plot/core", async () => {
  const actual = await vi.importActual("@nasty-plot/core")
  return {
    ...actual,
    parseShowdownPaste: vi.fn(),
    serializeShowdownPaste: vi.fn(),
  }
})

import { DEFAULT_IVS, DEFAULT_LEVEL, MAX_SINGLE_EV } from "@nasty-plot/core"

vi.mock("#teams/team.service", () => ({
  createTeam: vi.fn(),
  addSlot: vi.fn(),
  getTeam: vi.fn(),
  clearSlots: vi.fn(),
}))

vi.mock("@nasty-plot/pokemon-data", () => ({
  getSpecies: vi.fn(),
}))

import { parseShowdownPaste, serializeShowdownPaste } from "@nasty-plot/core"
import { createTeam, addSlot, getTeam, clearSlots } from "#teams/team.service"
import { getSpecies } from "@nasty-plot/pokemon-data"

const mockParse = parseShowdownPaste as ReturnType<typeof vi.fn>
const mockSerialize = serializeShowdownPaste as ReturnType<typeof vi.fn>
const mockCreateTeam = createTeam as ReturnType<typeof vi.fn>
const mockAddSlot = addSlot as ReturnType<typeof vi.fn>
const mockGetTeam = getTeam as ReturnType<typeof vi.fn>
const mockClearSlots = clearSlots as ReturnType<typeof vi.fn>
const mockGetSpecies = getSpecies as ReturnType<typeof vi.fn>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeParsedPokemon(overrides?: Record<string, unknown>) {
  return {
    pokemonId: "garchomp",
    nickname: undefined,
    ability: "Rough Skin",
    item: "Leftovers",
    nature: "Jolly",
    teraType: undefined,
    level: DEFAULT_LEVEL,
    moves: ["Earthquake", "Dragon Claw", "Swords Dance", "Scale Shot"],
    evs: { hp: 0, atk: MAX_SINGLE_EV, def: 0, spa: 0, spd: 4, spe: MAX_SINGLE_EV },
    ivs: DEFAULT_IVS,
    ...overrides,
  }
}

function makeTeamData(overrides?: Record<string, unknown>) {
  return {
    id: "team-1",
    name: "Test Team",
    formatId: "gen9ou",
    mode: "freeform",
    slots: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("importShowdownPaste", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("creates a new team and adds slots from paste", async () => {
    const parsed = [makeParsedPokemon()]
    mockParse.mockReturnValue(parsed)
    mockCreateTeam.mockResolvedValue(makeTeamData())
    mockAddSlot.mockResolvedValue({})
    mockGetTeam.mockResolvedValue(makeTeamData({ slots: [{ pokemonId: "garchomp" }] }))

    const result = await importShowdownPaste("paste text", "gen9ou")

    expect(mockCreateTeam).toHaveBeenCalledWith({
      name: "Imported Team",
      formatId: "gen9ou",
    })
    expect(mockAddSlot).toHaveBeenCalledTimes(1)
    expect(result).toBeDefined()
  })

  it("uses custom team name when provided", async () => {
    mockParse.mockReturnValue([makeParsedPokemon()])
    mockCreateTeam.mockResolvedValue(makeTeamData({ name: "My Team" }))
    mockAddSlot.mockResolvedValue({})
    mockGetTeam.mockResolvedValue(makeTeamData())

    await importShowdownPaste("paste", "gen9ou", "My Team")

    expect(mockCreateTeam).toHaveBeenCalledWith({
      name: "My Team",
      formatId: "gen9ou",
    })
  })

  it("throws when paste contains no valid Pokemon", async () => {
    mockParse.mockReturnValue([])

    await expect(importShowdownPaste("invalid paste", "gen9ou")).rejects.toThrow(
      "No valid Pokemon found in paste",
    )
  })

  it("limits to 6 Pokemon", async () => {
    const parsed = Array.from({ length: 8 }, (_, i) => makeParsedPokemon({ pokemonId: `mon-${i}` }))
    mockParse.mockReturnValue(parsed)
    mockCreateTeam.mockResolvedValue(makeTeamData())
    mockAddSlot.mockResolvedValue({})
    mockGetTeam.mockResolvedValue(makeTeamData())

    await importShowdownPaste("paste", "gen9ou")

    expect(mockAddSlot).toHaveBeenCalledTimes(6)
  })

  it("assigns sequential positions starting at 1", async () => {
    const parsed = [
      makeParsedPokemon({ pokemonId: "garchomp" }),
      makeParsedPokemon({ pokemonId: "heatran" }),
    ]
    mockParse.mockReturnValue(parsed)
    mockCreateTeam.mockResolvedValue(makeTeamData())
    mockAddSlot.mockResolvedValue({})
    mockGetTeam.mockResolvedValue(makeTeamData())

    await importShowdownPaste("paste", "gen9ou")

    const firstCall = mockAddSlot.mock.calls[0][1]
    const secondCall = mockAddSlot.mock.calls[1][1]
    expect(firstCall.position).toBe(1)
    expect(secondCall.position).toBe(2)
  })
})

describe("importIntoTeam", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("clears existing slots before importing", async () => {
    mockParse.mockReturnValue([makeParsedPokemon()])
    mockClearSlots.mockResolvedValue(undefined)
    mockAddSlot.mockResolvedValue({})
    mockGetTeam.mockResolvedValue(makeTeamData())

    await importIntoTeam("team-1", "paste")

    expect(mockClearSlots).toHaveBeenCalledWith("team-1")
    expect(mockAddSlot).toHaveBeenCalled()
  })

  it("throws when paste has no valid Pokemon", async () => {
    mockParse.mockReturnValue([])

    await expect(importIntoTeam("team-1", "bad")).rejects.toThrow("No valid Pokemon found in paste")
  })
})

describe("exportShowdownPaste", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("serializes team slots to showdown paste", async () => {
    const team = makeTeamData({
      slots: [{ pokemonId: "garchomp", position: 1 }],
    })
    mockGetTeam.mockResolvedValue(team)
    mockSerialize.mockReturnValue("Garchomp @ Leftovers\n...")

    const result = await exportShowdownPaste("team-1")

    expect(mockGetTeam).toHaveBeenCalledWith("team-1")
    expect(mockSerialize).toHaveBeenCalledWith(team.slots)
    expect(result).toContain("Garchomp")
  })

  it("throws when team not found", async () => {
    mockGetTeam.mockResolvedValue(null)

    await expect(exportShowdownPaste("nonexistent")).rejects.toThrow("Team not found")
  })
})

describe("createTeamFromExtractedData", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("creates a team with source imported", async () => {
    const extracted = {
      playerName: "Alice",
      pokemon: [
        {
          pokemonId: "garchomp",
          pokemonName: "Garchomp",
          level: DEFAULT_LEVEL,
          moves: ["Earthquake", "Dragon Claw"],
          ability: "Rough Skin",
          item: "Choice Scarf",
        },
      ],
    }
    mockCreateTeam.mockResolvedValue(makeTeamData({ id: "new-team" }))
    mockAddSlot.mockResolvedValue({})
    mockGetTeam.mockResolvedValue(makeTeamData({ id: "new-team", source: "imported" }))

    const result = await createTeamFromExtractedData(extracted, "gen9ou")

    expect(mockCreateTeam).toHaveBeenCalledWith({
      name: "Alice's Team",
      formatId: "gen9ou",
      source: "imported",
    })
    expect(result.id).toBe("new-team")
  })

  it("uses custom team name when provided", async () => {
    const extracted = {
      playerName: "Alice",
      pokemon: [
        { pokemonId: "garchomp", pokemonName: "Garchomp", level: DEFAULT_LEVEL, moves: [] },
      ],
    }
    mockCreateTeam.mockResolvedValue(makeTeamData())
    mockAddSlot.mockResolvedValue({})
    mockGetTeam.mockResolvedValue(makeTeamData())
    mockGetSpecies.mockReturnValue({ abilities: { "0": "Rough Skin" } })

    await createTeamFromExtractedData(extracted, "gen9ou", "Custom Name")

    expect(mockCreateTeam).toHaveBeenCalledWith({
      name: "Custom Name",
      formatId: "gen9ou",
      source: "imported",
    })
  })

  it("resolves ability from dex when not revealed", async () => {
    const extracted = {
      playerName: "Alice",
      pokemon: [
        {
          pokemonId: "garchomp",
          pokemonName: "Garchomp",
          level: DEFAULT_LEVEL,
          moves: ["Earthquake"],
        },
      ],
    }
    mockCreateTeam.mockResolvedValue(makeTeamData({ id: "new-team" }))
    mockAddSlot.mockResolvedValue({})
    mockGetTeam.mockResolvedValue(makeTeamData())
    mockGetSpecies.mockReturnValue({ abilities: { "0": "Rough Skin" } })

    await createTeamFromExtractedData(extracted, "gen9ou")

    const slotArg = mockAddSlot.mock.calls[0][1]
    expect(slotArg.ability).toBe("Rough Skin")
  })

  it("uses revealed ability when provided", async () => {
    const extracted = {
      playerName: "Alice",
      pokemon: [
        {
          pokemonId: "garchomp",
          pokemonName: "Garchomp",
          level: DEFAULT_LEVEL,
          moves: [],
          ability: "Sand Veil",
        },
      ],
    }
    mockCreateTeam.mockResolvedValue(makeTeamData({ id: "new-team" }))
    mockAddSlot.mockResolvedValue({})
    mockGetTeam.mockResolvedValue(makeTeamData())

    await createTeamFromExtractedData(extracted, "gen9ou")

    const slotArg = mockAddSlot.mock.calls[0][1]
    expect(slotArg.ability).toBe("Sand Veil")
  })

  it("limits to 6 pokemon", async () => {
    const extracted = {
      playerName: "Alice",
      pokemon: Array.from({ length: 8 }, (_, i) => ({
        pokemonId: `mon${i}`,
        pokemonName: `Mon${i}`,
        level: DEFAULT_LEVEL,
        moves: [],
      })),
    }
    mockCreateTeam.mockResolvedValue(makeTeamData())
    mockAddSlot.mockResolvedValue({})
    mockGetTeam.mockResolvedValue(makeTeamData())
    mockGetSpecies.mockReturnValue({ abilities: { "0": "Ability" } })

    await createTeamFromExtractedData(extracted, "gen9ou")

    expect(mockAddSlot).toHaveBeenCalledTimes(6)
  })

  it("passes tera type and item from extracted data", async () => {
    const extracted = {
      playerName: "Alice",
      pokemon: [
        {
          pokemonId: "garchomp",
          pokemonName: "Garchomp",
          level: DEFAULT_LEVEL,
          moves: ["Earthquake"],
          ability: "Rough Skin",
          item: "Choice Scarf",
          teraType: "Fire",
        },
      ],
    }
    mockCreateTeam.mockResolvedValue(makeTeamData({ id: "new-team" }))
    mockAddSlot.mockResolvedValue({})
    mockGetTeam.mockResolvedValue(makeTeamData())

    await createTeamFromExtractedData(extracted, "gen9ou")

    const slotArg = mockAddSlot.mock.calls[0][1]
    expect(slotArg.item).toBe("Choice Scarf")
    expect(slotArg.teraType).toBe("Fire")
  })
})
