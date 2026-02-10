import {
  fetchUsageStats,
  getUsageStats,
  getUsageStatsCount,
  getTopPokemon,
  getTeammates,
} from "./usage-stats.service";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/shared/services/prisma", () => ({
  prisma: {
    dataSyncLog: { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn() },
    usageStats: { upsert: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    smogonSet: { upsert: vi.fn(), findMany: vi.fn() },
    teammateCorr: { upsert: vi.fn(), findMany: vi.fn() },
    checkCounter: { upsert: vi.fn() },
  },
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { prisma } from "@/shared/services/prisma";
const mockedPrisma = vi.mocked(prisma, true);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeChaosJson(
  entries: Record<
    string,
    {
      usage: number;
      rawCount?: number;
      teammates?: Record<string, number>;
      counters?: Record<string, [number, number]>;
    }
  >
) {
  const data: Record<string, any> = {};
  for (const [name, info] of Object.entries(entries)) {
    data[name] = {
      usage: info.usage,
      "Raw count": info.rawCount ?? 100,
      Abilities: {},
      Items: {},
      Moves: {},
      Teammates: info.teammates ?? {},
      "Checks and Counters": info.counters ?? {},
    };
  }
  return { info: { metagame: "gen9ou", cutoff: 1695 }, data };
}

// ---------------------------------------------------------------------------
// fetchUsageStats
// ---------------------------------------------------------------------------

describe("fetchUsageStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedPrisma.usageStats.upsert.mockResolvedValue({} as any);
    mockedPrisma.teammateCorr.upsert.mockResolvedValue({} as any);
    mockedPrisma.checkCounter.upsert.mockResolvedValue({} as any);
    mockedPrisma.dataSyncLog.upsert.mockResolvedValue({} as any);
  });

  it("fetches stats with explicit year/month and persists to DB", async () => {
    const json = makeChaosJson({
      Garchomp: { usage: 0.35 },
      Heatran: { usage: 0.20 },
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => json,
    });

    await fetchUsageStats("gen9ou", 2025, 1);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://www.smogon.com/stats/2025-01/chaos/gen9ou-1695.json"
    );

    // 2 Pokemon => 2 usageStats upserts
    expect(mockedPrisma.usageStats.upsert).toHaveBeenCalledTimes(2);

    // Garchomp should be rank 1 (higher usage)
    const firstCall = mockedPrisma.usageStats.upsert.mock.calls[0][0];
    expect(firstCall.create.pokemonId).toBe("garchomp");
    expect(firstCall.create.rank).toBe(1);
    expect(firstCall.create.usagePercent).toBe(0.35);
    expect(firstCall.create.year).toBe(2025);
    expect(firstCall.create.month).toBe(1);

    // Heatran should be rank 2
    const secondCall = mockedPrisma.usageStats.upsert.mock.calls[1][0];
    expect(secondCall.create.pokemonId).toBe("heatran");
    expect(secondCall.create.rank).toBe(2);

    // Sync log should be updated
    expect(mockedPrisma.dataSyncLog.upsert).toHaveBeenCalledTimes(1);
    const syncCall = mockedPrisma.dataSyncLog.upsert.mock.calls[0][0];
    expect(syncCall.create.source).toBe("smogon-stats");
    expect(syncCall.create.status).toBe("success");
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeChaosJson({}),
    });
    // When no year/month provided, resolveYearMonth does HEAD requests first
    // The first HEAD that succeeds returns that month. Then the actual GET follows.
    // Let's provide explicit year/month to simplify:
    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    await expect(fetchUsageStats("gen9ou", 2025, 1)).rejects.toThrow(
      "Failed to fetch usage stats: 500 Internal Server Error"
    );
  });

  it("saves teammate correlations (positive values only)", async () => {
    const json = makeChaosJson({
      Garchomp: {
        usage: 0.35,
        teammates: {
          Heatran: 0.15,
          Clefable: -0.05, // negative - should be skipped
          "": 0.1,         // empty id - should be skipped
        },
      },
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => json,
    });

    await fetchUsageStats("gen9ou", 2025, 1);

    // Only Heatran should be upserted (positive value, non-empty id)
    expect(mockedPrisma.teammateCorr.upsert).toHaveBeenCalledTimes(1);
    const call = mockedPrisma.teammateCorr.upsert.mock.calls[0][0];
    expect(call.create.pokemonAId).toBe("garchomp");
    expect(call.create.pokemonBId).toBe("heatran");
    expect(call.create.correlationPercent).toBe(0.15);
  });

  it("saves checks and counters data", async () => {
    const json = makeChaosJson({
      Garchomp: {
        usage: 0.35,
        counters: {
          Clefable: [55.2, 30.1],
        },
      },
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => json,
    });

    await fetchUsageStats("gen9ou", 2025, 1);

    expect(mockedPrisma.checkCounter.upsert).toHaveBeenCalledTimes(1);
    const call = mockedPrisma.checkCounter.upsert.mock.calls[0][0];
    expect(call.create.targetId).toBe("garchomp");
    expect(call.create.counterId).toBe("clefable");
    expect(call.create.koPercent).toBe(55.2);
    expect(call.create.switchPercent).toBe(30.1);
  });

  it("skips counters with empty counterId", async () => {
    const json = makeChaosJson({
      Garchomp: {
        usage: 0.35,
        counters: {
          "": [10, 20],
        },
      },
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => json,
    });

    await fetchUsageStats("gen9ou", 2025, 1);

    expect(mockedPrisma.checkCounter.upsert).not.toHaveBeenCalled();
  });

  it("handles missing Teammates/Counters gracefully", async () => {
    // Build data without Teammates or Checks and Counters
    const rawData = {
      info: { metagame: "gen9ou", cutoff: 1695 },
      data: {
        Garchomp: {
          usage: 0.35,
          "Raw count": 100,
          Abilities: {},
          Items: {},
          Moves: {},
        },
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => rawData,
    });

    await fetchUsageStats("gen9ou", 2025, 1);

    expect(mockedPrisma.usageStats.upsert).toHaveBeenCalledTimes(1);
    expect(mockedPrisma.teammateCorr.upsert).not.toHaveBeenCalled();
    expect(mockedPrisma.checkCounter.upsert).not.toHaveBeenCalled();
  });

  it("resolves year/month automatically when not provided", async () => {
    // First call: HEAD request to find latest available month
    mockFetch.mockResolvedValueOnce({ ok: true }); // HEAD succeeds for first candidate
    // Second call: actual GET
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeChaosJson({ Garchomp: { usage: 0.5 } }),
    });

    await fetchUsageStats("gen9ou");

    // Should have made at least 2 fetch calls (HEAD + GET)
    expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(2);
    // The HEAD should use method: "HEAD"
    expect(mockFetch.mock.calls[0][1]).toEqual({ method: "HEAD" });
  });

  it("tries multiple months when HEAD requests fail", async () => {
    // All HEAD requests fail (network errors)
    for (let i = 0; i < 6; i++) {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));
    }
    // Falls back to first candidate, then the actual GET
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeChaosJson({ Pikachu: { usage: 0.01 } }),
    });

    await fetchUsageStats("gen9ou");

    // 6 failed HEAD + 1 successful GET = 7 total calls
    expect(mockFetch).toHaveBeenCalledTimes(7);
  });

  it("tries next month when HEAD returns non-ok", async () => {
    // First HEAD: not ok
    mockFetch.mockResolvedValueOnce({ ok: false });
    // Second HEAD: ok
    mockFetch.mockResolvedValueOnce({ ok: true });
    // Actual GET
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeChaosJson({ Pikachu: { usage: 0.01 } }),
    });

    await fetchUsageStats("gen9ou");

    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("sorts Pokemon by usage descending to determine rank", async () => {
    const json = makeChaosJson({
      Pikachu: { usage: 0.01 },
      Garchomp: { usage: 0.50 },
      Heatran: { usage: 0.25 },
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => json,
    });

    await fetchUsageStats("gen9ou", 2025, 1);

    const calls = mockedPrisma.usageStats.upsert.mock.calls;
    expect(calls[0][0].create.pokemonId).toBe("garchomp");
    expect(calls[0][0].create.rank).toBe(1);
    expect(calls[1][0].create.pokemonId).toBe("heatran");
    expect(calls[1][0].create.rank).toBe(2);
    expect(calls[2][0].create.pokemonId).toBe("pikachu");
    expect(calls[2][0].create.rank).toBe(3);
  });

  it("handles counters with missing values (defaults to 0)", async () => {
    const rawData = {
      info: { metagame: "gen9ou", cutoff: 1695 },
      data: {
        Garchomp: {
          usage: 0.35,
          "Raw count": 100,
          Abilities: {},
          Items: {},
          Moves: {},
          Teammates: {},
          "Checks and Counters": {
            Clefable: [] as number[],
          },
        },
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => rawData,
    });

    await fetchUsageStats("gen9ou", 2025, 1);

    const call = mockedPrisma.checkCounter.upsert.mock.calls[0][0];
    expect(call.create.koPercent).toBe(0);
    expect(call.create.switchPercent).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getUsageStats
// ---------------------------------------------------------------------------

describe("getUsageStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries with default pagination (limit 50, page 1)", async () => {
    const fakeRows = [
      { pokemonId: "garchomp", usagePercent: 0.35, rank: 1 },
      { pokemonId: "heatran", usagePercent: 0.20, rank: 2 },
    ];
    mockedPrisma.usageStats.findMany.mockResolvedValueOnce(fakeRows as any);

    const result = await getUsageStats("gen9ou");

    expect(mockedPrisma.usageStats.findMany).toHaveBeenCalledWith({
      where: { formatId: "gen9ou" },
      orderBy: { rank: "asc" },
      take: 50,
      skip: 0,
    });

    expect(result).toEqual([
      { pokemonId: "garchomp", usagePercent: 0.35, rank: 1 },
      { pokemonId: "heatran", usagePercent: 0.20, rank: 2 },
    ]);
  });

  it("applies custom limit and page", async () => {
    mockedPrisma.usageStats.findMany.mockResolvedValueOnce([] as any);

    await getUsageStats("gen9ou", { limit: 10, page: 3 });

    expect(mockedPrisma.usageStats.findMany).toHaveBeenCalledWith({
      where: { formatId: "gen9ou" },
      orderBy: { rank: "asc" },
      take: 10,
      skip: 20, // (3 - 1) * 10
    });
  });

  it("returns empty array when no data", async () => {
    mockedPrisma.usageStats.findMany.mockResolvedValueOnce([] as any);

    const result = await getUsageStats("gen9ou");
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getUsageStatsCount
// ---------------------------------------------------------------------------

describe("getUsageStatsCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns count from prisma", async () => {
    mockedPrisma.usageStats.count.mockResolvedValueOnce(150 as any);

    const count = await getUsageStatsCount("gen9ou");

    expect(mockedPrisma.usageStats.count).toHaveBeenCalledWith({
      where: { formatId: "gen9ou" },
    });
    expect(count).toBe(150);
  });

  it("returns 0 when no data", async () => {
    mockedPrisma.usageStats.count.mockResolvedValueOnce(0 as any);

    const count = await getUsageStatsCount("gen9ou");
    expect(count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getTopPokemon
// ---------------------------------------------------------------------------

describe("getTopPokemon", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries with correct limit and returns mapped entries", async () => {
    const fakeRows = [
      { pokemonId: "garchomp", usagePercent: 0.35, rank: 1 },
    ];
    mockedPrisma.usageStats.findMany.mockResolvedValueOnce(fakeRows as any);

    const result = await getTopPokemon("gen9ou", 10);

    expect(mockedPrisma.usageStats.findMany).toHaveBeenCalledWith({
      where: { formatId: "gen9ou" },
      orderBy: { rank: "asc" },
      take: 10,
    });

    expect(result).toEqual([
      { pokemonId: "garchomp", usagePercent: 0.35, rank: 1 },
    ]);
  });
});

// ---------------------------------------------------------------------------
// getTeammates
// ---------------------------------------------------------------------------

describe("getTeammates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries teammate correlations with correct params", async () => {
    const fakeRows = [
      { pokemonBId: "heatran", correlationPercent: 0.15 },
      { pokemonBId: "clefable", correlationPercent: 0.12 },
    ];
    mockedPrisma.teammateCorr.findMany.mockResolvedValueOnce(fakeRows as any);

    const result = await getTeammates("gen9ou", "garchomp", 5);

    expect(mockedPrisma.teammateCorr.findMany).toHaveBeenCalledWith({
      where: { formatId: "gen9ou", pokemonAId: "garchomp" },
      orderBy: { correlationPercent: "desc" },
      take: 5,
    });

    expect(result).toEqual([
      { pokemonId: "heatran", correlationPercent: 0.15 },
      { pokemonId: "clefable", correlationPercent: 0.12 },
    ]);
  });

  it("uses default limit of 20", async () => {
    mockedPrisma.teammateCorr.findMany.mockResolvedValueOnce([] as any);

    await getTeammates("gen9ou", "garchomp");

    expect(mockedPrisma.teammateCorr.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20 })
    );
  });

  it("returns empty array when no teammates found", async () => {
    mockedPrisma.teammateCorr.findMany.mockResolvedValueOnce([] as any);

    const result = await getTeammates("gen9ou", "missingmon");
    expect(result).toEqual([]);
  });
});
