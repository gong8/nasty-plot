import {
  syncSmogonSets,
  getSetsForPokemon,
  getAllSetsForFormat,
  getNatureUsage,
} from "@nasty-plot/smogon-data"
import { MAX_SINGLE_EV } from "@nasty-plot/core"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Disable TTLCache so cached values don't leak between tests
vi.mock("@nasty-plot/core", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    TTLCache: class {
      get() {
        return undefined
      }
      set() {}
      invalidate() {}
      clear() {}
    },
  }
})

vi.mock("@nasty-plot/db", () => ({
  prisma: {
    $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    smogonSet: {
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
    dataSyncLog: {
      upsert: vi.fn(),
    },
  },
}))

vi.mock("#smogon-data/usage-stats.service", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, resolveYearMonth: vi.fn() }
})

vi.mock("#smogon-data/chaos-sets.service", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, generateSetsFromChaos: vi.fn() }
})

import { prisma } from "@nasty-plot/db"
import { resolveYearMonth } from "#smogon-data/usage-stats.service"
import { generateSetsFromChaos } from "#smogon-data/chaos-sets.service"
import { asMock } from "../test-utils"

const mockSetUpsert = asMock(prisma.smogonSet.upsert)
const mockSetFindMany = asMock(prisma.smogonSet.findMany)
const mockSyncLogUpsert = asMock(prisma.dataSyncLog.upsert)
const mockResolveYearMonth = asMock(resolveYearMonth)
const mockGenerateSetsFromChaos = asMock(generateSetsFromChaos)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDbSetRow(overrides?: Record<string, unknown>) {
  return {
    pokemonId: "garchomp",
    setName: "Swords Dance",
    ability: "Rough Skin",
    item: "Leftovers",
    nature: "Jolly",
    teraType: null,
    moves: JSON.stringify(["Earthquake", "Dragon Claw", "Swords Dance", "Scale Shot"]),
    evs: JSON.stringify({ atk: MAX_SINGLE_EV, spe: MAX_SINGLE_EV, spd: 4 }),
    ivs: null,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getSetsForPokemon", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns sets for a Pokemon in a format", async () => {
    mockSetFindMany.mockResolvedValue([makeDbSetRow()])

    const result = await getSetsForPokemon("gen9ou", "garchomp")

    expect(result).toHaveLength(1)
    expect(result[0].pokemonId).toBe("garchomp")
    expect(result[0].setName).toBe("Swords Dance")
    expect(result[0].ability).toBe("Rough Skin")
    expect(result[0].nature).toBe("Jolly")
    expect(Array.isArray(result[0].moves)).toBe(true)
  })

  it("returns empty array when no sets exist", async () => {
    mockSetFindMany.mockResolvedValue([])

    const result = await getSetsForPokemon("gen9ou", "unknown")

    expect(result).toEqual([])
  })

  it("queries with correct formatId and pokemonId", async () => {
    mockSetFindMany.mockResolvedValue([])

    await getSetsForPokemon("gen9ou", "garchomp")

    expect(mockSetFindMany).toHaveBeenCalledWith({
      where: { formatId: "gen9ou", pokemonId: "garchomp" },
    })
  })

  it("parses moves from JSON", async () => {
    mockSetFindMany.mockResolvedValue([makeDbSetRow()])

    const result = await getSetsForPokemon("gen9ou", "garchomp")

    expect(result[0].moves).toEqual(["Earthquake", "Dragon Claw", "Swords Dance", "Scale Shot"])
  })

  it("parses EVs from JSON", async () => {
    mockSetFindMany.mockResolvedValue([makeDbSetRow()])

    const result = await getSetsForPokemon("gen9ou", "garchomp")

    expect(result[0].evs).toEqual({ atk: MAX_SINGLE_EV, spe: MAX_SINGLE_EV, spd: 4 })
  })

  it("parses IVs from JSON when present", async () => {
    mockSetFindMany.mockResolvedValue([makeDbSetRow({ ivs: JSON.stringify({ atk: 0 }) })])

    const result = await getSetsForPokemon("gen9ou", "garchomp")

    expect(result[0].ivs).toEqual({ atk: 0 })
  })

  it("returns undefined ivs when null", async () => {
    mockSetFindMany.mockResolvedValue([makeDbSetRow({ ivs: null })])

    const result = await getSetsForPokemon("gen9ou", "garchomp")

    expect(result[0].ivs).toBeUndefined()
  })

  it("maps teraType when present", async () => {
    mockSetFindMany.mockResolvedValue([makeDbSetRow({ teraType: "Fairy" })])

    const result = await getSetsForPokemon("gen9ou", "garchomp")

    expect(result[0].teraType).toBe("Fairy")
  })
})

