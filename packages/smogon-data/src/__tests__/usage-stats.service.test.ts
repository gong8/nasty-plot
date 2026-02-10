import { fetchUsageStats, getUsageStats, getUsageStatsCount, getTopPokemon, getTeammates } from "../usage-stats.service";

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
      .mockResolvedValueOnce({ ok: true }) // HEAD check for resolveYearMonth
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
});
