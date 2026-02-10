import type { PokemonType } from "@/shared/types";
import { analyzeTeam } from "./analysis.service";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/shared/services/prisma", () => ({
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

// Mock the sub-services so we can isolate the orchestrator logic
vi.mock("./coverage.service", () => ({
  analyzeTypeCoverage: vi.fn(),
}));

vi.mock("./threat.service", () => ({
  identifyThreats: vi.fn(),
}));

vi.mock("./synergy.service", () => ({
  calculateSynergy: vi.fn(),
}));

import { prisma } from "@/shared/services/prisma";
import { Dex } from "@pkmn/dex";
import { analyzeTypeCoverage } from "./coverage.service";
import { identifyThreats } from "./threat.service";
import { calculateSynergy } from "./synergy.service";

const mockTeamFindUnique = prisma.team.findUnique as ReturnType<typeof vi.fn>;
const mockSpeciesGet = Dex.species.get as ReturnType<typeof vi.fn>;
const mockCoverage = analyzeTypeCoverage as ReturnType<typeof vi.fn>;
const mockThreats = identifyThreats as ReturnType<typeof vi.fn>;
const mockSynergy = calculateSynergy as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDbSlot(position: number, pokemonId: string) {
  return {
    position,
    pokemonId,
    ability: "Intimidate",
    item: "Leftovers",
    nature: "Adamant",
    teraType: null,
    level: 100,
    move1: "earthquake",
    move2: "outrage",
    move3: null,
    move4: null,
    evHp: 0,
    evAtk: 252,
    evDef: 0,
    evSpA: 0,
    evSpD: 4,
    evSpe: 252,
    ivHp: 31,
    ivAtk: 31,
    ivDef: 31,
    ivSpA: 31,
    ivSpD: 31,
    ivSpe: 31,
  };
}

function makeDexSpecies(
  id: string,
  name: string,
  types: string[],
  baseStats = { hp: 80, atk: 100, def: 80, spa: 80, spd: 80, spe: 100 }
) {
  return {
    exists: true,
    name,
    num: 1,
    types,
    baseStats,
    abilities: { "0": "Intimidate" },
    weightkg: 50,
  };
}

