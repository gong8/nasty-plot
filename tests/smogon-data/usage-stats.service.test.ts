import { fetchUsageStats, getUsageStats, getUsageStatsCount, getTopPokemon, getTeammates } from "@nasty-plot/smogon-data";

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
}));

import { prisma } from "@nasty-plot/db";

const mockUsageUpsert = prisma.usageStats.upsert as ReturnType<typeof vi.fn>;
const mockUsageFindMany = prisma.usageStats.findMany as ReturnType<typeof vi.fn>;
const mockUsageCount = prisma.usageStats.count as ReturnType<typeof vi.fn>;
const mockTeammateCorrUpsert = prisma.teammateCorr.upsert as ReturnType<typeof vi.fn>;
const mockTeammateCorrFindMany = prisma.teammateCorr.findMany as ReturnType<typeof vi.fn>;
const mockCheckCounterUpsert = prisma.checkCounter.upsert as ReturnType<typeof vi.fn>;
const mockSyncLogUpsert = prisma.dataSyncLog.upsert as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getUsageStats", () => {
  beforeEach(() => vi.clearAllMocks());

  it("queries by formatId with default limit and page", async () => {
    mockUsageFindMany.mockResolvedValue([]);

    await getUsageStats("gen9ou");

    expect(mockUsageFindMany).toHaveBeenCalledWith({
      where: { formatId: "gen9ou" },
      orderBy: { rank: "asc" },
      take: 50,
      skip: 0,
    });
  });

  it("respects custom limit and page", async () => {
    mockUsageFindMany.mockResolvedValue([]);

    await getUsageStats("gen9ou", { limit: 10, page: 3 });

    expect(mockUsageFindMany).toHaveBeenCalledWith({
      where: { formatId: "gen9ou" },
      orderBy: { rank: "asc" },
      take: 10,
      skip: 20,
    });
  });

  it("maps rows to UsageStatsEntry", async () => {
    mockUsageFindMany.mockResolvedValue([
      { pokemonId: "garchomp", usagePercent: 25.5, rank: 1 },
      { pokemonId: "heatran", usagePercent: 20.3, rank: 2 },
    ]);

    const result = await getUsageStats("gen9ou");

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      pokemonId: "garchomp",
      usagePercent: 25.5,
      rank: 1,
    });
  });

  it("returns empty array when no data", async () => {
    mockUsageFindMany.mockResolvedValue([]);

    const result = await getUsageStats("gen9ou");

    expect(result).toEqual([]);
  });
});

describe("getUsageStatsCount", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns count for format", async () => {
    mockUsageCount.mockResolvedValue(150);

    const result = await getUsageStatsCount("gen9ou");

    expect(result).toBe(150);
    expect(mockUsageCount).toHaveBeenCalledWith({
      where: { formatId: "gen9ou" },
    });
  });
});

describe("getTopPokemon", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns top N Pokemon", async () => {
    mockUsageFindMany.mockResolvedValue([
      { pokemonId: "garchomp", usagePercent: 25, rank: 1 },
      { pokemonId: "heatran", usagePercent: 20, rank: 2 },
    ]);

    const result = await getTopPokemon("gen9ou", 2);

    expect(result).toHaveLength(2);
    expect(mockUsageFindMany).toHaveBeenCalledWith({
      where: { formatId: "gen9ou" },
      orderBy: { rank: "asc" },
      take: 2,
    });
  });
});

describe("getTeammates", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns teammate correlations", async () => {
    mockTeammateCorrFindMany.mockResolvedValue([
      { pokemonBId: "heatran", correlationPercent: 30 },
      { pokemonBId: "clefable", correlationPercent: 25 },
    ]);

    const result = await getTeammates("gen9ou", "garchomp");

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      pokemonId: "heatran",
      correlationPercent: 30,
    });
  });

  it("uses default limit of 20", async () => {
    mockTeammateCorrFindMany.mockResolvedValue([]);

    await getTeammates("gen9ou", "garchomp");

    expect(mockTeammateCorrFindMany).toHaveBeenCalledWith({
      where: { formatId: "gen9ou", pokemonAId: "garchomp" },
      orderBy: { correlationPercent: "desc" },
      take: 20,
    });
  });

  it("respects custom limit", async () => {
    mockTeammateCorrFindMany.mockResolvedValue([]);

    await getTeammates("gen9ou", "garchomp", 5);

    expect(mockTeammateCorrFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5 })
    );
  });
});

