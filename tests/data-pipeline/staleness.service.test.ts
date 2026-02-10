import { isStale, getDataStatus } from "@nasty-plot/data-pipeline";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@nasty-plot/db", () => ({
  prisma: {
    dataSyncLog: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

import { prisma } from "@nasty-plot/db";
const mockedPrisma = vi.mocked(prisma, true);

// ---------------------------------------------------------------------------
// isStale
// ---------------------------------------------------------------------------

describe("isStale", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when no sync log exists", async () => {
    mockedPrisma.dataSyncLog.findUnique.mockResolvedValueOnce(null);

    const result = await isStale("smogon-stats", "gen9ou");

    expect(result).toBe(true);
    expect(mockedPrisma.dataSyncLog.findUnique).toHaveBeenCalledWith({
      where: { source_formatId: { source: "smogon-stats", formatId: "gen9ou" } },
    });
  });

  it("returns true when log status is error", async () => {
    mockedPrisma.dataSyncLog.findUnique.mockResolvedValueOnce({
      source: "smogon-stats",
      formatId: "gen9ou",
      lastSynced: new Date(),
      status: "error",
      message: "Something broke",
    } as any);

    const result = await isStale("smogon-stats", "gen9ou");

    expect(result).toBe(true);
  });

  it("returns false when data is fresh (within threshold)", async () => {
    // smogon-stats default threshold is 30 days
    const recentDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000); // 1 day ago

    mockedPrisma.dataSyncLog.findUnique.mockResolvedValueOnce({
      source: "smogon-stats",
      formatId: "gen9ou",
      lastSynced: recentDate,
      status: "success",
      message: "OK",
    } as any);

    const result = await isStale("smogon-stats", "gen9ou");

    expect(result).toBe(false);
  });

  it("returns true when data exceeds default threshold for smogon-stats (30 days)", async () => {
    const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000); // 31 days ago

    mockedPrisma.dataSyncLog.findUnique.mockResolvedValueOnce({
      source: "smogon-stats",
      formatId: "gen9ou",
      lastSynced: oldDate,
      status: "success",
      message: "OK",
    } as any);

    const result = await isStale("smogon-stats", "gen9ou");

    expect(result).toBe(true);
  });

  it("uses default threshold of 7 for smogon-sets", async () => {
    // 6 days ago => should be fresh
    const recentDate = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);

    mockedPrisma.dataSyncLog.findUnique.mockResolvedValueOnce({
      source: "smogon-sets",
      formatId: "gen9ou",
      lastSynced: recentDate,
      status: "success",
      message: "OK",
    } as any);

    const result = await isStale("smogon-sets", "gen9ou");

    expect(result).toBe(false);
  });

  it("returns true when smogon-sets data is older than 7 days", async () => {
    const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);

    mockedPrisma.dataSyncLog.findUnique.mockResolvedValueOnce({
      source: "smogon-sets",
      formatId: "gen9ou",
      lastSynced: oldDate,
      status: "success",
      message: "OK",
    } as any);

    const result = await isStale("smogon-sets", "gen9ou");

    expect(result).toBe(true);
  });

  it("uses fallback threshold of 7 for unknown sources", async () => {
    // 6 days ago => should be fresh with default of 7
    const recentDate = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);

    mockedPrisma.dataSyncLog.findUnique.mockResolvedValueOnce({
      source: "unknown-source",
      formatId: "gen9ou",
      lastSynced: recentDate,
      status: "success",
      message: "OK",
    } as any);

    const result = await isStale("unknown-source", "gen9ou");

    expect(result).toBe(false);
  });

  it("returns true for unknown source when older than 7 days", async () => {
    const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);

    mockedPrisma.dataSyncLog.findUnique.mockResolvedValueOnce({
      source: "unknown-source",
      formatId: "gen9ou",
      lastSynced: oldDate,
      status: "success",
      message: "OK",
    } as any);

    const result = await isStale("unknown-source", "gen9ou");

    expect(result).toBe(true);
  });

  it("respects custom thresholdDays parameter", async () => {
    // 3 days ago, custom threshold of 2 => stale
    const date3DaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    mockedPrisma.dataSyncLog.findUnique.mockResolvedValueOnce({
      source: "smogon-stats",
      formatId: "gen9ou",
      lastSynced: date3DaysAgo,
      status: "success",
      message: "OK",
    } as any);

    const result = await isStale("smogon-stats", "gen9ou", 2);

    expect(result).toBe(true);
  });

  it("custom thresholdDays overrides default", async () => {
    // 3 days ago, custom threshold of 5 => not stale
    const date3DaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    mockedPrisma.dataSyncLog.findUnique.mockResolvedValueOnce({
      source: "smogon-stats",
      formatId: "gen9ou",
      lastSynced: date3DaysAgo,
      status: "success",
      message: "OK",
    } as any);

    const result = await isStale("smogon-stats", "gen9ou", 5);

    expect(result).toBe(false);
  });

  it("returns true when data is exactly at the threshold boundary", async () => {
    // Exactly 30 days + 1 ms ago (just barely stale for smogon-stats)
    const boundaryDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000 - 1);

    mockedPrisma.dataSyncLog.findUnique.mockResolvedValueOnce({
      source: "smogon-stats",
      formatId: "gen9ou",
      lastSynced: boundaryDate,
      status: "success",
      message: "OK",
    } as any);

    const result = await isStale("smogon-stats", "gen9ou");

    expect(result).toBe(true);
  });

  it("returns false when data is exactly at the threshold (not exceeded)", async () => {
    // Exactly 30 days ago minus a buffer (just barely fresh)
    const freshDate = new Date(Date.now() - 29.9 * 24 * 60 * 60 * 1000);

    mockedPrisma.dataSyncLog.findUnique.mockResolvedValueOnce({
      source: "smogon-stats",
      formatId: "gen9ou",
      lastSynced: freshDate,
      status: "success",
      message: "OK",
    } as any);

    const result = await isStale("smogon-stats", "gen9ou");

    expect(result).toBe(false);
  });

  it("returns true for error status even when recently synced", async () => {
    mockedPrisma.dataSyncLog.findUnique.mockResolvedValueOnce({
      source: "smogon-stats",
      formatId: "gen9ou",
      lastSynced: new Date(), // just now
      status: "error",
      message: "fetch failed",
    } as any);

    const result = await isStale("smogon-stats", "gen9ou");

    expect(result).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getDataStatus
// ---------------------------------------------------------------------------

describe("getDataStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns mapped sync logs from database", async () => {
    const now = new Date();
    const fakeRows = [
      {
        source: "smogon-sets",
        formatId: "gen9ou",
        lastSynced: now,
        status: "success",
        message: "OK",
      },
      {
        source: "smogon-stats",
        formatId: "gen9ou",
        lastSynced: now,
        status: "success",
        message: "Fetched 200 Pokemon",
      },
    ];

    mockedPrisma.dataSyncLog.findMany.mockResolvedValueOnce(fakeRows as any);

    const result = await getDataStatus();

    expect(mockedPrisma.dataSyncLog.findMany).toHaveBeenCalledWith({
      orderBy: [{ source: "asc" }, { formatId: "asc" }],
    });

    expect(result).toEqual([
      {
        source: "smogon-sets",
        formatId: "gen9ou",
        lastSynced: now,
        status: "success",
      },
      {
        source: "smogon-stats",
        formatId: "gen9ou",
        lastSynced: now,
        status: "success",
      },
    ]);
  });

  it("returns empty array when no sync logs exist", async () => {
    mockedPrisma.dataSyncLog.findMany.mockResolvedValueOnce([] as any);

    const result = await getDataStatus();

    expect(result).toEqual([]);
  });

  it("includes logs with error status", async () => {
    const now = new Date();
    const fakeRows = [
      {
        source: "smogon-stats",
        formatId: "gen9ou",
        lastSynced: now,
        status: "error",
        message: "Network timeout",
      },
    ];

    mockedPrisma.dataSyncLog.findMany.mockResolvedValueOnce(fakeRows as any);

    const result = await getDataStatus();

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("error");
  });

  it("maps only source, formatId, lastSynced, and status (excludes message)", async () => {
    const now = new Date();
    const fakeRows = [
      {
        source: "smogon-stats",
        formatId: "gen9ou",
        lastSynced: now,
        status: "success",
        message: "Detailed message not in output",
        extraField: "should not appear",
      },
    ];

    mockedPrisma.dataSyncLog.findMany.mockResolvedValueOnce(fakeRows as any);

    const result = await getDataStatus();

    expect(result[0]).toEqual({
      source: "smogon-stats",
      formatId: "gen9ou",
      lastSynced: now,
      status: "success",
    });
    expect(result[0]).not.toHaveProperty("message");
    expect(result[0]).not.toHaveProperty("extraField");
  });
});
