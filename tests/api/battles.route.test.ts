import { vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@nasty-plot/db", () => ({
  prisma: {
    battle: {
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import { prisma } from "@nasty-plot/db";
import { GET, POST } from "../../apps/web/src/app/api/battles/route";

describe("GET /api/battles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns battles list with pagination", async () => {
    const mockBattles = [
      {
        id: "b1",
        formatId: "gen9ou",
        gameType: "singles",
        mode: "play",
        aiDifficulty: "heuristic",
        team1Name: "Player",
        team2Name: "Opponent",
        winnerId: "team1",
        turnCount: 15,
        createdAt: new Date().toISOString(),
      },
    ];
    (prisma.battle.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockBattles);
    (prisma.battle.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

    const req = new NextRequest("http://localhost:3000/api/battles?page=1&limit=10");
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.battles).toEqual(mockBattles);
    expect(data.total).toBe(1);
    expect(data.page).toBe(1);
    expect(data.limit).toBe(10);
    expect(prisma.battle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 10 }),
    );
  });

  it("handles empty results", async () => {
    (prisma.battle.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.battle.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

    const req = new NextRequest("http://localhost:3000/api/battles");
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.battles).toEqual([]);
    expect(data.total).toBe(0);
  });

  it("applies default pagination when no params", async () => {
    (prisma.battle.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.battle.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

    const req = new NextRequest("http://localhost:3000/api/battles");
    const response = await GET(req);
    const data = await response.json();

    expect(data.page).toBe(1);
    expect(data.limit).toBe(20);
    expect(prisma.battle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 }),
    );
  });
});

describe("POST /api/battles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates battle with valid data", async () => {
    const mockBattle = {
      id: "new-battle-id",
      formatId: "gen9ou",
      gameType: "singles",
      mode: "play",
      team1Paste: "Garchomp @ Choice Scarf\nAbility: Rough Skin",
      team2Paste: "Dragapult @ Choice Specs\nAbility: Infiltrator",
      protocolLog: "|start\n|turn|1",
    };
    (prisma.battle.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockBattle);

    const req = new NextRequest("http://localhost:3000/api/battles", {
      method: "POST",
      body: JSON.stringify({
        formatId: "gen9ou",
        team1Paste: "Garchomp @ Choice Scarf\nAbility: Rough Skin",
        team2Paste: "Dragapult @ Choice Specs\nAbility: Infiltrator",
        protocolLog: "|start\n|turn|1",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.id).toBe("new-battle-id");
    expect(prisma.battle.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          formatId: "gen9ou",
          gameType: "singles",
          mode: "play",
        }),
      }),
    );
  });

  it("returns 400 when required fields missing", async () => {
    const req = new NextRequest("http://localhost:3000/api/battles", {
      method: "POST",
      body: JSON.stringify({ formatId: "gen9ou" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Missing required fields");
  });

  it("returns 400 when protocolLog is missing", async () => {
    const req = new NextRequest("http://localhost:3000/api/battles", {
      method: "POST",
      body: JSON.stringify({
        formatId: "gen9ou",
        team1Paste: "some paste",
        team2Paste: "some paste",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
  });

  it("creates battle with turns data", async () => {
    const mockBattle = { id: "battle-with-turns" };
    (prisma.battle.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockBattle);

    const turns = [
      {
        turnNumber: 1,
        team1Action: "move earthquake",
        team2Action: "move draco meteor",
        stateSnapshot: "{}",
        winProbTeam1: 0.55,
      },
    ];

    const req = new NextRequest("http://localhost:3000/api/battles", {
      method: "POST",
      body: JSON.stringify({
        formatId: "gen9ou",
        team1Paste: "paste1",
        team2Paste: "paste2",
        protocolLog: "|turn|1",
        turns,
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(req);
    expect(response.status).toBe(201);
    expect(prisma.battle.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          turns: {
            create: expect.arrayContaining([
              expect.objectContaining({ turnNumber: 1, winProbTeam1: 0.55 }),
            ]),
          },
        }),
      }),
    );
  });
});