describe("getAllSetsForFormat", () => {
  beforeEach(() => vi.clearAllMocks())

  it("groups sets by pokemonId", async () => {
    mockSetFindMany.mockResolvedValue([
      makeDbSetRow({ pokemonId: "garchomp", setName: "SD" }),
      makeDbSetRow({ pokemonId: "garchomp", setName: "Scarf" }),
      makeDbSetRow({ pokemonId: "heatran", setName: "Special Wall" }),
    ])

    const result = await getAllSetsForFormat("gen9ou")

    expect(Object.keys(result)).toContain("garchomp")
    expect(Object.keys(result)).toContain("heatran")
    expect(result["garchomp"]).toHaveLength(2)
    expect(result["heatran"]).toHaveLength(1)
  })

  it("returns empty object when no sets exist", async () => {
    mockSetFindMany.mockResolvedValue([])

    const result = await getAllSetsForFormat("gen9ou")

    expect(result).toEqual({})
  })
})

describe("syncSmogonSets", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("fetch", vi.fn())
    vi.spyOn(console, "log").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("fetches sets and saves to DB", async () => {
    const mockJson = {
      Garchomp: {
        "Swords Dance": {
          ability: "Rough Skin",
          item: "Leftovers",
          nature: "Jolly",
          moves: ["Earthquake", "Dragon Claw", "Swords Dance", "Scale Shot"],
          evs: { atk: MAX_SINGLE_EV, spe: MAX_SINGLE_EV, spd: 4 },
        },
      },
    }

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockJson),
    })
    vi.stubGlobal("fetch", mockFetch)

    mockSetUpsert.mockResolvedValue({})
    mockSyncLogUpsert.mockResolvedValue({})

    await syncSmogonSets("gen9ou")

    expect(mockSetUpsert).toHaveBeenCalledTimes(1)
    expect(mockSyncLogUpsert).toHaveBeenCalled()
  })

  it("throws when fetch fails", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    })
    vi.stubGlobal("fetch", mockFetch)

    await expect(syncSmogonSets("gen9ou")).rejects.toThrow("Failed to fetch:")
  })

  it("handles array fields (ability, item, nature)", async () => {
    const mockJson = {
      Garchomp: {
        "Mixed Set": {
          ability: ["Rough Skin", "Sand Veil"],
          item: ["Life Orb", "Choice Scarf"],
          nature: ["Jolly", "Adamant"],
          moves: ["Earthquake", ["Dragon Claw", "Outrage"]],
          evs: { atk: MAX_SINGLE_EV, spe: MAX_SINGLE_EV, spd: 4 },
        },
      },
    }

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockJson),
    })
    vi.stubGlobal("fetch", mockFetch)

    mockSetUpsert.mockResolvedValue({})
    mockSyncLogUpsert.mockResolvedValue({})

    await syncSmogonSets("gen9ou")

    // Should take first element of arrays
    expect(mockSetUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          ability: "Rough Skin",
          item: "Life Orb",
          nature: "Jolly",
        }),
      }),
    )
  })

  it("handles teraType field", async () => {
    const mockJson = {
      Garchomp: {
        "Tera Set": {
          ability: "Rough Skin",
          item: "Leftovers",
          nature: "Jolly",
          teraType: "Fairy",
          moves: ["Earthquake"],
          evs: { atk: MAX_SINGLE_EV },
        },
      },
    }

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockJson),
    })
    vi.stubGlobal("fetch", mockFetch)

    mockSetUpsert.mockResolvedValue({})
    mockSyncLogUpsert.mockResolvedValue({})

    await syncSmogonSets("gen9ou")

    expect(mockSetUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          teraType: "Fairy",
        }),
      }),
    )
  })

  it("skips Pokemon entries with empty pokemonId", async () => {
    const mockJson = {
      "": {
        Set: {
          ability: "Levitate",
          item: "Leftovers",
          nature: "Bold",
          moves: ["Thunderbolt"],
          evs: {},
        },
      },
      Garchomp: {
        SD: {
          ability: "Rough Skin",
          item: "Leftovers",
          nature: "Jolly",
          moves: ["Earthquake"],
          evs: {},
        },
      },
    }

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockJson),
    })
    vi.stubGlobal("fetch", mockFetch)

    mockSetUpsert.mockResolvedValue({})
    mockSyncLogUpsert.mockResolvedValue({})

    await syncSmogonSets("gen9ou")

    // Only Garchomp should be saved, empty name skipped
    expect(mockSetUpsert).toHaveBeenCalledTimes(1)
  })

  it("skips non-object set data entries", async () => {
    const mockJson = {
      Garchomp: {
        SD: {
          ability: "Rough Skin",
          item: "Leftovers",
          nature: "Jolly",
          moves: ["Earthquake"],
          evs: {},
        },
        Invalid: null,
      },
    }

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockJson),
    })
    vi.stubGlobal("fetch", mockFetch)

    mockSetUpsert.mockResolvedValue({})
    mockSyncLogUpsert.mockResolvedValue({})

    await syncSmogonSets("gen9ou")

    // Only "SD" should be saved, null entry skipped
    expect(mockSetUpsert).toHaveBeenCalledTimes(1)
  })

  it("handles array EVs (firstRecord picks first element)", async () => {
    const mockJson = {
      Garchomp: {
        SD: {
          ability: "Rough Skin",
          item: "Leftovers",
          nature: "Jolly",
          moves: ["Earthquake"],
          evs: [
            { atk: MAX_SINGLE_EV, spe: MAX_SINGLE_EV },
            { hp: MAX_SINGLE_EV, def: MAX_SINGLE_EV },
          ],
        },
      },
    }

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockJson),
    })
    vi.stubGlobal("fetch", mockFetch)

    mockSetUpsert.mockResolvedValue({})
    mockSyncLogUpsert.mockResolvedValue({})

    await syncSmogonSets("gen9ou")

    expect(mockSetUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          evs: JSON.stringify({ atk: MAX_SINGLE_EV, spe: MAX_SINGLE_EV }),
        }),
      }),
    )
  })

  it("handles IVs field when present", async () => {
    const mockJson = {
      Garchomp: {
        SD: {
          ability: "Rough Skin",
          item: "Leftovers",
          nature: "Jolly",
          moves: ["Earthquake"],
          evs: { atk: MAX_SINGLE_EV },
          ivs: { atk: 0 },
        },
      },
    }

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockJson),
    })
    vi.stubGlobal("fetch", mockFetch)

    mockSetUpsert.mockResolvedValue({})
    mockSyncLogUpsert.mockResolvedValue({})

    await syncSmogonSets("gen9ou")

    expect(mockSetUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          ivs: JSON.stringify({ atk: 0 }),
        }),
      }),
    )
  })

  it("handles IVs as empty object (normalizes to null)", async () => {
    const mockJson = {
      Garchomp: {
        SD: {
          ability: "Rough Skin",
          item: "Leftovers",
          nature: "Jolly",
          moves: ["Earthquake"],
          evs: { atk: MAX_SINGLE_EV },
          ivs: {},
        },
      },
    }

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockJson),
    })
    vi.stubGlobal("fetch", mockFetch)

    mockSetUpsert.mockResolvedValue({})
    mockSyncLogUpsert.mockResolvedValue({})

    await syncSmogonSets("gen9ou")

    expect(mockSetUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          ivs: null,
        }),
      }),
    )
  })

  it("handles array IVs (firstRecord picks first element)", async () => {
    const mockJson = {
      Garchomp: {
        SD: {
          ability: "Rough Skin",
          item: "Leftovers",
          nature: "Jolly",
          moves: ["Earthquake"],
          evs: { atk: MAX_SINGLE_EV },
          ivs: [{ atk: 0 }, { spa: 0 }],
        },
      },
    }

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockJson),
    })
    vi.stubGlobal("fetch", mockFetch)

    mockSetUpsert.mockResolvedValue({})
    mockSyncLogUpsert.mockResolvedValue({})

    await syncSmogonSets("gen9ou")

    expect(mockSetUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          ivs: JSON.stringify({ atk: 0 }),
        }),
      }),
    )
  })

  it("handles teraType as array (takes first)", async () => {
    const mockJson = {
      Garchomp: {
        Tera: {
          ability: "Rough Skin",
          item: "Leftovers",
          nature: "Jolly",
          teraType: ["Fairy", "Steel"],
          moves: ["Earthquake"],
          evs: {},
        },
      },
    }

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockJson),
    })
    vi.stubGlobal("fetch", mockFetch)

    mockSetUpsert.mockResolvedValue({})
    mockSyncLogUpsert.mockResolvedValue({})

    await syncSmogonSets("gen9ou")

    expect(mockSetUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          teraType: "Fairy",
        }),
      }),
    )
  })

  it("saves multiple Pokemon and sets", async () => {
    const mockJson = {
      Garchomp: {
        SD: {
          ability: "Rough Skin",
          item: "Leftovers",
          nature: "Jolly",
          moves: ["Earthquake"],
          evs: {},
        },
        Scarf: {
          ability: "Rough Skin",
          item: "Choice Scarf",
          nature: "Jolly",
          moves: ["Earthquake"],
          evs: {},
        },
      },
      Heatran: {
        Wall: {
          ability: "Flash Fire",
          item: "Leftovers",
          nature: "Calm",
          moves: ["Lava Plume"],
          evs: {},
        },
      },
    }

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockJson),
    })
    vi.stubGlobal("fetch", mockFetch)

    mockSetUpsert.mockResolvedValue({})
    mockSyncLogUpsert.mockResolvedValue({})

    await syncSmogonSets("gen9ou")

    expect(mockSetUpsert).toHaveBeenCalledTimes(3)
  })

  it("uses pkmnSetsId option to override URL format ID", async () => {
    const mockJson = {
      Garchomp: {
        SD: {
          ability: "Rough Skin",
          item: "Leftovers",
          nature: "Jolly",
          moves: ["Earthquake"],
          evs: {},
        },
      },
    }

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockJson),
    })
    vi.stubGlobal("fetch", mockFetch)

    mockSetUpsert.mockResolvedValue({})
    mockSyncLogUpsert.mockResolvedValue({})

    await syncSmogonSets("gen9vgc2025", { pkmnSetsId: "gen9doublesou" })

    // URL should use the override ID
    expect(mockFetch).toHaveBeenCalledWith("https://data.pkmn.cc/sets/gen9doublesou.json")
    // DB should use the original format ID
    expect(mockSetUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ formatId: "gen9vgc2025" }),
      }),
    )
  })

  it("falls back to chaos sets on 404", async () => {
    const mockFetch = vi
      .fn()
      // First fetch: 404 from pkmn.cc
      .mockResolvedValueOnce({ ok: false, status: 404, statusText: "Not Found" })
      // Second fetch: chaos data from Smogon (inside fetchAndSaveChaosSets)
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            info: { metagame: "gen9vgc2025", cutoff: 1695 },
            data: {},
          }),
      })

    vi.stubGlobal("fetch", mockFetch)

    mockResolveYearMonth.mockResolvedValue({
      year: 2025,
      month: 1,
      rating: 1695,
      url: "https://www.smogon.com/stats/2025-01/chaos/gen9vgc2025-1695.json",
    })
    mockGenerateSetsFromChaos.mockReturnValue([
      {
        pokemonId: "fluttermane",
        setName: "Standard Usage",
        ability: "Protosynthesis",
        item: "Choice Specs",
        nature: "Timid",
        evs: { spa: MAX_SINGLE_EV, spe: MAX_SINGLE_EV },
        moves: ["Moonblast", "Shadow Ball", "Mystical Fire", "Dazzling Gleam"],
        teraType: "Fairy",
      },
    ])

    mockSetUpsert.mockResolvedValue({})
    mockSyncLogUpsert.mockResolvedValue({})

    await syncSmogonSets("gen9vgc2025")

    // Should have generated sets from chaos
    expect(mockGenerateSetsFromChaos).toHaveBeenCalled()
    expect(mockSetUpsert).toHaveBeenCalledTimes(1)
    expect(mockSetUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          formatId: "gen9vgc2025",
          pokemonId: "fluttermane",
          setName: "Standard Usage",
        }),
      }),
    )
  })

  it("uses smogonStatsId option in chaos fallback", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 404, statusText: "Not Found" })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ info: { metagame: "gen9vgc2026regf", cutoff: 1695 }, data: {} }),
      })
    vi.stubGlobal("fetch", mockFetch)

    mockResolveYearMonth.mockResolvedValue({
      year: 2025,
      month: 12,
      rating: 1695,
      url: "https://www.smogon.com/stats/2025-12/chaos/gen9vgc2026regf-1695.json",
    })
    mockGenerateSetsFromChaos.mockReturnValue([])
    mockSyncLogUpsert.mockResolvedValue({})

    await syncSmogonSets("gen9vgc2025", { smogonStatsId: "gen9vgc2026regf" })

    // Should use the smogonStatsId for resolveYearMonth
    expect(mockResolveYearMonth).toHaveBeenCalledWith("gen9vgc2026regf")
  })

  it("throws when chaos stats fetch also fails", async () => {
    const mockFetch = vi
      .fn()
      // 404 from pkmn.cc
      .mockResolvedValueOnce({ ok: false, status: 404, statusText: "Not Found" })
      // Chaos fetch fails too
      .mockResolvedValueOnce({ ok: false, status: 500, statusText: "Internal Server Error" })

    vi.stubGlobal("fetch", mockFetch)

    mockResolveYearMonth.mockResolvedValue({
      year: 2025,
      month: 1,
      rating: 1695,
      url: "https://www.smogon.com/stats/2025-01/chaos/gen9vgc2025-1695.json",
    })

    await expect(syncSmogonSets("gen9vgc2025")).rejects.toThrow("Failed to fetch:")
  })

  it("handles missing ability, item, nature fields gracefully", async () => {
    const mockJson = {
      Garchomp: {
        SD: {
          moves: ["Earthquake"],
          evs: {},
        },
      },
    }

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockJson),
    })
    vi.stubGlobal("fetch", mockFetch)

    mockSetUpsert.mockResolvedValue({})
    mockSyncLogUpsert.mockResolvedValue({})

    await syncSmogonSets("gen9ou")

    expect(mockSetUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          ability: "",
          item: "",
          nature: "Serious",
          teraType: null,
        }),
      }),
    )
  })
})

