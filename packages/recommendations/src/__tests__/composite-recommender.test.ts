import type { PokemonType } from "@nasty-plot/core";
import { getRecommendations } from "../composite-recommender";

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
    teammateCorr: {
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

vi.mock("../usage-recommender", () => ({
  getUsageBasedRecommendations: vi.fn(),
}));

vi.mock("../coverage-recommender", () => ({
  getCoverageBasedRecommendations: vi.fn(),
}));

import { prisma } from "@nasty-plot/db";
import { Dex } from "@pkmn/dex";
import { getUsageBasedRecommendations } from "../usage-recommender";
import { getCoverageBasedRecommendations } from "../coverage-recommender";

const mockTeamFindUnique = prisma.team.findUnique as ReturnType<typeof vi.fn>;
const mockSpeciesGet = Dex.species.get as ReturnType<typeof vi.fn>;
const mockUsageRecs = getUsageBasedRecommendations as ReturnType<typeof vi.fn>;
const mockCoverageRecs = getCoverageBasedRecommendations as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDbSlot(position: number, pokemonId: string) {
  return {
    position,
    pokemonId,
    ability: "Ability",
    item: "Leftovers",
    nature: "Hardy",
    teraType: null,
    level: 100,
    move1: "tackle",
    move2: null,
    move3: null,
    move4: null,
    evHp: 0,
    evAtk: 0,
    evDef: 0,
    evSpA: 0,
    evSpD: 0,
    evSpe: 0,
    ivHp: 31,
    ivAtk: 31,
    ivDef: 31,
    ivSpA: 31,
    ivSpD: 31,
    ivSpe: 31,
  };
}

function makeDexSpecies(id: string, name: string, types: string[]) {
  return {
    exists: true,
    name,
    num: 1,
    types,
    baseStats: { hp: 80, atk: 80, def: 80, spa: 80, spd: 80, spe: 80 },
    abilities: { "0": "Ability" },
    weightkg: 50,
  };
}

function makeDbTeam(slots: ReturnType<typeof makeDbSlot>[]) {
  return {
    id: "team-1",
    formatId: "gen9ou",
    slots,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getRecommendations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when team is not found", async () => {
    mockTeamFindUnique.mockResolvedValue(null);

    await expect(getRecommendations("nonexistent")).rejects.toThrow(
      "Team not found: nonexistent"
    );
  });

  it("loads team from prisma with slots", async () => {
    mockTeamFindUnique.mockResolvedValue(
      makeDbTeam([makeDbSlot(1, "pikachu")])
    );
    mockSpeciesGet.mockReturnValue(
      makeDexSpecies("pikachu", "Pikachu", ["Electric"])
    );
    mockUsageRecs.mockResolvedValue([]);
    mockCoverageRecs.mockResolvedValue([]);

    await getRecommendations("team-1");

    expect(mockTeamFindUnique).toHaveBeenCalledWith({
      where: { id: "team-1" },
      include: { slots: true },
    });
  });

  it("calls both usage and coverage recommenders", async () => {
    mockTeamFindUnique.mockResolvedValue(
      makeDbTeam([makeDbSlot(1, "garchomp")])
    );
    mockSpeciesGet.mockReturnValue(
      makeDexSpecies("garchomp", "Garchomp", ["Dragon", "Ground"])
    );
    mockUsageRecs.mockResolvedValue([]);
    mockCoverageRecs.mockResolvedValue([]);

    await getRecommendations("team-1");

    expect(mockUsageRecs).toHaveBeenCalledTimes(1);
    expect(mockCoverageRecs).toHaveBeenCalledTimes(1);
  });

  it("passes teamPokemonIds to usage recommender", async () => {
    mockTeamFindUnique.mockResolvedValue(
      makeDbTeam([makeDbSlot(1, "garchomp"), makeDbSlot(2, "heatran")])
    );
    mockSpeciesGet.mockImplementation((id: string) => {
      if (id === "garchomp") return makeDexSpecies("garchomp", "Garchomp", ["Dragon", "Ground"]);
      if (id === "heatran") return makeDexSpecies("heatran", "Heatran", ["Fire", "Steel"]);
      return { exists: false };
    });
    mockUsageRecs.mockResolvedValue([]);
    mockCoverageRecs.mockResolvedValue([]);

    await getRecommendations("team-1");

    expect(mockUsageRecs).toHaveBeenCalledWith(
      ["garchomp", "heatran"],
      "gen9ou",
      20
    );
  });

  it("passes converted slots to coverage recommender", async () => {
    mockTeamFindUnique.mockResolvedValue(
      makeDbTeam([makeDbSlot(1, "pikachu")])
    );
    mockSpeciesGet.mockReturnValue(
      makeDexSpecies("pikachu", "Pikachu", ["Electric"])
    );
    mockUsageRecs.mockResolvedValue([]);
    mockCoverageRecs.mockResolvedValue([]);

    await getRecommendations("team-1");

    const coverageArgs = mockCoverageRecs.mock.calls[0];
    expect(coverageArgs[0]).toHaveLength(1);
    expect(coverageArgs[0][0].pokemonId).toBe("pikachu");
    expect(coverageArgs[1]).toBe("gen9ou");
    expect(coverageArgs[2]).toBe(20);
  });

  describe("score merging", () => {
    it("applies default weights (0.6 usage, 0.4 coverage)", async () => {
      mockTeamFindUnique.mockResolvedValue(
        makeDbTeam([makeDbSlot(1, "pikachu")])
      );
      mockSpeciesGet.mockReturnValue(
        makeDexSpecies("pikachu", "Pikachu", ["Electric"])
      );

      mockUsageRecs.mockResolvedValue([
        { pokemonId: "heatran", pokemonName: "Heatran", score: 80, reasons: [
          { type: "usage", description: "Used with Pikachu", weight: 40 },
        ]},
      ]);
      mockCoverageRecs.mockResolvedValue([
        { pokemonId: "heatran", pokemonName: "Heatran", score: 60, reasons: [
          { type: "coverage", description: "Covers gaps", weight: 30 },
        ]},
      ]);

      const result = await getRecommendations("team-1");

      const rec = result.find((r) => r.pokemonId === "heatran");
      expect(rec).toBeDefined();
      expect(rec!.score).toBe(72);
    });

    it("applies custom weights when provided", async () => {
      mockTeamFindUnique.mockResolvedValue(
        makeDbTeam([makeDbSlot(1, "pikachu")])
      );
      mockSpeciesGet.mockReturnValue(
        makeDexSpecies("pikachu", "Pikachu", ["Electric"])
      );

      mockUsageRecs.mockResolvedValue([
        { pokemonId: "heatran", pokemonName: "Heatran", score: 80, reasons: [] },
      ]);
      mockCoverageRecs.mockResolvedValue([
        { pokemonId: "heatran", pokemonName: "Heatran", score: 60, reasons: [] },
      ]);

      const result = await getRecommendations("team-1", 10, {
        usage: 0.3,
        coverage: 0.7,
      });

      const rec = result.find((r) => r.pokemonId === "heatran");
      expect(rec).toBeDefined();
      expect(rec!.score).toBe(66);
    });

    it("handles Pokemon appearing only in usage recs", async () => {
      mockTeamFindUnique.mockResolvedValue(
        makeDbTeam([makeDbSlot(1, "pikachu")])
      );
      mockSpeciesGet.mockReturnValue(
        makeDexSpecies("pikachu", "Pikachu", ["Electric"])
      );

      mockUsageRecs.mockResolvedValue([
        { pokemonId: "clefable", pokemonName: "Clefable", score: 50, reasons: [
          { type: "usage", description: "Used with Pikachu", weight: 25 },
        ]},
      ]);
      mockCoverageRecs.mockResolvedValue([]);

      const result = await getRecommendations("team-1");

      const rec = result.find((r) => r.pokemonId === "clefable");
      expect(rec).toBeDefined();
      expect(rec!.score).toBe(30);
    });

    it("handles Pokemon appearing only in coverage recs", async () => {
      mockTeamFindUnique.mockResolvedValue(
        makeDbTeam([makeDbSlot(1, "pikachu")])
      );
      mockSpeciesGet.mockReturnValue(
        makeDexSpecies("pikachu", "Pikachu", ["Electric"])
      );

      mockUsageRecs.mockResolvedValue([]);
      mockCoverageRecs.mockResolvedValue([
        { pokemonId: "garchomp", pokemonName: "Garchomp", score: 90, reasons: [
          { type: "coverage", description: "Covers gaps", weight: 45 },
        ]},
      ]);

      const result = await getRecommendations("team-1");

      const rec = result.find((r) => r.pokemonId === "garchomp");
      expect(rec).toBeDefined();
      expect(rec!.score).toBe(36);
    });

    it("merges reasons from both recommenders", async () => {
      mockTeamFindUnique.mockResolvedValue(
        makeDbTeam([makeDbSlot(1, "pikachu")])
      );
      mockSpeciesGet.mockReturnValue(
        makeDexSpecies("pikachu", "Pikachu", ["Electric"])
      );

      mockUsageRecs.mockResolvedValue([
        { pokemonId: "heatran", pokemonName: "Heatran", score: 80, reasons: [
          { type: "usage", description: "Usage reason", weight: 40 },
        ]},
      ]);
      mockCoverageRecs.mockResolvedValue([
        { pokemonId: "heatran", pokemonName: "Heatran", score: 60, reasons: [
          { type: "coverage", description: "Coverage reason", weight: 30 },
        ]},
      ]);

      const result = await getRecommendations("team-1");

      const rec = result.find((r) => r.pokemonId === "heatran");
      expect(rec).toBeDefined();
      expect(rec!.reasons).toHaveLength(2);

      const reasonTypes = rec!.reasons.map((r) => r.type);
      expect(reasonTypes).toContain("usage");
      expect(reasonTypes).toContain("coverage");
    });

    it("caps composite score at 100", async () => {
      mockTeamFindUnique.mockResolvedValue(
        makeDbTeam([makeDbSlot(1, "pikachu")])
      );
      mockSpeciesGet.mockReturnValue(
        makeDexSpecies("pikachu", "Pikachu", ["Electric"])
      );

      mockUsageRecs.mockResolvedValue([
        { pokemonId: "superMon", pokemonName: "SuperMon", score: 100, reasons: [] },
      ]);
      mockCoverageRecs.mockResolvedValue([
        { pokemonId: "superMon", pokemonName: "SuperMon", score: 100, reasons: [] },
      ]);

      const result = await getRecommendations("team-1");

      const rec = result.find((r) => r.pokemonId === "superMon");
      expect(rec).toBeDefined();
      expect(rec!.score).toBeLessThanOrEqual(100);
    });
  });

  it("returns results sorted by composite score descending", async () => {
    mockTeamFindUnique.mockResolvedValue(
      makeDbTeam([makeDbSlot(1, "pikachu")])
    );
    mockSpeciesGet.mockReturnValue(
      makeDexSpecies("pikachu", "Pikachu", ["Electric"])
    );

    mockUsageRecs.mockResolvedValue([
      { pokemonId: "a", pokemonName: "A", score: 90, reasons: [] },
      { pokemonId: "b", pokemonName: "B", score: 50, reasons: [] },
      { pokemonId: "c", pokemonName: "C", score: 70, reasons: [] },
    ]);
    mockCoverageRecs.mockResolvedValue([
      { pokemonId: "a", pokemonName: "A", score: 30, reasons: [] },
      { pokemonId: "b", pokemonName: "B", score: 80, reasons: [] },
      { pokemonId: "c", pokemonName: "C", score: 50, reasons: [] },
    ]);

    const result = await getRecommendations("team-1");

    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].score).toBeGreaterThanOrEqual(result[i].score);
    }
  });

  it("respects the limit parameter", async () => {
    mockTeamFindUnique.mockResolvedValue(
      makeDbTeam([makeDbSlot(1, "pikachu")])
    );
    mockSpeciesGet.mockReturnValue(
      makeDexSpecies("pikachu", "Pikachu", ["Electric"])
    );

    const usageRecs = Array.from({ length: 15 }, (_, i) => ({
      pokemonId: `mon-${i}`,
      pokemonName: `Mon${i}`,
      score: 50 + i,
      reasons: [],
    }));

    mockUsageRecs.mockResolvedValue(usageRecs);
    mockCoverageRecs.mockResolvedValue([]);

    const result = await getRecommendations("team-1", 5);
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it("defaults to limit of 10", async () => {
    mockTeamFindUnique.mockResolvedValue(
      makeDbTeam([makeDbSlot(1, "pikachu")])
    );
    mockSpeciesGet.mockReturnValue(
      makeDexSpecies("pikachu", "Pikachu", ["Electric"])
    );

    const usageRecs = Array.from({ length: 20 }, (_, i) => ({
      pokemonId: `mon-${i}`,
      pokemonName: `Mon${i}`,
      score: 90 - i,
      reasons: [],
    }));

    mockUsageRecs.mockResolvedValue(usageRecs);
    mockCoverageRecs.mockResolvedValue([]);

    const result = await getRecommendations("team-1");
    expect(result.length).toBeLessThanOrEqual(10);
  });

  it("returns empty array when both sub-recommenders return nothing", async () => {
    mockTeamFindUnique.mockResolvedValue(
      makeDbTeam([makeDbSlot(1, "pikachu")])
    );
    mockSpeciesGet.mockReturnValue(
      makeDexSpecies("pikachu", "Pikachu", ["Electric"])
    );

    mockUsageRecs.mockResolvedValue([]);
    mockCoverageRecs.mockResolvedValue([]);

    const result = await getRecommendations("team-1");
    expect(result).toEqual([]);
  });

  it("correctly maps DB slots to TeamSlotData with species hydration", async () => {
    const slot = makeDbSlot(1, "garchomp");
    slot.ability = "Rough Skin";
    slot.item = "Choice Scarf";
    slot.nature = "Jolly";
    slot.teraType = "Fire";
    slot.evAtk = 252;
    slot.evSpe = 252;
    slot.evHp = 4;

    mockTeamFindUnique.mockResolvedValue(makeDbTeam([slot]));
    mockSpeciesGet.mockReturnValue(
      makeDexSpecies("garchomp", "Garchomp", ["Dragon", "Ground"])
    );
    mockUsageRecs.mockResolvedValue([]);
    mockCoverageRecs.mockResolvedValue([]);

    await getRecommendations("team-1");

    const coverageCall = mockCoverageRecs.mock.calls[0];
    const mappedSlots = coverageCall[0];
    expect(mappedSlots).toHaveLength(1);
    expect(mappedSlots[0].pokemonId).toBe("garchomp");
    expect(mappedSlots[0].species?.types).toEqual(["Dragon", "Ground"]);
    expect(mappedSlots[0].ability).toBe("Rough Skin");
    expect(mappedSlots[0].item).toBe("Choice Scarf");
    expect(mappedSlots[0].nature).toBe("Jolly");
    expect(mappedSlots[0].teraType).toBe("Fire");
    expect(mappedSlots[0].evs.atk).toBe(252);
    expect(mappedSlots[0].evs.spe).toBe(252);
  });

  it("returns correctly shaped Recommendation objects", async () => {
    mockTeamFindUnique.mockResolvedValue(
      makeDbTeam([makeDbSlot(1, "pikachu")])
    );
    mockSpeciesGet.mockReturnValue(
      makeDexSpecies("pikachu", "Pikachu", ["Electric"])
    );

    mockUsageRecs.mockResolvedValue([
      { pokemonId: "heatran", pokemonName: "Heatran", score: 60, reasons: [
        { type: "usage", description: "Common teammate", weight: 30 },
      ]},
    ]);
    mockCoverageRecs.mockResolvedValue([]);

    const result = await getRecommendations("team-1");

    expect(result.length).toBeGreaterThan(0);
    const rec = result[0];
    expect(rec).toHaveProperty("pokemonId");
    expect(rec).toHaveProperty("pokemonName");
    expect(rec).toHaveProperty("score");
    expect(rec).toHaveProperty("reasons");
    expect(typeof rec.pokemonId).toBe("string");
    expect(typeof rec.pokemonName).toBe("string");
    expect(typeof rec.score).toBe("number");
    expect(Array.isArray(rec.reasons)).toBe(true);
  });
});
