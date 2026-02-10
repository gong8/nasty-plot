import { analyzeTeam } from "../analysis.service";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@nasty-plot/db", () => ({
  prisma: {
    team: {
      findUnique: vi.fn(),
    },
    usageStats: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@pkmn/dex", () => ({
  Dex: {
    species: {
      get: vi.fn(),
    },
  },
}));

vi.mock("../coverage.service", () => ({
  analyzeTypeCoverage: vi.fn(),
}));

vi.mock("../threat.service", () => ({
  identifyThreats: vi.fn(),
}));

vi.mock("../synergy.service", () => ({
  calculateSynergy: vi.fn(),
}));

import { prisma } from "@nasty-plot/db";
import { Dex } from "@pkmn/dex";
import { analyzeTypeCoverage } from "../coverage.service";
import { identifyThreats } from "../threat.service";
import { calculateSynergy } from "../synergy.service";

const mockTeamFindUnique = prisma.team.findUnique as ReturnType<typeof vi.fn>;
const mockSpeciesGet = Dex.species.get as ReturnType<typeof vi.fn>;
const mockCoverage = analyzeTypeCoverage as ReturnType<typeof vi.fn>;
const mockThreats = identifyThreats as ReturnType<typeof vi.fn>;
const mockSynergy = calculateSynergy as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDbTeam(slots: unknown[] = []) {
  return {
    id: "team-1",
    name: "Test Team",
    formatId: "gen9ou",
    mode: "freeform",
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    slots,
  };
}

function makeDbSlot(overrides?: Record<string, unknown>) {
  return {
    id: 1,
    teamId: "team-1",
    position: 1,
    pokemonId: "garchomp",
    nickname: null,
    ability: "Rough Skin",
    item: "Leftovers",
    nature: "Jolly",
    teraType: null,
    level: 100,
    move1: "Earthquake",
    move2: "Dragon Claw",
    move3: null,
    move4: null,
    evHp: 0, evAtk: 252, evDef: 0, evSpA: 0, evSpD: 4, evSpe: 252,
    ivHp: 31, ivAtk: 31, ivDef: 31, ivSpA: 31, ivSpD: 31, ivSpe: 31,
    ...overrides,
  };
}

