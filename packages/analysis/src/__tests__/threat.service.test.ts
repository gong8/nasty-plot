import type { TeamSlotData, PokemonType, StatsTable } from "@nasty-plot/core";
import { identifyThreats } from "../threat.service";

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
    },
  },
}));

import { prisma } from "@nasty-plot/db";
import { Dex } from "@pkmn/dex";

const mockUsageFindMany = prisma.usageStats.findMany as ReturnType<typeof vi.fn>;
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
      name: pokemonId.charAt(0).toUpperCase() + pokemonId.slice(1),
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

function mockSpeciesData(id: string, types: string[]) {
  return {
    exists: true,
    name: id.charAt(0).toUpperCase() + id.slice(1),
    types,
    num: 1,
    baseStats: defaultStats,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("identifyThreats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when no usage data exists", async () => {
    mockUsageFindMany.mockResolvedValue([]);

    const result = await identifyThreats(
      [makeSlot("garchomp", ["Dragon", "Ground"])],
      "gen9ou"
    );

    expect(result).toEqual([]);
  });

  it("excludes team members from threats", async () => {
    mockUsageFindMany.mockResolvedValue([
      { pokemonId: "garchomp", usagePercent: 25, rank: 1 },
      { pokemonId: "heatran", usagePercent: 20, rank: 2 },
    ]);

    mockSpeciesGet.mockImplementation((id: string) => {
      if (id === "heatran") return mockSpeciesData("heatran", ["Fire", "Steel"]);
      return { exists: false };
    });

    const result = await identifyThreats(
      [makeSlot("garchomp", ["Dragon", "Ground"])],
      "gen9ou"
    );

    const ids = result.map((t) => t.pokemonId);
    expect(ids).not.toContain("garchomp");
  });

  it("identifies threats that exploit team weaknesses", async () => {
    // Team of two Water types - weak to Electric and Grass
    const team = [
      makeSlot("vaporeon", ["Water"]),
      makeSlot("starmie", ["Water", "Psychic"]),
    ];

    mockUsageFindMany.mockResolvedValue([
      { pokemonId: "raikou", usagePercent: 15, rank: 1 },
    ]);

    mockSpeciesGet.mockImplementation((id: string) => {
      if (id === "raikou") return mockSpeciesData("raikou", ["Electric"]);
      return { exists: false };
    });

    const result = await identifyThreats(team, "gen9ou");

    expect(result.length).toBeGreaterThan(0);
    const raikouThreat = result.find((t) => t.pokemonId === "raikou");
    expect(raikouThreat).toBeDefined();
    expect(raikouThreat!.reason).toContain("Electric");
  });

  it("assigns threat levels based on score", async () => {
    const team = [
      makeSlot("vaporeon", ["Water"]),
      makeSlot("blastoise", ["Water"]),
      makeSlot("starmie", ["Water", "Psychic"]),
    ];

    mockUsageFindMany.mockResolvedValue([
      { pokemonId: "raikou", usagePercent: 20, rank: 1 },
    ]);

    mockSpeciesGet.mockImplementation((id: string) => {
      if (id === "raikou") return mockSpeciesData("raikou", ["Electric"]);
      return { exists: false };
    });

    const result = await identifyThreats(team, "gen9ou");

    if (result.length > 0) {
      expect(["high", "medium", "low"]).toContain(result[0].threatLevel);
    }
  });

  it("sorts threats by level then usage", async () => {
    const team = [makeSlot("pikachu", ["Electric"])];

    mockUsageFindMany.mockResolvedValue([
      { pokemonId: "garchomp", usagePercent: 25, rank: 1 },
      { pokemonId: "excadrill", usagePercent: 15, rank: 2 },
      { pokemonId: "landorus", usagePercent: 20, rank: 3 },
    ]);

    mockSpeciesGet.mockImplementation((id: string) => {
      if (id === "garchomp") return mockSpeciesData("garchomp", ["Dragon", "Ground"]);
      if (id === "excadrill") return mockSpeciesData("excadrill", ["Ground", "Steel"]);
      if (id === "landorus") return mockSpeciesData("landorus", ["Ground", "Flying"]);
      return { exists: false };
    });

    const result = await identifyThreats(team, "gen9ou");

    // Results should be sorted
    if (result.length > 1) {
      const levelOrder = { high: 0, medium: 1, low: 2 };
      for (let i = 1; i < result.length; i++) {
        const prevLevel = levelOrder[result[i - 1].threatLevel];
        const currLevel = levelOrder[result[i].threatLevel];
        if (prevLevel === currLevel) {
          expect(result[i - 1].usagePercent).toBeGreaterThanOrEqual(result[i].usagePercent);
        } else {
          expect(prevLevel).toBeLessThanOrEqual(currLevel);
        }
      }
    }
  });

  it("limits results to 20", async () => {
    const team = [makeSlot("pikachu", ["Electric"])];

    const entries = Array.from({ length: 50 }, (_, i) => ({
      pokemonId: `mon-${i}`,
      usagePercent: 50 - i,
      rank: i + 1,
    }));

    mockUsageFindMany.mockResolvedValue(entries);
    mockSpeciesGet.mockImplementation((id: string) => {
      return mockSpeciesData(id, ["Ground"]);
    });

    const result = await identifyThreats(team, "gen9ou");

    expect(result.length).toBeLessThanOrEqual(20);
  });

  it("skips species that don't exist in Dex", async () => {
    const team = [makeSlot("pikachu", ["Electric"])];

    mockUsageFindMany.mockResolvedValue([
      { pokemonId: "fakemon", usagePercent: 30, rank: 1 },
    ]);

    mockSpeciesGet.mockReturnValue({ exists: false });

    const result = await identifyThreats(team, "gen9ou");

    const ids = result.map((t) => t.pokemonId);
    expect(ids).not.toContain("fakemon");
  });

  it("returns correctly shaped ThreatEntry objects", async () => {
    const team = [makeSlot("pikachu", ["Electric"])];

    mockUsageFindMany.mockResolvedValue([
      { pokemonId: "garchomp", usagePercent: 25, rank: 1 },
    ]);

    mockSpeciesGet.mockImplementation((id: string) => {
      if (id === "garchomp") return mockSpeciesData("garchomp", ["Dragon", "Ground"]);
      return { exists: false };
    });

    const result = await identifyThreats(team, "gen9ou");

    if (result.length > 0) {
      const threat = result[0];
      expect(threat).toHaveProperty("pokemonId");
      expect(threat).toHaveProperty("pokemonName");
      expect(threat).toHaveProperty("usagePercent");
      expect(threat).toHaveProperty("threatLevel");
      expect(threat).toHaveProperty("reason");
      expect(typeof threat.pokemonName).toBe("string");
      expect(typeof threat.usagePercent).toBe("number");
    }
  });
});
