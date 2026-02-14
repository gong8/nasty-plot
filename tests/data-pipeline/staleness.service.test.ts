import { isStale } from "@nasty-plot/data-pipeline"

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
}))

import { prisma } from "@nasty-plot/db"
const mockedPrisma = vi.mocked(prisma, true)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let nextId = 1
function mockSyncLog(overrides?: Record<string, unknown>) {
  return {
    id: nextId++,
    source: "smogon-stats",
    formatId: "gen9ou",
    lastSynced: new Date(),
    status: "success",
    message: null,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// isStale
// ---------------------------------------------------------------------------

describe("isStale", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    nextId = 1
  })

  it("returns true when no sync log exists", async () => {
    mockedPrisma.dataSyncLog.findUnique.mockResolvedValueOnce(null)

    const result = await isStale("smogon-stats", "gen9ou")

    expect(result).toBe(true)
    expect(mockedPrisma.dataSyncLog.findUnique).toHaveBeenCalledWith({
      where: { source_formatId: { source: "smogon-stats", formatId: "gen9ou" } },
    })
  })

  it("returns true when log status is error", async () => {
    mockedPrisma.dataSyncLog.findUnique.mockResolvedValueOnce(
      mockSyncLog({ status: "error", message: "Something broke" }),
    )

    const result = await isStale("smogon-stats", "gen9ou")

    expect(result).toBe(true)
  })

  it("returns false when data is fresh (within threshold)", async () => {
    // smogon-stats default threshold is 30 days
    const recentDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 day ago

    mockedPrisma.dataSyncLog.findUnique.mockResolvedValueOnce(
      mockSyncLog({ lastSynced: recentDate, message: "OK" }),
    )

    const result = await isStale("smogon-stats", "gen9ou")

    expect(result).toBe(false)
  })

  it("returns true when data exceeds default threshold for smogon-stats (30 days)", async () => {
    const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) // 31 days ago

    mockedPrisma.dataSyncLog.findUnique.mockResolvedValueOnce(
      mockSyncLog({ lastSynced: oldDate, message: "OK" }),
    )

    const result = await isStale("smogon-stats", "gen9ou")

    expect(result).toBe(true)
  })

  it("uses default threshold of 7 for smogon-sets", async () => {
    // 6 days ago => should be fresh
    const recentDate = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)

    mockedPrisma.dataSyncLog.findUnique.mockResolvedValueOnce(
      mockSyncLog({ source: "smogon-sets", lastSynced: recentDate, message: "OK" }),
    )

    const result = await isStale("smogon-sets", "gen9ou")

    expect(result).toBe(false)
  })

  it("returns true when smogon-sets data is older than 7 days", async () => {
    const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)

    mockedPrisma.dataSyncLog.findUnique.mockResolvedValueOnce(
      mockSyncLog({ source: "smogon-sets", lastSynced: oldDate, message: "OK" }),
    )

    const result = await isStale("smogon-sets", "gen9ou")

    expect(result).toBe(true)
  })

  it("uses fallback threshold of 7 for unknown sources", async () => {
    // 6 days ago => should be fresh with default of 7
    const recentDate = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)

    mockedPrisma.dataSyncLog.findUnique.mockResolvedValueOnce(
      mockSyncLog({ source: "unknown-source", lastSynced: recentDate, message: "OK" }),
    )

    const result = await isStale("unknown-source", "gen9ou")

    expect(result).toBe(false)
  })

  it("returns true for unknown source when older than 7 days", async () => {
    const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)

    mockedPrisma.dataSyncLog.findUnique.mockResolvedValueOnce(
      mockSyncLog({ source: "unknown-source", lastSynced: oldDate, message: "OK" }),
    )

    const result = await isStale("unknown-source", "gen9ou")

    expect(result).toBe(true)
  })

  it("respects custom thresholdDays parameter", async () => {
    // 3 days ago, custom threshold of 2 => stale
    const date3DaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)

    mockedPrisma.dataSyncLog.findUnique.mockResolvedValueOnce(
      mockSyncLog({ lastSynced: date3DaysAgo, message: "OK" }),
    )

    const result = await isStale("smogon-stats", "gen9ou", 2)

    expect(result).toBe(true)
  })

  it("custom thresholdDays overrides default", async () => {
    // 3 days ago, custom threshold of 5 => not stale
    const date3DaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)

    mockedPrisma.dataSyncLog.findUnique.mockResolvedValueOnce(
      mockSyncLog({ lastSynced: date3DaysAgo, message: "OK" }),
    )

    const result = await isStale("smogon-stats", "gen9ou", 5)

    expect(result).toBe(false)
  })

  it("returns true when data is exactly at the threshold boundary", async () => {
    // Exactly 30 days + 1 ms ago (just barely stale for smogon-stats)
    const boundaryDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000 - 1)

    mockedPrisma.dataSyncLog.findUnique.mockResolvedValueOnce(
      mockSyncLog({ lastSynced: boundaryDate, message: "OK" }),
    )

    const result = await isStale("smogon-stats", "gen9ou")

    expect(result).toBe(true)
  })

  it("returns false when data is exactly at the threshold (not exceeded)", async () => {
    // Exactly 30 days ago minus a buffer (just barely fresh)
    const freshDate = new Date(Date.now() - 29.9 * 24 * 60 * 60 * 1000)

    mockedPrisma.dataSyncLog.findUnique.mockResolvedValueOnce(
      mockSyncLog({ lastSynced: freshDate, message: "OK" }),
    )

    const result = await isStale("smogon-stats", "gen9ou")

    expect(result).toBe(false)
  })

  it("returns true for error status even when recently synced", async () => {
    mockedPrisma.dataSyncLog.findUnique.mockResolvedValueOnce(
      mockSyncLog({ status: "error", message: "fetch failed" }),
    )

    const result = await isStale("smogon-stats", "gen9ou")

    expect(result).toBe(true)
  })
})
