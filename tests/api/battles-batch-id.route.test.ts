import { vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@nasty-plot/db", () => ({
  prisma: {
    batchSimulation: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "@nasty-plot/db";
import { GET, DELETE } from "../../apps/web/src/app/api/battles/batch/[batchId]/route";

describe("GET /api/battles/batch/[batchId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns batch with parsed analytics", async () => {
    const analytics = { avgTurns: 12.5, team1WinRate: 0.6 };
    const mockBatch = {
      id: "batch-123",
      formatId: "gen9ou",
      totalGames: 100,
      completedGames: 100,
      team1Wins: 60,
      team2Wins: 40,
      draws: 0,
      status: "completed",
      analytics: JSON.stringify(analytics),
    };
    (prisma.batchSimulation.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockBatch);

    const req = new NextRequest("http://localhost:3000/api/battles/batch/batch-123");
    const response = await GET(req, {
      params: Promise.resolve({ batchId: "batch-123" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe("batch-123");
    expect(data.analytics).toEqual(analytics);
    expect(typeof data.analytics).toBe("object");
  });

  it("returns batch with null analytics when not yet available", async () => {
    const mockBatch = {
      id: "batch-456",
      status: "running",
      analytics: null,
    };
    (prisma.batchSimulation.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockBatch);

    const req = new NextRequest("http://localhost:3000/api/battles/batch/batch-456");
    const response = await GET(req, {
      params: Promise.resolve({ batchId: "batch-456" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.analytics).toBeNull();
  });

  it("returns 404 when batch not found", async () => {
    (prisma.batchSimulation.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const req = new NextRequest("http://localhost:3000/api/battles/batch/nonexistent");
    const response = await GET(req, {
      params: Promise.resolve({ batchId: "nonexistent" }),
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Batch not found");
  });
});

describe("DELETE /api/battles/batch/[batchId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("soft deletes by setting status to cancelled", async () => {
    (prisma.batchSimulation.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "batch-123",
      status: "cancelled",
    });

    const req = new NextRequest("http://localhost:3000/api/battles/batch/batch-123", {
      method: "DELETE",
    });
    const response = await DELETE(req, {
      params: Promise.resolve({ batchId: "batch-123" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(prisma.batchSimulation.update).toHaveBeenCalledWith({
      where: { id: "batch-123" },
      data: { status: "cancelled" },
    });
  });

  it("returns 404 when batch not found", async () => {
    (prisma.batchSimulation.update as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Record not found"),
    );

    const req = new NextRequest("http://localhost:3000/api/battles/batch/nonexistent", {
      method: "DELETE",
    });
    const response = await DELETE(req, {
      params: Promise.resolve({ batchId: "nonexistent" }),
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Batch not found");
  });
});