// ---------------------------------------------------------------------------
// getNatureUsage
// ---------------------------------------------------------------------------

describe("getNatureUsage", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns nature usage counts sorted by count descending", async () => {
    mockSetFindMany.mockResolvedValue([
      { nature: "Jolly" },
      { nature: "Jolly" },
      { nature: "Adamant" },
      { nature: "Jolly" },
      { nature: "Adamant" },
    ])

    const result = await getNatureUsage("gen9ou", "garchomp")

    expect(result).toEqual([
      { natureName: "Jolly", count: 3 },
      { natureName: "Adamant", count: 2 },
    ])
  })

  it("returns empty array when no sets exist", async () => {
    mockSetFindMany.mockResolvedValue([])

    const result = await getNatureUsage("gen9ou", "garchomp")

    expect(result).toEqual([])
  })

  it("queries with correct formatId, pokemonId, and select", async () => {
    mockSetFindMany.mockResolvedValue([])

    await getNatureUsage("gen9ou", "garchomp")

    expect(mockSetFindMany).toHaveBeenCalledWith({
      where: { formatId: "gen9ou", pokemonId: "garchomp" },
      select: { nature: true },
    })
  })

  it("handles a single nature", async () => {
    mockSetFindMany.mockResolvedValue([{ nature: "Bold" }])

    const result = await getNatureUsage("gen9ou", "clefable")

    expect(result).toEqual([{ natureName: "Bold", count: 1 }])
  })
})

