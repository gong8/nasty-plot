import {
  fetchUsageStats,
  getUsageStats,
  getUsageStatsCount,
  getTopPokemon,
  getTeammates,
} from "@nasty-plot/smogon-data"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@nasty-plot/db", () => ({
  prisma: {
    usageStats: {
      upsert: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    teammateCorr: {
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
    checkCounter: {
      upsert: vi.fn(),
    },
    dataSyncLog: {
      upsert: vi.fn(),
    },
  },
}))

import { prisma } from "@nasty-plot/db"

const mockUsageUpsert = prisma.usageStats.upsert as ReturnType<typeof vi.fn>
const mockUsageFindMany = prisma.usageStats.findMany as ReturnType<typeof vi.fn>
const mockUsageCount = prisma.usageStats.count as ReturnType<typeof vi.fn>
const mockTeammateCorrUpsert = prisma.teammateCorr.upsert as ReturnType<typeof vi.fn>
const mockTeammateCorrFindMany = prisma.teammateCorr.findMany as ReturnType<typeof vi.fn>
const mockCheckCounterUpsert = prisma.checkCounter.upsert as ReturnType<typeof vi.fn>
const mockSyncLogUpsert = prisma.dataSyncLog.upsert as ReturnType<typeof vi.fn>

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getUsageStats", () => {
  beforeEach(() => vi.clearAllMocks())

  it("queries by formatId with default limit and page", async () => {
    mockUsageFindMany.mockResolvedValue([])

    await getUsageStats("gen9ou")

    expect(mockUsageFindMany).toHaveBeenCalledWith({
      where: { formatId: "gen9ou" },
      orderBy: { rank: "asc" },
      take: 50,
      skip: 0,
    })
  })

  it("respects custom limit and page", async () => {
    mockUsageFindMany.mockResolvedValue([])

    await getUsageStats("gen9ou", { limit: 10, page: 3 })

    expect(mockUsageFindMany).toHaveBeenCalledWith({
      where: { formatId: "gen9ou" },
      orderBy: { rank: "asc" },
      take: 10,
      skip: 20,
    })
  })

  it("maps rows to UsageStatsEntry", async () => {
    mockUsageFindMany.mockResolvedValue([
      { pokemonId: "garchomp", usagePercent: 25.5, rank: 1 },
      { pokemonId: "heatran", usagePercent: 20.3, rank: 2 },
    ])

    const result = await getUsageStats("gen9ou")

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      pokemonId: "garchomp",
      usagePercent: 25.5,
      rank: 1,
    })
  })

  it("returns empty array when no data", async () => {
    mockUsageFindMany.mockResolvedValue([])

    const result = await getUsageStats("gen9ou")

    expect(result).toEqual([])
  })
})

describe("getUsageStatsCount", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns count for format", async () => {
    mockUsageCount.mockResolvedValue(150)

    const result = await getUsageStatsCount("gen9ou")

    expect(result).toBe(150)
    expect(mockUsageCount).toHaveBeenCalledWith({
      where: { formatId: "gen9ou" },
    })
  })
})

describe("getTopPokemon", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns top N Pokemon", async () => {
    mockUsageFindMany.mockResolvedValue([
      { pokemonId: "garchomp", usagePercent: 25, rank: 1 },
      { pokemonId: "heatran", usagePercent: 20, rank: 2 },
    ])

    const result = await getTopPokemon("gen9ou", 2)

    expect(result).toHaveLength(2)
    expect(mockUsageFindMany).toHaveBeenCalledWith({
      where: { formatId: "gen9ou" },
      orderBy: { rank: "asc" },
      take: 2,
    })
  })
})

describe("getTeammates", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns teammate correlations", async () => {
    mockTeammateCorrFindMany.mockResolvedValue([
      { pokemonBId: "heatran", correlationPercent: 30 },
      { pokemonBId: "clefable", correlationPercent: 25 },
    ])

    const result = await getTeammates("gen9ou", "garchomp")

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      pokemonId: "heatran",
      correlationPercent: 30,
    })
  })

  it("uses default limit of 20", async () => {
    mockTeammateCorrFindMany.mockResolvedValue([])

    await getTeammates("gen9ou", "garchomp")

    expect(mockTeammateCorrFindMany).toHaveBeenCalledWith({
      where: { formatId: "gen9ou", pokemonAId: "garchomp" },
      orderBy: { correlationPercent: "desc" },
      take: 20,
    })
  })

  it("respects custom limit", async () => {
    mockTeammateCorrFindMany.mockResolvedValue([])

    await getTeammates("gen9ou", "garchomp", 5)

    expect(mockTeammateCorrFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 5 }))
  })
})

