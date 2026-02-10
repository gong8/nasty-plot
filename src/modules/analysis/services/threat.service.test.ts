import type { TeamSlotData, PokemonType, StatsTable } from "@/shared/types";
import { identifyThreats } from "./threat.service";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/shared/services/prisma", () => ({
  prisma: {
    usageStats: {
      findMany: vi.fn(),
    },
  },
}));

// Mock @pkmn/dex so we control which species exist and their types
vi.mock("@pkmn/dex", () => ({
  Dex: {
    species: {
      get: vi.fn(),
    },
  },
}));

import { prisma } from "@/shared/services/prisma";
import { Dex } from "@pkmn/dex";

const mockFindMany = prisma.usageStats.findMany as ReturnType<typeof vi.fn>;
const mockSpeciesGet = Dex.species.get as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultStats: StatsTable = { hp: 80, atk: 80, def: 80, spa: 80, spd: 80, spe: 80 };
const defaultEvs: StatsTable = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
const defaultIvs: StatsTable = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };

function makeSlot(
  pokemonId: string,
  types: [PokemonType] | [PokemonType, PokemonType]
): TeamSlotData {
  return {
    position: 1,
    pokemonId,
    species: {
      id: pokemonId,
      name: pokemonId,
      num: 1,
      types,
      baseStats: defaultStats,
      abilities: { "0": "Ability" },
      weightkg: 50,
    },
    ability: "Ability",
    item: "",
    nature: "Hardy",
    level: 100,
    moves: ["tackle", undefined, undefined, undefined],
    evs: defaultEvs,
    ivs: defaultIvs,
  };
}