describe("fetchUsageStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

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
    };

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
      });
    vi.stubGlobal("fetch", mockFetch);

    mockUsageUpsert.mockResolvedValue({});
    mockTeammateCorrUpsert.mockResolvedValue({});
    mockSyncLogUpsert.mockResolvedValue({});

    await fetchUsageStats("gen9ou", 2024, 6);

    expect(mockUsageUpsert).toHaveBeenCalled();
    expect(mockSyncLogUpsert).toHaveBeenCalled();
  });

  it("throws when fetch fails", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
    });
    vi.stubGlobal("fetch", mockFetch);

    await expect(fetchUsageStats("gen9ou", 2024, 6)).rejects.toThrow(
      "Failed to fetch usage stats"
    );
  });

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
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    });
    vi.stubGlobal("fetch", mockFetch);

    mockUsageUpsert.mockResolvedValue({});
    mockTeammateCorrUpsert.mockResolvedValue({});
    mockSyncLogUpsert.mockResolvedValue({});

    await fetchUsageStats("gen9ou", 2024, 6);

    expect(mockTeammateCorrUpsert).toHaveBeenCalledTimes(2);
  });

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
            "Clefable": [35.5, 20.3],
          },
        },
      },
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    });
    vi.stubGlobal("fetch", mockFetch);

    mockUsageUpsert.mockResolvedValue({});
    mockCheckCounterUpsert.mockResolvedValue({});
    mockSyncLogUpsert.mockResolvedValue({});

    await fetchUsageStats("gen9ou", 2024, 6);

    expect(mockCheckCounterUpsert).toHaveBeenCalled();
  });

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
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    });
    vi.stubGlobal("fetch", mockFetch);

    mockUsageUpsert.mockResolvedValue({});
    mockTeammateCorrUpsert.mockResolvedValue({});
    mockSyncLogUpsert.mockResolvedValue({});

    await fetchUsageStats("gen9ou", 2024, 6);

    // Only Landorus (0.1 > 0) should be saved
    expect(mockTeammateCorrUpsert).toHaveBeenCalledTimes(1);
  });

  it("ranks Pokemon by usage descending", async () => {
    const mockData = {
      info: { metagame: "gen9ou", cutoff: 1695 },
      data: {
        Heatran: {
          usage: 0.10,
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
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    });
    vi.stubGlobal("fetch", mockFetch);

    mockUsageUpsert.mockResolvedValue({});
    mockSyncLogUpsert.mockResolvedValue({});

    await fetchUsageStats("gen9ou", 2024, 6);

    // Garchomp (0.25) should be rank 1, Heatran (0.10) rank 2
    expect(mockUsageUpsert).toHaveBeenCalledTimes(2);
    expect(mockUsageUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ pokemonId: "garchomp", rank: 1 }),
      })
    );
    expect(mockUsageUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ pokemonId: "heatran", rank: 2 }),
      })
    );
  });

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
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    });
    vi.stubGlobal("fetch", mockFetch);

    mockUsageUpsert.mockResolvedValue({});
    mockSyncLogUpsert.mockResolvedValue({});

    await fetchUsageStats("gen9ou", 2024, 6);

    expect(mockUsageUpsert).toHaveBeenCalledTimes(1);
    expect(mockTeammateCorrUpsert).not.toHaveBeenCalled();
    expect(mockCheckCounterUpsert).not.toHaveBeenCalled();
  });
});

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
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 5, 15)); // June 15, 2024
    mockUsageUpsert.mockResolvedValue({});
    mockSyncLogUpsert.mockResolvedValue({});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("probes HEAD requests starting from previous month when year/month omitted", async () => {
    const mockFetch = vi.fn()
      // HEAD for May 2024 (offset=1) -> ok
      .mockResolvedValueOnce({ ok: true })
      // GET for the actual data
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockChaosData),
      });
    vi.stubGlobal("fetch", mockFetch);

    await fetchUsageStats("gen9ou");

    // First call should be a HEAD request for May 2024
    expect(mockFetch).toHaveBeenCalledWith(
      "https://www.smogon.com/stats/2024-05/chaos/gen9ou-1695.json",
      { method: "HEAD" }
    );
    // Second call should be GET for the same URL
    expect(mockFetch).toHaveBeenCalledWith(
      "https://www.smogon.com/stats/2024-05/chaos/gen9ou-1695.json"
    );
  });

  it("falls back to earlier months when HEAD returns non-ok", async () => {
    const mockFetch = vi.fn()
      // HEAD for May 2024 (offset=1) -> not ok
      .mockResolvedValueOnce({ ok: false })
      // HEAD for April 2024 (offset=2) -> ok
      .mockResolvedValueOnce({ ok: true })
      // GET for the actual data (April 2024)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockChaosData),
      });
    vi.stubGlobal("fetch", mockFetch);

    await fetchUsageStats("gen9ou");

    // Should have tried May first, then April
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      "https://www.smogon.com/stats/2024-05/chaos/gen9ou-1695.json",
      { method: "HEAD" }
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      "https://www.smogon.com/stats/2024-04/chaos/gen9ou-1695.json",
      { method: "HEAD" }
    );
    // Third call is the actual GET for April
    expect(mockFetch).toHaveBeenNthCalledWith(
      3,
      "https://www.smogon.com/stats/2024-04/chaos/gen9ou-1695.json"
    );
  });

  it("falls back to first candidate when all HEAD requests fail with non-ok", async () => {
    const mockFetch = vi.fn()
      // All 6 HEAD requests return non-ok
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: false })
      // GET for fallback (May 2024, the first candidate)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockChaosData),
      });
    vi.stubGlobal("fetch", mockFetch);

    await fetchUsageStats("gen9ou");

    // Should have tried all 6 offsets, then fell back to first candidate (May)
    expect(mockFetch).toHaveBeenCalledTimes(7); // 6 HEAD + 1 GET
    // The final GET should be for May 2024 (first candidate / fallback)
    expect(mockFetch).toHaveBeenLastCalledWith(
      "https://www.smogon.com/stats/2024-05/chaos/gen9ou-1695.json"
    );
  });

  it("handles network errors during HEAD requests and tries next month", async () => {
    const mockFetch = vi.fn()
      // HEAD for May 2024 -> network error
      .mockRejectedValueOnce(new Error("Network error"))
      // HEAD for April 2024 -> ok
      .mockResolvedValueOnce({ ok: true })
      // GET for April 2024
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockChaosData),
      });
    vi.stubGlobal("fetch", mockFetch);

    await fetchUsageStats("gen9ou");

    // Should have caught the error and tried April
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      "https://www.smogon.com/stats/2024-04/chaos/gen9ou-1695.json",
      { method: "HEAD" }
    );
  });

  it("falls back to first candidate when all HEAD requests throw network errors", async () => {
    const mockFetch = vi.fn()
      // All 6 HEAD requests throw errors
      .mockRejectedValueOnce(new Error("Network error"))
      .mockRejectedValueOnce(new Error("Network error"))
      .mockRejectedValueOnce(new Error("Network error"))
      .mockRejectedValueOnce(new Error("Network error"))
      .mockRejectedValueOnce(new Error("Network error"))
      .mockRejectedValueOnce(new Error("Network error"))
      // GET fallback for May 2024
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockChaosData),
      });
    vi.stubGlobal("fetch", mockFetch);

    await fetchUsageStats("gen9ou");

    expect(mockFetch).toHaveBeenCalledTimes(7);
    // Fallback GET should be May 2024
    expect(mockFetch).toHaveBeenLastCalledWith(
      "https://www.smogon.com/stats/2024-05/chaos/gen9ou-1695.json"
    );
  });

  it("correctly handles year boundary when current month is January", async () => {
    // Set time to January 15, 2025
    vi.setSystemTime(new Date(2025, 0, 15));

    const mockFetch = vi.fn()
      // HEAD for December 2024 (offset=1 from January) -> ok
      .mockResolvedValueOnce({ ok: true })
      // GET for December 2024
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockChaosData),
      });
    vi.stubGlobal("fetch", mockFetch);

    await fetchUsageStats("gen9ou");

    // Should correctly wrap to December of previous year
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      "https://www.smogon.com/stats/2024-12/chaos/gen9ou-1695.json",
      { method: "HEAD" }
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      "https://www.smogon.com/stats/2024-12/chaos/gen9ou-1695.json"
    );
  });

  it("tries up to 6 previous months", async () => {
    // Set time to July 15, 2024
    vi.setSystemTime(new Date(2024, 6, 15));

    const mockFetch = vi.fn()
      // All HEAD requests fail
      .mockResolvedValue({ ok: false });
    vi.stubGlobal("fetch", mockFetch);

    // Override the last call to return actual data for the GET
    mockFetch.mockResolvedValueOnce({ ok: false }) // Jun
      .mockResolvedValueOnce({ ok: false })        // May
      .mockResolvedValueOnce({ ok: false })        // Apr
      .mockResolvedValueOnce({ ok: false })        // Mar
      .mockResolvedValueOnce({ ok: false })        // Feb
      .mockResolvedValueOnce({ ok: false })        // Jan
      .mockResolvedValueOnce({                     // GET fallback
        ok: true,
        json: () => Promise.resolve(mockChaosData),
      });
    vi.stubGlobal("fetch", mockFetch);

    await fetchUsageStats("gen9ou");

    // 6 HEAD requests + 1 GET = 7 total
    expect(mockFetch).toHaveBeenCalledTimes(7);

    // Verify the 6 months tried (Jun, May, Apr, Mar, Feb, Jan 2024)
    const headCalls = mockFetch.mock.calls.slice(0, 6);
    const months = headCalls.map((call: [string, { method: string }]) => call[0]);
    expect(months).toEqual([
      "https://www.smogon.com/stats/2024-06/chaos/gen9ou-1695.json",
      "https://www.smogon.com/stats/2024-05/chaos/gen9ou-1695.json",
      "https://www.smogon.com/stats/2024-04/chaos/gen9ou-1695.json",
      "https://www.smogon.com/stats/2024-03/chaos/gen9ou-1695.json",
      "https://www.smogon.com/stats/2024-02/chaos/gen9ou-1695.json",
      "https://www.smogon.com/stats/2024-01/chaos/gen9ou-1695.json",
    ]);
  });
});