describe("fetchUsageStats", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("fetch", vi.fn())
    vi.spyOn(console, "log").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("fetches from Smogon and saves to DB", async () => {
    const mockData = {
      info: { metagame: "gen9ou", cutoff: 1695 },
      data: {
        Garchomp: {
          usage: 0.25,
          "Raw count": 1000,
          Abilities: {},
          Items: {},
          Moves: {},
          Teammates: { Heatran: 0.15 },
          "Checks and Counters": {},
        },
      },
    }

    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockData),
    })
    vi.stubGlobal("fetch", mockFetch)

    mockUsageUpsert.mockResolvedValue({})
    mockTeammateCorrUpsert.mockResolvedValue({})
    mockSyncLogUpsert.mockResolvedValue({})

    await fetchUsageStats("gen9ou", { year: 2024, month: 6 })

    expect(mockUsageUpsert).toHaveBeenCalled()
    expect(mockSyncLogUpsert).toHaveBeenCalled()
  })

  it("throws when fetch fails", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
    })
    vi.stubGlobal("fetch", mockFetch)

    await expect(fetchUsageStats("gen9ou", { year: 2024, month: 6 })).rejects.toThrow(
      "Failed to fetch usage stats",
    )
  })

  it("saves teammate correlations", async () => {
    const mockData = {
      info: { metagame: "gen9ou", cutoff: 1695 },
      data: {
        Garchomp: {
          usage: 0.25,
          "Raw count": 1000,
          Abilities: {},
          Items: {},
          Moves: {},
          Teammates: { Heatran: 0.15, Clefable: 0.1 },
          "Checks and Counters": {},
        },
      },
    }

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    })
    vi.stubGlobal("fetch", mockFetch)

    mockUsageUpsert.mockResolvedValue({})
    mockTeammateCorrUpsert.mockResolvedValue({})
    mockSyncLogUpsert.mockResolvedValue({})

    await fetchUsageStats("gen9ou", { year: 2024, month: 6 })

    expect(mockTeammateCorrUpsert).toHaveBeenCalledTimes(2)
  })

  it("saves checks and counters", async () => {
    const mockData = {
      info: { metagame: "gen9ou", cutoff: 1695 },
      data: {
        Garchomp: {
          usage: 0.25,
          "Raw count": 1000,
          Abilities: {},
          Items: {},
          Moves: {},
          Teammates: {},
          "Checks and Counters": {
            Clefable: [35.5, 20.3],
          },
        },
      },
    }

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    })
    vi.stubGlobal("fetch", mockFetch)

    mockUsageUpsert.mockResolvedValue({})
    mockCheckCounterUpsert.mockResolvedValue({})
    mockSyncLogUpsert.mockResolvedValue({})

    await fetchUsageStats("gen9ou", { year: 2024, month: 6 })

    expect(mockCheckCounterUpsert).toHaveBeenCalled()
  })

  it("skips teammates with zero or negative correlation", async () => {
    const mockData = {
      info: { metagame: "gen9ou", cutoff: 1695 },
      data: {
        Garchomp: {
          usage: 0.25,
          "Raw count": 1000,
          Abilities: {},
          Items: {},
          Moves: {},
          Teammates: { Heatran: 0, Clefable: -0.5, Landorus: 0.1 },
          "Checks and Counters": {},
        },
      },
    }

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    })
    vi.stubGlobal("fetch", mockFetch)

    mockUsageUpsert.mockResolvedValue({})
    mockTeammateCorrUpsert.mockResolvedValue({})
    mockSyncLogUpsert.mockResolvedValue({})

    await fetchUsageStats("gen9ou", { year: 2024, month: 6 })

    // Only Landorus (0.1 > 0) should be saved
    expect(mockTeammateCorrUpsert).toHaveBeenCalledTimes(1)
  })

  it("ranks Pokemon by usage descending", async () => {
    const mockData = {
      info: { metagame: "gen9ou", cutoff: 1695 },
      data: {
        Heatran: {
          usage: 0.1,
          "Raw count": 500,
          Abilities: {},
          Items: {},
          Moves: {},
          Teammates: {},
          "Checks and Counters": {},
        },
        Garchomp: {
          usage: 0.25,
          "Raw count": 1000,
          Abilities: {},
          Items: {},
          Moves: {},
          Teammates: {},
          "Checks and Counters": {},
        },
      },
    }

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    })
    vi.stubGlobal("fetch", mockFetch)

    mockUsageUpsert.mockResolvedValue({})
    mockSyncLogUpsert.mockResolvedValue({})

    await fetchUsageStats("gen9ou", { year: 2024, month: 6 })

    // Garchomp (0.25) should be rank 1, Heatran (0.10) rank 2
    expect(mockUsageUpsert).toHaveBeenCalledTimes(2)
    expect(mockUsageUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ pokemonId: "garchomp", rank: 1 }),
      }),
    )
    expect(mockUsageUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ pokemonId: "heatran", rank: 2 }),
      }),
    )
  })

  it("handles missing Teammates and Checks and Counters fields", async () => {
    const mockData = {
      info: { metagame: "gen9ou", cutoff: 1695 },
      data: {
        Garchomp: {
          usage: 0.25,
          "Raw count": 1000,
          Abilities: {},
          Items: {},
          Moves: {},
        },
      },
    }

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    })
    vi.stubGlobal("fetch", mockFetch)

    mockUsageUpsert.mockResolvedValue({})
    mockSyncLogUpsert.mockResolvedValue({})

    await fetchUsageStats("gen9ou", { year: 2024, month: 6 })

    expect(mockUsageUpsert).toHaveBeenCalledTimes(1)
    expect(mockTeammateCorrUpsert).not.toHaveBeenCalled()
    expect(mockCheckCounterUpsert).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// resolveYearMonth (tested indirectly through fetchUsageStats)