function mockSpeciesData(id: string, types: string[]) {
  return {
    exists: true,
    name: id.charAt(0).toUpperCase() + id.slice(1),
    num: 1,
    types,
    baseStats: { hp: 108, atk: 130, def: 95, spa: 80, spd: 85, spe: 102 },
    abilities: { "0": "Rough Skin" },
    weightkg: 95,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("analyzeTeam", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockCoverage.mockReturnValue({
      offensive: {},
      defensive: {},
      uncoveredTypes: [],
      sharedWeaknesses: [],
    });
    mockThreats.mockResolvedValue([]);
    mockSynergy.mockReturnValue(75);
  });

  it("throws when team not found", async () => {
    mockTeamFindUnique.mockResolvedValue(null);

    await expect(analyzeTeam("nonexistent")).rejects.toThrow("Team not found");
  });

  it("returns a TeamAnalysis object", async () => {
    mockTeamFindUnique.mockResolvedValue(
      makeDbTeam([makeDbSlot()])
    );
    mockSpeciesGet.mockReturnValue(mockSpeciesData("garchomp", ["Dragon", "Ground"]));

    const result = await analyzeTeam("team-1");

    expect(result).toHaveProperty("coverage");
    expect(result).toHaveProperty("threats");
    expect(result).toHaveProperty("synergyScore");
    expect(result).toHaveProperty("speedTiers");
    expect(result).toHaveProperty("suggestions");
  });

  it("calls analyzeTypeCoverage with converted slots", async () => {
    mockTeamFindUnique.mockResolvedValue(
      makeDbTeam([makeDbSlot()])
    );
    mockSpeciesGet.mockReturnValue(mockSpeciesData("garchomp", ["Dragon", "Ground"]));

    await analyzeTeam("team-1");

    expect(mockCoverage).toHaveBeenCalledTimes(1);
    const passedSlots = mockCoverage.mock.calls[0][0];
    expect(passedSlots).toHaveLength(1);
    expect(passedSlots[0].pokemonId).toBe("garchomp");
  });

  it("calls identifyThreats with slots and formatId", async () => {
    mockTeamFindUnique.mockResolvedValue(
      makeDbTeam([makeDbSlot()])
    );
    mockSpeciesGet.mockReturnValue(mockSpeciesData("garchomp", ["Dragon", "Ground"]));

    await analyzeTeam("team-1");

    expect(mockThreats).toHaveBeenCalledWith(
      expect.any(Array),
      "gen9ou"
    );
  });

  it("calls calculateSynergy with converted slots", async () => {
    mockTeamFindUnique.mockResolvedValue(
      makeDbTeam([makeDbSlot()])
    );
    mockSpeciesGet.mockReturnValue(mockSpeciesData("garchomp", ["Dragon", "Ground"]));

    await analyzeTeam("team-1");

    expect(mockSynergy).toHaveBeenCalledTimes(1);
  });

  it("calculates speed tiers", async () => {
    mockTeamFindUnique.mockResolvedValue(
      makeDbTeam([makeDbSlot()])
    );
    mockSpeciesGet.mockReturnValue(mockSpeciesData("garchomp", ["Dragon", "Ground"]));

    const result = await analyzeTeam("team-1");

    expect(Array.isArray(result.speedTiers)).toBe(true);
    if (result.speedTiers.length > 0) {
      expect(result.speedTiers[0]).toHaveProperty("pokemonId");
      expect(result.speedTiers[0]).toHaveProperty("speed");
      expect(result.speedTiers[0]).toHaveProperty("nature");
    }
  });

  it("generates suggestions based on analysis", async () => {
    mockTeamFindUnique.mockResolvedValue(
      makeDbTeam([makeDbSlot()])
    );
    mockSpeciesGet.mockReturnValue(mockSpeciesData("garchomp", ["Dragon", "Ground"]));
    mockCoverage.mockReturnValue({
      offensive: {},
      defensive: {},
      uncoveredTypes: ["Fairy", "Steel"],
      sharedWeaknesses: [],
    });

    const result = await analyzeTeam("team-1");

    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it("suggests filling team when less than 6 Pokemon", async () => {
    mockTeamFindUnique.mockResolvedValue(
      makeDbTeam([makeDbSlot()])
    );
    mockSpeciesGet.mockReturnValue(mockSpeciesData("garchomp", ["Dragon", "Ground"]));

    const result = await analyzeTeam("team-1");

    const fillSuggestion = result.suggestions.find((s: string) =>
      s.includes("only has")
    );
    expect(fillSuggestion).toBeDefined();
  });

  it("handles team with multiple slots", async () => {
    mockTeamFindUnique.mockResolvedValue(
      makeDbTeam([
        makeDbSlot({ position: 1, pokemonId: "garchomp" }),
        makeDbSlot({ position: 2, pokemonId: "heatran", id: 2 }),
      ])
    );

    mockSpeciesGet.mockImplementation((id: string) => {
      if (id === "garchomp") return mockSpeciesData("garchomp", ["Dragon", "Ground"]);
      if (id === "heatran") return mockSpeciesData("heatran", ["Fire", "Steel"]);
      return { exists: false };
    });

    const result = await analyzeTeam("team-1");

    expect(result).toBeDefined();
    expect(result.speedTiers.length).toBe(2);
  });

  it("speed tiers are sorted by speed descending", async () => {
    mockTeamFindUnique.mockResolvedValue(
      makeDbTeam([
        makeDbSlot({ position: 1, pokemonId: "garchomp" }),
        makeDbSlot({ position: 2, pokemonId: "ferrothorn", id: 2 }),
      ])
    );

    mockSpeciesGet.mockImplementation((id: string) => {
      if (id === "garchomp") return mockSpeciesData("garchomp", ["Dragon", "Ground"]);
      if (id === "ferrothorn")
        return {
          ...mockSpeciesData("ferrothorn", ["Grass", "Steel"]),
          baseStats: { hp: 74, atk: 94, def: 131, spa: 54, spd: 116, spe: 20 },
        };
      return { exists: false };
    });

    const result = await analyzeTeam("team-1");

    if (result.speedTiers.length >= 2) {
      expect(result.speedTiers[0].speed).toBeGreaterThanOrEqual(
        result.speedTiers[1].speed
      );
    }
  });
});