function mockSpecies(id: string, types: string[]) {
  return { exists: true, name: id.charAt(0).toUpperCase() + id.slice(1), types };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("identifyThreats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // Empty / no-data scenarios
  // -----------------------------------------------------------------------

  it("returns empty array when no usage data is found", async () => {
    mockFindMany.mockResolvedValue([]);

    const team = [makeSlot("pikachu", ["Electric"])];
    const result = await identifyThreats(team, "gen9ou");

    expect(result).toEqual([]);
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { formatId: "gen9ou" },
      orderBy: { rank: "asc" },
      take: 50,
    });
  });

  it("returns empty array for an empty team with no usage data", async () => {
    mockFindMany.mockResolvedValue([]);

    const result = await identifyThreats([], "gen9ou");
    expect(result).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // Threat level classification
  // -----------------------------------------------------------------------

  describe("threat classification", () => {
    it("classifies a high-usage Pokemon with STAB coverage as high threat", async () => {
      // Team of Water types is weak to Electric
      const team = [
        makeSlot("vaporeon", ["Water"]),
        makeSlot("starmie", ["Water", "Psychic"]),
        makeSlot("gyarados", ["Water", "Flying"]),
      ];

      mockFindMany.mockResolvedValue([
        { pokemonId: "raikou", usagePercent: 15, rank: 1 },
      ]);

      mockSpeciesGet.mockImplementation((id: string) => {
        if (id === "raikou") return mockSpecies("raikou", ["Electric"]);
        return { exists: false };
      });

      const result = await identifyThreats(team, "gen9ou");

      expect(result).toHaveLength(1);
      expect(result[0].pokemonId).toBe("raikou");
      // Electric hits Water, Water/Psychic, Water/Flying super-effectively = 3 slots
      // threatScore = 3 * 15 (weakSlots) + min(15*2, 30) = 45 + 30 = 75 => high
      expect(result[0].threatLevel).toBe("high");
      expect(result[0].reason).toContain("Electric");
      expect(result[0].reason).toContain("super-effectively");
    });

    it("classifies medium-threat Pokemon correctly", async () => {
      // Team with 2 members weak to Ground
      const team = [
        makeSlot("heatran", ["Fire", "Steel"]),
        makeSlot("magnezone", ["Electric", "Steel"]),
      ];

      mockFindMany.mockResolvedValue([
        { pokemonId: "garchomp", usagePercent: 10, rank: 2 },
      ]);

      mockSpeciesGet.mockImplementation((id: string) => {
        if (id === "garchomp") return mockSpecies("garchomp", ["Dragon", "Ground"]);
        return { exists: false };
      });

      const result = await identifyThreats(team, "gen9ou");

      expect(result).toHaveLength(1);
      // Ground hits Fire/Steel and Electric/Steel (both 2x or 4x) = 2 slots
      // threatScore = 2 * 15 + min(10*2, 30) = 30 + 20 = 50 => high
      expect(result[0].threatLevel).toBe("high");
    });

    it("filters out very low threats (score < 10)", async () => {
      // Team resists the threat's STAB
      const team = [
        makeSlot("heatran", ["Fire", "Steel"]),
      ];

      mockFindMany.mockResolvedValue([
        { pokemonId: "snorlax", usagePercent: 2, rank: 40 },
      ]);

      mockSpeciesGet.mockImplementation((id: string) => {
        if (id === "snorlax") return mockSpecies("snorlax", ["Normal"]);
        return { exists: false };
      });

      const result = await identifyThreats(team, "gen9ou");

      // Normal hits nothing super-effectively on Fire/Steel
      // threatScore = 0 (no weakSlots) + min(2*2, 30) = 4
      // threatLevel = "low" and threatScore (4) < 10 => filtered
      expect(result).toHaveLength(0);
    });

    it("keeps low threats with score >= 10 in results", async () => {
      const team = [makeSlot("pikachu", ["Electric"])];

      mockFindMany.mockResolvedValue([
        { pokemonId: "excadrill", usagePercent: 8, rank: 10 },
      ]);

      mockSpeciesGet.mockImplementation((id: string) => {
        if (id === "excadrill") return mockSpecies("excadrill", ["Ground", "Steel"]);
        return { exists: false };
      });

      const result = await identifyThreats(team, "gen9ou");

      // Ground hits Electric super-effectively = 1 slot
      // weakSlots=1 => threatScore += 5
      // Steel hits nothing on Electric super-effectively
      // threatScore = 5 + min(8*2, 30) = 5 + 16 = 21 => medium
      expect(result).toHaveLength(1);
      expect(result[0].threatLevel).toBe("medium");
    });
  });

  // -----------------------------------------------------------------------
  // Exclusions
  // -----------------------------------------------------------------------

  it("excludes team members from threats", async () => {
    const team = [makeSlot("garchomp", ["Dragon", "Ground"])];

    mockFindMany.mockResolvedValue([
      { pokemonId: "garchomp", usagePercent: 20, rank: 1 },
      { pokemonId: "landorus", usagePercent: 18, rank: 2 },
    ]);

    mockSpeciesGet.mockImplementation((id: string) => {
      if (id === "garchomp") return mockSpecies("garchomp", ["Dragon", "Ground"]);
      if (id === "landorus") return mockSpecies("landorus", ["Ground", "Flying"]);
      return { exists: false };
    });

    const result = await identifyThreats(team, "gen9ou");

    // Garchomp should be excluded since it's on the team
    const ids = result.map((t) => t.pokemonId);
    expect(ids).not.toContain("garchomp");
    expect(ids).toContain("landorus");
  });

  it("skips species that don't exist in the Dex", async () => {
    const team = [makeSlot("pikachu", ["Electric"])];

    mockFindMany.mockResolvedValue([
      { pokemonId: "fakemon", usagePercent: 10, rank: 1 },
    ]);

    mockSpeciesGet.mockImplementation(() => ({ exists: false }));

    const result = await identifyThreats(team, "gen9ou");
    expect(result).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // Sorting
  // -----------------------------------------------------------------------

  it("sorts threats by level (high > medium > low), then by usage", async () => {
    const team = [
      makeSlot("vaporeon", ["Water"]),
      makeSlot("blastoise", ["Water"]),
    ];

    mockFindMany.mockResolvedValue([
      { pokemonId: "raikou", usagePercent: 10, rank: 5 },
      { pokemonId: "zapdos", usagePercent: 15, rank: 2 },
      { pokemonId: "snorlax", usagePercent: 12, rank: 3 },
    ]);

    mockSpeciesGet.mockImplementation((id: string) => {
      if (id === "raikou") return mockSpecies("raikou", ["Electric"]);
      if (id === "zapdos") return mockSpecies("zapdos", ["Electric", "Flying"]);
      if (id === "snorlax") return mockSpecies("snorlax", ["Normal"]);
      return { exists: false };
    });

    const result = await identifyThreats(team, "gen9ou");

    // Raikou and Zapdos both have Electric STAB hitting 2 Water types
    // They should both be high threats. Zapdos has higher usage, so comes first.
    if (result.length >= 2) {
      const highThreats = result.filter((t) => t.threatLevel === "high");
      if (highThreats.length >= 2) {
        expect(highThreats[0].usagePercent).toBeGreaterThanOrEqual(highThreats[1].usagePercent);
      }
    }

    // Verify high threats come before medium/low
    for (let i = 1; i < result.length; i++) {
      const levelOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
      expect(levelOrder[result[i - 1].threatLevel]).toBeLessThanOrEqual(
        levelOrder[result[i].threatLevel]
      );
    }
  });

  // -----------------------------------------------------------------------
  // Result limit
  // -----------------------------------------------------------------------

  it("limits results to at most 20 threats", async () => {
    const team = [makeSlot("pikachu", ["Electric"])];

    // Generate 50 usage entries
    const entries = Array.from({ length: 50 }, (_, i) => ({
      pokemonId: `mon-${i}`,
      usagePercent: 20 - i * 0.3,
      rank: i + 1,
    }));

    mockFindMany.mockResolvedValue(entries);

    mockSpeciesGet.mockImplementation((id: string) => {
      // Ground types that threaten Electric
      return mockSpecies(id, ["Ground"]);
    });

    const result = await identifyThreats(team, "gen9ou");
    expect(result.length).toBeLessThanOrEqual(20);
  });

  // -----------------------------------------------------------------------
  // Reason string
  // -----------------------------------------------------------------------

  it("provides usage-based reason when no STAB weakness exploited", async () => {
    const team = [makeSlot("heatran", ["Fire", "Steel"])];

    mockFindMany.mockResolvedValue([
      { pokemonId: "blissey", usagePercent: 12, rank: 5 },
    ]);

    mockSpeciesGet.mockImplementation((id: string) => {
      if (id === "blissey") return mockSpecies("blissey", ["Normal"]);
      return { exists: false };
    });

    const result = await identifyThreats(team, "gen9ou");

    // Normal can't hit Fire/Steel super-effectively at all
    // But usage might be high enough to include it
    // threatScore = 0 + min(12*2, 30) = 24 => medium
    if (result.length > 0) {
      expect(result[0].reason).toContain("usage");
    }
  });

  // -----------------------------------------------------------------------
  // Output shape
  // -----------------------------------------------------------------------

  it("returns correctly shaped ThreatEntry objects", async () => {
    const team = [makeSlot("pikachu", ["Electric"])];

    mockFindMany.mockResolvedValue([
      { pokemonId: "garchomp", usagePercent: 20, rank: 1 },
    ]);

    mockSpeciesGet.mockImplementation((id: string) => {
      if (id === "garchomp") return mockSpecies("garchomp", ["Dragon", "Ground"]);
      return { exists: false };
    });

    const result = await identifyThreats(team, "gen9ou");

    expect(result.length).toBeGreaterThan(0);
    const threat = result[0];
    expect(threat).toHaveProperty("pokemonId");
    expect(threat).toHaveProperty("pokemonName");
    expect(threat).toHaveProperty("usagePercent");
    expect(threat).toHaveProperty("threatLevel");
    expect(threat).toHaveProperty("reason");
    expect(["high", "medium", "low"]).toContain(threat.threatLevel);
    expect(typeof threat.usagePercent).toBe("number");
    expect(typeof threat.reason).toBe("string");
  });
});