// ---------------------------------------------------------------------------
// rowToSetData (tested indirectly through getSetsForPokemon)
// ---------------------------------------------------------------------------

describe("rowToSetData malformed JSON handling", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns empty moves array for malformed moves JSON", async () => {
    mockSetFindMany.mockResolvedValue([makeDbSetRow({ moves: "not-valid-json{" })])

    const result = await getSetsForPokemon("gen9ou", "garchomp")

    expect(result[0].moves).toEqual([])
  })

  it("returns empty evs object for malformed evs JSON", async () => {
    mockSetFindMany.mockResolvedValue([makeDbSetRow({ evs: "invalid{json" })])

    const result = await getSetsForPokemon("gen9ou", "garchomp")

    expect(result[0].evs).toEqual({})
  })

  it("returns undefined ivs for malformed ivs JSON", async () => {
    mockSetFindMany.mockResolvedValue([makeDbSetRow({ ivs: "not-json" })])

    const result = await getSetsForPokemon("gen9ou", "garchomp")

    expect(result[0].ivs).toBeUndefined()
  })

  it("maps teraType undefined when null", async () => {
    mockSetFindMany.mockResolvedValue([makeDbSetRow({ teraType: null })])

    const result = await getSetsForPokemon("gen9ou", "garchomp")

    expect(result[0].teraType).toBeUndefined()
  })
})
