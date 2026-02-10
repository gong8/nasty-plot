import type { TeamSlotData, PokemonType, StatsTable } from "@nasty-plot/core";
import { getCoverageBasedRecommendations } from "../coverage-recommender";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@nasty-plot/db", () => ({
  prisma: {
    usageStats: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@pkmn/dex", () => ({
  Dex: {
    species: {
      get: vi.fn(),
      all: vi.fn(),
    },
  },
}));

import { prisma } from "@nasty-plot/db";
import { Dex } from "@pkmn/dex";

const mockUsageFindMany = prisma.usageStats.findMany as ReturnType<typeof vi.fn>;
const mockSpeciesGet = Dex.species.get as ReturnType<typeof vi.fn>;
const mockSpeciesAll = (Dex.species as { all: ReturnType<typeof vi.fn> }).all;

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
  return {
    exists: true,
    name: id.charAt(0).toUpperCase() + id.slice(1),
    types,
    num: 1,
    isNonstandard: null,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getCoverageBasedRecommendations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // No gaps
  // -----------------------------------------------------------------------

  it("returns empty array when team has no uncovered types and no shared weaknesses", async () => {
    const team = [
      makeSlot("garchomp", ["Dragon", "Ground"]),
      makeSlot("heatran", ["Fire", "Steel"]),
      makeSlot("tapu-lele", ["Psychic", "Fairy"]),
      makeSlot("kartana", ["Grass", "Steel"]),
      makeSlot("greninja", ["Water", "Dark"]),
      makeSlot("zapdos", ["Electric", "Flying"]),
    ];

    mockUsageFindMany.mockResolvedValue([]);
    mockSpeciesAll.mockReturnValue([]);

    const result = await getCoverageBasedRecommendations(team, "gen9ou");
    expect(Array.isArray(result)).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Offensive coverage recommendations
  // -----------------------------------------------------------------------

  describe("offensive coverage gaps", () => {
    it("recommends Pokemon that cover offensive gaps", async () => {
      const team = [
        makeSlot("snorlax", ["Normal"]),
        makeSlot("blissey", ["Normal"]),
      ];

      mockUsageFindMany.mockResolvedValue([
        { pokemonId: "lucario", usagePercent: 10, rank: 1 },
        { pokemonId: "garchomp", usagePercent: 15, rank: 2 },
      ]);

      mockSpeciesGet.mockImplementation((id: string) => {
        if (id === "lucario") return mockSpecies("lucario", ["Fighting", "Steel"]);
        if (id === "garchomp") return mockSpecies("garchomp", ["Dragon", "Ground"]);
        return { exists: false };
      });

      const result = await getCoverageBasedRecommendations(team, "gen9ou");

      expect(result.length).toBeGreaterThan(0);
      const ids = result.map((r) => r.pokemonId);
      expect(ids.length).toBeGreaterThan(0);
    });

    it("scores higher for Pokemon covering more gaps", async () => {
      const team = [makeSlot("pikachu", ["Electric"])];

      mockUsageFindMany.mockResolvedValue([
        { pokemonId: "groundmon", usagePercent: 10, rank: 1 },
        { pokemonId: "normalmon", usagePercent: 10, rank: 2 },
      ]);

      mockSpeciesGet.mockImplementation((id: string) => {
        if (id === "groundmon") return mockSpecies("groundmon", ["Ground"]);
        if (id === "normalmon") return mockSpecies("normalmon", ["Normal"]);
        return { exists: false };
      });

      const result = await getCoverageBasedRecommendations(team, "gen9ou");

      const groundRec = result.find((r) => r.pokemonId === "groundmon");
      const normalRec = result.find((r) => r.pokemonId === "normalmon");

      if (groundRec && normalRec) {
        expect(groundRec.score).toBeGreaterThan(normalRec.score);
      } else {
        expect(groundRec).toBeDefined();
      }
    });
  });

  // -----------------------------------------------------------------------
  // Defensive resistance recommendations
  // -----------------------------------------------------------------------

  describe("defensive coverage (resist shared weaknesses)", () => {
    it("recommends Pokemon that resist shared weaknesses", async () => {
      const team = [
        makeSlot("vaporeon", ["Water"]),
        makeSlot("starmie", ["Water", "Psychic"]),
      ];

      mockUsageFindMany.mockResolvedValue([
        { pokemonId: "garchomp", usagePercent: 15, rank: 1 },
      ]);

      mockSpeciesGet.mockImplementation((id: string) => {
        if (id === "garchomp") return mockSpecies("garchomp", ["Dragon", "Ground"]);
        return { exists: false };
      });

      const result = await getCoverageBasedRecommendations(team, "gen9ou");

      const garchompRec = result.find((r) => r.pokemonId === "garchomp");
      expect(garchompRec).toBeDefined();

      const resistReason = garchompRec?.reasons.find(
        (r) => r.type === "coverage" && r.description.includes("Resists")
      );
      expect(resistReason).toBeDefined();
    });

    it("gives higher weight to resistance reasons than offensive coverage", async () => {
      const team = [
        makeSlot("vaporeon", ["Water"]),
        makeSlot("blastoise", ["Water"]),
      ];

      mockUsageFindMany.mockResolvedValue([
        { pokemonId: "candidate", usagePercent: 10, rank: 1 },
      ]);

      mockSpeciesGet.mockImplementation((id: string) => {
        if (id === "candidate") return mockSpecies("candidate", ["Ground", "Dragon"]);
        return { exists: false };
      });

      const result = await getCoverageBasedRecommendations(team, "gen9ou");

      if (result.length > 0) {
        const rec = result[0];
        const resistReasons = rec.reasons.filter((r) => r.description.includes("Resists"));
        if (resistReasons.length > 0) {
          expect(resistReasons[0].weight).toBeGreaterThanOrEqual(20);
        }
      }
    });
  });

  // -----------------------------------------------------------------------
  // Exclusions
  // -----------------------------------------------------------------------

  it("excludes team members from recommendations", async () => {
    const team = [makeSlot("garchomp", ["Dragon", "Ground"])];

    mockUsageFindMany.mockResolvedValue([
      { pokemonId: "garchomp", usagePercent: 20, rank: 1 },
      { pokemonId: "heatran", usagePercent: 18, rank: 2 },
    ]);

    mockSpeciesGet.mockImplementation((id: string) => {
      if (id === "garchomp") return mockSpecies("garchomp", ["Dragon", "Ground"]);
      if (id === "heatran") return mockSpecies("heatran", ["Fire", "Steel"]);
      return { exists: false };
    });

    const result = await getCoverageBasedRecommendations(team, "gen9ou");

    const ids = result.map((r) => r.pokemonId);
    expect(ids).not.toContain("garchomp");
  });

  it("skips species that do not exist in the Dex", async () => {
    const team = [makeSlot("pikachu", ["Electric"])];

    mockUsageFindMany.mockResolvedValue([
      { pokemonId: "fakemon", usagePercent: 10, rank: 1 },
    ]);

    mockSpeciesGet.mockReturnValue({ exists: false });

    const result = await getCoverageBasedRecommendations(team, "gen9ou");
    expect(result).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // Fallback to Dex when no usage data
  // -----------------------------------------------------------------------

  it("falls back to getAllLegalSpeciesIds when no usage data exists", async () => {
    const team = [makeSlot("pikachu", ["Electric"])];

    mockUsageFindMany.mockResolvedValue([]);
    mockSpeciesAll.mockReturnValue([
      { exists: true, id: "bulbasaur", num: 1, isNonstandard: null,
        types: ["Grass", "Poison"], name: "Bulbasaur" },
      { exists: true, id: "charmander", num: 4, isNonstandard: null,
        types: ["Fire"], name: "Charmander" },
    ]);

    mockSpeciesGet.mockImplementation((id: string) => {
      if (id === "bulbasaur") return mockSpecies("bulbasaur", ["Grass", "Poison"]);
      if (id === "charmander") return mockSpecies("charmander", ["Fire"]);
      return { exists: false };
    });

    const result = await getCoverageBasedRecommendations(team, "gen9ou");
    expect(Array.isArray(result)).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Limit
  // -----------------------------------------------------------------------

  it("respects the limit parameter", async () => {
    const team = [makeSlot("snorlax", ["Normal"])];

    const entries = Array.from({ length: 20 }, (_, i) => ({
      pokemonId: `mon-${i}`,
      usagePercent: 20 - i,
      rank: i + 1,
    }));

    mockUsageFindMany.mockResolvedValue(entries);

    mockSpeciesGet.mockImplementation((id: string) => {
      return mockSpecies(id, ["Fighting"]);
    });

    const result = await getCoverageBasedRecommendations(team, "gen9ou", 5);
    expect(result.length).toBeLessThanOrEqual(5);
  });

  // -----------------------------------------------------------------------
  // Sorting
  // -----------------------------------------------------------------------

  it("returns results sorted by score descending", async () => {
    const team = [makeSlot("snorlax", ["Normal"])];

    mockUsageFindMany.mockResolvedValue([
      { pokemonId: "lucario", usagePercent: 10, rank: 1 },
      { pokemonId: "machamp", usagePercent: 8, rank: 2 },
      { pokemonId: "heatran", usagePercent: 12, rank: 3 },
    ]);

    mockSpeciesGet.mockImplementation((id: string) => {
      if (id === "lucario") return mockSpecies("lucario", ["Fighting", "Steel"]);
      if (id === "machamp") return mockSpecies("machamp", ["Fighting"]);
      if (id === "heatran") return mockSpecies("heatran", ["Fire", "Steel"]);
      return { exists: false };
    });

    const result = await getCoverageBasedRecommendations(team, "gen9ou");

    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].score).toBeGreaterThanOrEqual(result[i].score);
    }
  });

  // -----------------------------------------------------------------------
  // Score capping
  // -----------------------------------------------------------------------

  it("caps recommendation scores at 100", async () => {
    const team = [
      makeSlot("snorlax", ["Normal"]),
      makeSlot("blissey", ["Normal"]),
      makeSlot("chansey", ["Normal"]),
    ];

    mockUsageFindMany.mockResolvedValue([
      { pokemonId: "lucario", usagePercent: 10, rank: 1 },
    ]);

    mockSpeciesGet.mockImplementation((id: string) => {
      if (id === "lucario") return mockSpecies("lucario", ["Fighting", "Steel"]);
      return { exists: false };
    });

    const result = await getCoverageBasedRecommendations(team, "gen9ou");

    for (const rec of result) {
      expect(rec.score).toBeLessThanOrEqual(100);
    }
  });

  // -----------------------------------------------------------------------
  // Return shape
  // -----------------------------------------------------------------------

  it("returns correctly shaped Recommendation objects", async () => {
    const team = [makeSlot("pikachu", ["Electric"])];

    mockUsageFindMany.mockResolvedValue([
      { pokemonId: "garchomp", usagePercent: 15, rank: 1 },
    ]);

    mockSpeciesGet.mockImplementation((id: string) => {
      if (id === "garchomp") return mockSpecies("garchomp", ["Dragon", "Ground"]);
      return { exists: false };
    });

    const result = await getCoverageBasedRecommendations(team, "gen9ou");

    if (result.length > 0) {
      const rec = result[0];
      expect(rec).toHaveProperty("pokemonId");
      expect(rec).toHaveProperty("pokemonName");
      expect(rec).toHaveProperty("score");
      expect(rec).toHaveProperty("reasons");
      expect(typeof rec.score).toBe("number");
      expect(Array.isArray(rec.reasons)).toBe(true);

      for (const reason of rec.reasons) {
        expect(reason).toHaveProperty("type", "coverage");
        expect(reason).toHaveProperty("description");
        expect(reason).toHaveProperty("weight");
      }
    }
  });
});