const emptyCoverage = {
  offensive: {} as Record<PokemonType, number>,
  defensive: {} as Record<PokemonType, number>,
  uncoveredTypes: [],
  sharedWeaknesses: [],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("analyzeTeam", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // Error handling
  // -----------------------------------------------------------------------

  it("throws an error when team is not found", async () => {
    mockTeamFindUnique.mockResolvedValue(null);

    await expect(analyzeTeam("nonexistent-id")).rejects.toThrow("Team not found: nonexistent-id");
  });

  // -----------------------------------------------------------------------
  // DB loading and slot mapping
  // -----------------------------------------------------------------------

  it("loads the team from the database with slots included", async () => {
    const dbTeam = {
      id: "team-1",
      formatId: "gen9ou",
      slots: [makeDbSlot(1, "garchomp")],
    };

    mockTeamFindUnique.mockResolvedValue(dbTeam);
    mockSpeciesGet.mockReturnValue(
      makeDexSpecies("garchomp", "Garchomp", ["Dragon", "Ground"], {
        hp: 108, atk: 130, def: 95, spa: 80, spd: 85, spe: 102,
      })
    );
    mockCoverage.mockReturnValue(emptyCoverage);
    mockThreats.mockResolvedValue([]);
    mockSynergy.mockReturnValue(50);

    await analyzeTeam("team-1");

    expect(mockTeamFindUnique).toHaveBeenCalledWith({
      where: { id: "team-1" },
      include: { slots: true },
    });
  });

  // -----------------------------------------------------------------------
  // Orchestration: calls sub-services correctly
  // -----------------------------------------------------------------------

  it("calls analyzeTypeCoverage with converted slots", async () => {
    const dbTeam = {
      id: "team-1",
      formatId: "gen9ou",
      slots: [makeDbSlot(1, "garchomp")],
    };

    mockTeamFindUnique.mockResolvedValue(dbTeam);
    mockSpeciesGet.mockReturnValue(
      makeDexSpecies("garchomp", "Garchomp", ["Dragon", "Ground"])
    );
    mockCoverage.mockReturnValue(emptyCoverage);
    mockThreats.mockResolvedValue([]);
    mockSynergy.mockReturnValue(50);

    await analyzeTeam("team-1");

    expect(mockCoverage).toHaveBeenCalledTimes(1);
    const callArg = mockCoverage.mock.calls[0][0];
    expect(callArg).toHaveLength(1);
    expect(callArg[0].pokemonId).toBe("garchomp");
    expect(callArg[0].species?.types).toEqual(["Dragon", "Ground"]);
  });

  it("calls identifyThreats with slots and formatId", async () => {
    const dbTeam = {
      id: "team-1",
      formatId: "gen9ou",
      slots: [makeDbSlot(1, "pikachu")],
    };

    mockTeamFindUnique.mockResolvedValue(dbTeam);
    mockSpeciesGet.mockReturnValue(
      makeDexSpecies("pikachu", "Pikachu", ["Electric"])
    );
    mockCoverage.mockReturnValue(emptyCoverage);
    mockThreats.mockResolvedValue([]);
    mockSynergy.mockReturnValue(50);

    await analyzeTeam("team-1");

    expect(mockThreats).toHaveBeenCalledTimes(1);
    expect(mockThreats.mock.calls[0][1]).toBe("gen9ou");
  });

  it("calls calculateSynergy with converted slots", async () => {
    const dbTeam = {
      id: "team-1",
      formatId: "gen9ou",
      slots: [makeDbSlot(1, "pikachu")],
    };

    mockTeamFindUnique.mockResolvedValue(dbTeam);
    mockSpeciesGet.mockReturnValue(
      makeDexSpecies("pikachu", "Pikachu", ["Electric"])
    );
    mockCoverage.mockReturnValue(emptyCoverage);
    mockThreats.mockResolvedValue([]);
    mockSynergy.mockReturnValue(60);

    await analyzeTeam("team-1");

    expect(mockSynergy).toHaveBeenCalledTimes(1);
  });

  // -----------------------------------------------------------------------
  // Return shape
  // -----------------------------------------------------------------------

  it("returns a correctly shaped TeamAnalysis object", async () => {
    const dbTeam = {
      id: "team-1",
      formatId: "gen9ou",
      slots: [
        makeDbSlot(1, "garchomp"),
        makeDbSlot(2, "corviknight"),
      ],
    };

    mockTeamFindUnique.mockResolvedValue(dbTeam);
    mockSpeciesGet.mockImplementation((id: string) => {
      if (id === "garchomp")
        return makeDexSpecies("garchomp", "Garchomp", ["Dragon", "Ground"], {
          hp: 108, atk: 130, def: 95, spa: 80, spd: 85, spe: 102,
        });
      if (id === "corviknight")
        return makeDexSpecies("corviknight", "Corviknight", ["Flying", "Steel"], {
          hp: 98, atk: 87, def: 105, spa: 53, spd: 85, spe: 67,
        });
      return { exists: false };
    });
    mockCoverage.mockReturnValue({
      ...emptyCoverage,
      uncoveredTypes: ["Fairy"],
      sharedWeaknesses: [],
    });
    mockThreats.mockResolvedValue([]);
    mockSynergy.mockReturnValue(72);

    const result = await analyzeTeam("team-1");

    expect(result).toHaveProperty("coverage");
    expect(result).toHaveProperty("threats");
    expect(result).toHaveProperty("synergyScore", 72);
    expect(result).toHaveProperty("speedTiers");
    expect(result).toHaveProperty("suggestions");
    expect(Array.isArray(result.speedTiers)).toBe(true);
    expect(Array.isArray(result.suggestions)).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Speed tiers calculation
  // -----------------------------------------------------------------------

  it("calculates speed tiers sorted by descending speed", async () => {
    const dbTeam = {
      id: "team-1",
      formatId: "gen9ou",
      slots: [
        makeDbSlot(1, "garchomp"),
        makeDbSlot(2, "corviknight"),
      ],
    };

    mockTeamFindUnique.mockResolvedValue(dbTeam);
    mockSpeciesGet.mockImplementation((id: string) => {
      if (id === "garchomp")
        return makeDexSpecies("garchomp", "Garchomp", ["Dragon", "Ground"], {
          hp: 108, atk: 130, def: 95, spa: 80, spd: 85, spe: 102,
        });
      if (id === "corviknight")
        return makeDexSpecies("corviknight", "Corviknight", ["Flying", "Steel"], {
          hp: 98, atk: 87, def: 105, spa: 53, spd: 85, spe: 67,
        });
      return { exists: false };
    });
    mockCoverage.mockReturnValue(emptyCoverage);
    mockThreats.mockResolvedValue([]);
    mockSynergy.mockReturnValue(50);

    const result = await analyzeTeam("team-1");

    expect(result.speedTiers.length).toBe(2);
    // Garchomp (base 102) should be faster than Corviknight (base 67)
    expect(result.speedTiers[0].speed).toBeGreaterThan(result.speedTiers[1].speed);
    expect(result.speedTiers[0].pokemonName).toBe("Garchomp");
  });

  // -----------------------------------------------------------------------
  // Suggestion generation
  // -----------------------------------------------------------------------

  describe("suggestions", () => {
    it("suggests coverage gap fix when uncovered types exist", async () => {
      const dbTeam = {
        id: "team-1",
        formatId: "gen9ou",
        slots: [makeDbSlot(1, "pikachu")],
      };

      mockTeamFindUnique.mockResolvedValue(dbTeam);
      mockSpeciesGet.mockReturnValue(
        makeDexSpecies("pikachu", "Pikachu", ["Electric"])
      );
      mockCoverage.mockReturnValue({
        ...emptyCoverage,
        uncoveredTypes: ["Steel", "Dragon"],
        sharedWeaknesses: [],
      });
      mockThreats.mockResolvedValue([]);
      mockSynergy.mockReturnValue(50);

      const result = await analyzeTeam("team-1");

      const coverageSuggestion = result.suggestions.find((s) =>
        s.includes("lacks super-effective coverage")
      );
      expect(coverageSuggestion).toBeDefined();
      expect(coverageSuggestion).toContain("Steel");
    });

    it("suggests weakness mitigation when shared weaknesses exist", async () => {
      const dbTeam = {
        id: "team-1",
        formatId: "gen9ou",
        slots: [makeDbSlot(1, "pikachu")],
      };

      mockTeamFindUnique.mockResolvedValue(dbTeam);
      mockSpeciesGet.mockReturnValue(
        makeDexSpecies("pikachu", "Pikachu", ["Electric"])
      );
      mockCoverage.mockReturnValue({
        ...emptyCoverage,
        uncoveredTypes: [],
        sharedWeaknesses: ["Ground"],
      });
      mockThreats.mockResolvedValue([]);
      mockSynergy.mockReturnValue(50);

      const result = await analyzeTeam("team-1");

      const weaknessSuggestion = result.suggestions.find((s) =>
        s.includes("weak to Ground")
      );
      expect(weaknessSuggestion).toBeDefined();
    });

    it("suggests threat counters when high threats exist", async () => {
      const dbTeam = {
        id: "team-1",
        formatId: "gen9ou",
        slots: [makeDbSlot(1, "pikachu")],
      };

      mockTeamFindUnique.mockResolvedValue(dbTeam);
      mockSpeciesGet.mockReturnValue(
        makeDexSpecies("pikachu", "Pikachu", ["Electric"])
      );
      mockCoverage.mockReturnValue(emptyCoverage);
      mockThreats.mockResolvedValue([
        {
          pokemonId: "garchomp",
          pokemonName: "Garchomp",
          usagePercent: 20,
          threatLevel: "high",
          reason: "Ground-type STAB",
        },
      ]);
      mockSynergy.mockReturnValue(50);

      const result = await analyzeTeam("team-1");

      const threatSuggestion = result.suggestions.find((s) =>
        s.includes("Garchomp")
      );
      expect(threatSuggestion).toBeDefined();
      expect(threatSuggestion).toContain("threat");
    });

    it("suggests synergy improvement when score is low", async () => {
      const dbTeam = {
        id: "team-1",
        formatId: "gen9ou",
        slots: [makeDbSlot(1, "pikachu")],
      };

      mockTeamFindUnique.mockResolvedValue(dbTeam);
      mockSpeciesGet.mockReturnValue(
        makeDexSpecies("pikachu", "Pikachu", ["Electric"])
      );
      mockCoverage.mockReturnValue(emptyCoverage);
      mockThreats.mockResolvedValue([]);
      mockSynergy.mockReturnValue(30); // Below 40 threshold

      const result = await analyzeTeam("team-1");

      const synergySuggestion = result.suggestions.find((s) =>
        s.includes("synergy is low")
      );
      expect(synergySuggestion).toBeDefined();
    });

    it("suggests filling remaining slots when team has fewer than 6", async () => {
      const dbTeam = {
        id: "team-1",
        formatId: "gen9ou",
        slots: [makeDbSlot(1, "pikachu"), makeDbSlot(2, "charizard")],
      };

      mockTeamFindUnique.mockResolvedValue(dbTeam);
      mockSpeciesGet.mockImplementation((id: string) => {
        if (id === "pikachu") return makeDexSpecies("pikachu", "Pikachu", ["Electric"]);
        if (id === "charizard")
          return makeDexSpecies("charizard", "Charizard", ["Fire", "Flying"]);
        return { exists: false };
      });
      mockCoverage.mockReturnValue(emptyCoverage);
      mockThreats.mockResolvedValue([]);
      mockSynergy.mockReturnValue(50);

      const result = await analyzeTeam("team-1");

      const sizeSuggestion = result.suggestions.find((s) =>
        s.includes("only has 2 Pokemon")
      );
      expect(sizeSuggestion).toBeDefined();
    });

    it("does not suggest filling slots for a full team of 6", async () => {
      const dbTeam = {
        id: "team-1",
        formatId: "gen9ou",
        slots: Array.from({ length: 6 }, (_, i) => makeDbSlot(i + 1, `mon-${i}`)),
      };

      mockTeamFindUnique.mockResolvedValue(dbTeam);
      mockSpeciesGet.mockReturnValue(
        makeDexSpecies("mon", "Mon", ["Normal"])
      );
      mockCoverage.mockReturnValue(emptyCoverage);
      mockThreats.mockResolvedValue([]);
      mockSynergy.mockReturnValue(80);

      const result = await analyzeTeam("team-1");

      const sizeSuggestion = result.suggestions.find((s) =>
        s.includes("only has")
      );
      expect(sizeSuggestion).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // Slot mapping edge cases
  // -----------------------------------------------------------------------

  it("handles species that do not exist in the Dex", async () => {
    const dbTeam = {
      id: "team-1",
      formatId: "gen9ou",
      slots: [makeDbSlot(1, "fakemon")],
    };

    mockTeamFindUnique.mockResolvedValue(dbTeam);
    mockSpeciesGet.mockReturnValue({ exists: false });
    mockCoverage.mockReturnValue(emptyCoverage);
    mockThreats.mockResolvedValue([]);
    mockSynergy.mockReturnValue(0);

    const result = await analyzeTeam("team-1");

    // Should still return a valid analysis object
    expect(result).toHaveProperty("coverage");
    expect(result).toHaveProperty("synergyScore");
  });

  it("maps nullable move fields to undefined", async () => {
    const slot = makeDbSlot(1, "pikachu");
    slot.move3 = null;
    slot.move4 = null;

    const dbTeam = {
      id: "team-1",
      formatId: "gen9ou",
      slots: [slot],
    };

    mockTeamFindUnique.mockResolvedValue(dbTeam);
    mockSpeciesGet.mockReturnValue(
      makeDexSpecies("pikachu", "Pikachu", ["Electric"])
    );
    mockCoverage.mockReturnValue(emptyCoverage);
    mockThreats.mockResolvedValue([]);
    mockSynergy.mockReturnValue(50);

    await analyzeTeam("team-1");

    const slotArg = mockCoverage.mock.calls[0][0][0];
    expect(slotArg.moves[2]).toBeUndefined();
    expect(slotArg.moves[3]).toBeUndefined();
  });
});