// ---------------------------------------------------------------------------

describe("fetchUsageStats auto-detection (resolveYearMonth)", () => {
  const mockChaosData = {
    info: { metagame: "gen9ou", cutoff: 1695 },
    data: {
      Garchomp: {
        usage: 0.25,
        "Raw count": 1000,
        Abilities: {},
        Items: {},
        Moves: {},
        Teammates: {},
        "Checks and Counters": {},
      },
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("fetch", vi.fn())
    vi.spyOn(console, "log").mockImplementation(() => {})
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2024, 5, 15)) // June 15, 2024
    mockUsageUpsert.mockResolvedValue({})
    mockSyncLogUpsert.mockResolvedValue({})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("probes HEAD requests starting from previous month at highest rating when year/month omitted", async () => {
    const mockFetch = vi
      .fn()
      // HEAD for May 2024 at 1695 -> ok
      .mockResolvedValueOnce({ ok: true })
      // GET for the actual data
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockChaosData),
      })
    vi.stubGlobal("fetch", mockFetch)

    await fetchUsageStats("gen9ou")

    // First call should be a HEAD request for May 2024 at 1695
    expect(mockFetch).toHaveBeenCalledWith(
      "https://www.smogon.com/stats/2024-05/chaos/gen9ou-1695.json",
      { method: "HEAD" },
    )
    // Second call should be GET for the same URL
    expect(mockFetch).toHaveBeenCalledWith(
      "https://www.smogon.com/stats/2024-05/chaos/gen9ou-1695.json",
    )
  })

  it("falls back to lower rating when higher ratings return non-ok", async () => {
    const mockFetch = vi
      .fn()
      // HEAD for May 2024 at 1695 -> not ok
      .mockResolvedValueOnce({ ok: false })
      // HEAD for May 2024 at 1630 -> ok
      .mockResolvedValueOnce({ ok: true })
      // GET for the actual data (May 2024 at 1630)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockChaosData),
      })
    vi.stubGlobal("fetch", mockFetch)

    await fetchUsageStats("gen9ou")

    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      "https://www.smogon.com/stats/2024-05/chaos/gen9ou-1695.json",
      { method: "HEAD" },
    )
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      "https://www.smogon.com/stats/2024-05/chaos/gen9ou-1630.json",
      { method: "HEAD" },
    )
    expect(mockFetch).toHaveBeenNthCalledWith(
      3,
      "https://www.smogon.com/stats/2024-05/chaos/gen9ou-1630.json",
    )
  })

  it("throws when all HEAD requests fail with non-ok", async () => {
    // 6 months × 4 ratings = 24 HEAD requests, all fail
    const mockFetch = vi.fn().mockResolvedValue({ ok: false })
    vi.stubGlobal("fetch", mockFetch)

    await expect(fetchUsageStats("gen9ou")).rejects.toThrow("No Smogon stats found for gen9ou")

    // Should have tried all 24 combinations
    expect(mockFetch).toHaveBeenCalledTimes(24)
  })

  it("handles network errors during HEAD requests and tries next rating", async () => {
    const mockFetch = vi
      .fn()
      // HEAD for May 2024 at 1695 -> network error
      .mockRejectedValueOnce(new Error("Network error"))
      // HEAD for May 2024 at 1630 -> ok
      .mockResolvedValueOnce({ ok: true })
      // GET for May 2024 at 1630
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockChaosData),
      })
    vi.stubGlobal("fetch", mockFetch)

    await fetchUsageStats("gen9ou")

    expect(mockFetch).toHaveBeenCalledTimes(3)
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      "https://www.smogon.com/stats/2024-05/chaos/gen9ou-1630.json",
      { method: "HEAD" },
    )
  })

  it("throws when all HEAD requests throw network errors", async () => {
    // 24 HEAD requests all throw
    const mockFetch = vi.fn()
    for (let i = 0; i < 24; i++) {
      mockFetch.mockRejectedValueOnce(new Error("Network error"))
    }
    vi.stubGlobal("fetch", mockFetch)

    await expect(fetchUsageStats("gen9ou")).rejects.toThrow("No Smogon stats found for gen9ou")

    expect(mockFetch).toHaveBeenCalledTimes(24)
  })

  it("correctly handles year boundary when current month is January", async () => {
    // Set time to January 15, 2025
    vi.setSystemTime(new Date(2025, 0, 15))

    const mockFetch = vi
      .fn()
      // HEAD for December 2024 at 1695 -> ok
      .mockResolvedValueOnce({ ok: true })
      // GET for December 2024
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockChaosData),
      })
    vi.stubGlobal("fetch", mockFetch)

    await fetchUsageStats("gen9ou")

    // Should correctly wrap to December of previous year
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      "https://www.smogon.com/stats/2024-12/chaos/gen9ou-1695.json",
      { method: "HEAD" },
    )
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      "https://www.smogon.com/stats/2024-12/chaos/gen9ou-1695.json",
    )
  })

  it("tries all 6 months × 4 ratings before throwing", async () => {
    // Set time to July 15, 2024
    vi.setSystemTime(new Date(2024, 6, 15))

    // All 24 HEAD requests fail
    const mockFetch = vi.fn()
    for (let i = 0; i < 24; i++) {
      mockFetch.mockResolvedValueOnce({ ok: false })
    }
    vi.stubGlobal("fetch", mockFetch)

    await expect(fetchUsageStats("gen9ou")).rejects.toThrow(
      "No Smogon stats found for gen9ou in the last 6 months",
    )

    // 6 months × 4 ratings = 24 HEAD requests, no GET fallback
    expect(mockFetch).toHaveBeenCalledTimes(24)

    // First 4 calls should be Jun 2024 at different ratings
    const headCalls = mockFetch.mock.calls.slice(0, 4)
    const urls = headCalls.map((call: [string, { method: string }]) => call[0])
    expect(urls).toEqual([
      "https://www.smogon.com/stats/2024-06/chaos/gen9ou-1695.json",
      "https://www.smogon.com/stats/2024-06/chaos/gen9ou-1630.json",
      "https://www.smogon.com/stats/2024-06/chaos/gen9ou-1500.json",
      "https://www.smogon.com/stats/2024-06/chaos/gen9ou-0.json",
    ])
  })
})
