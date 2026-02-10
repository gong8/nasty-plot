import { fetchSmogonSets, getSetsForPokemon, getAllSetsForFormat } from "../smogon-sets.service";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@nasty-plot/db", () => ({
  prisma: {
    smogonSet: {
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
    dataSyncLog: {
      upsert: vi.fn(),
    },
  },
}));

import { prisma } from "@nasty-plot/db";

const mockSetUpsert = prisma.smogonSet.upsert as ReturnType<typeof vi.fn>;
const mockSetFindMany = prisma.smogonSet.findMany as ReturnType<typeof vi.fn>;
const mockSyncLogUpsert = prisma.dataSyncLog.upsert as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDbSetRow(overrides?: Record<string, unknown>) {
  return {
    pokemonId: "garchomp",
    setName: "Swords Dance",
    ability: "Rough Skin",
    item: "Leftovers",
    nature: "Jolly",
    teraType: null,
    moves: JSON.stringify(["Earthquake", "Dragon Claw", "Swords Dance", "Scale Shot"]),
    evs: JSON.stringify({ atk: 252, spe: 252, spd: 4 }),
    ivs: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getSetsForPokemon", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns sets for a Pokemon in a format", async () => {
    mockSetFindMany.mockResolvedValue([makeDbSetRow()]);

    const result = await getSetsForPokemon("gen9ou", "garchomp");

    expect(result).toHaveLength(1);
    expect(result[0].pokemonId).toBe("garchomp");
    expect(result[0].setName).toBe("Swords Dance");
    expect(result[0].ability).toBe("Rough Skin");
    expect(result[0].nature).toBe("Jolly");
    expect(Array.isArray(result[0].moves)).toBe(true);
  });

  it("returns empty array when no sets exist", async () => {
    mockSetFindMany.mockResolvedValue([]);

    const result = await getSetsForPokemon("gen9ou", "unknown");

    expect(result).toEqual([]);
  });

  it("queries with correct formatId and pokemonId", async () => {
    mockSetFindMany.mockResolvedValue([]);

    await getSetsForPokemon("gen9ou", "garchomp");

    expect(mockSetFindMany).toHaveBeenCalledWith({
      where: { formatId: "gen9ou", pokemonId: "garchomp" },
    });
  });

  it("parses moves from JSON", async () => {
    mockSetFindMany.mockResolvedValue([makeDbSetRow()]);

    const result = await getSetsForPokemon("gen9ou", "garchomp");

    expect(result[0].moves).toEqual([
      "Earthquake", "Dragon Claw", "Swords Dance", "Scale Shot",
    ]);
  });

  it("parses EVs from JSON", async () => {
    mockSetFindMany.mockResolvedValue([makeDbSetRow()]);

    const result = await getSetsForPokemon("gen9ou", "garchomp");

    expect(result[0].evs).toEqual({ atk: 252, spe: 252, spd: 4 });
  });

  it("parses IVs from JSON when present", async () => {
    mockSetFindMany.mockResolvedValue([
      makeDbSetRow({ ivs: JSON.stringify({ atk: 0 }) }),
    ]);

    const result = await getSetsForPokemon("gen9ou", "garchomp");

    expect(result[0].ivs).toEqual({ atk: 0 });
  });

  it("returns undefined ivs when null", async () => {
    mockSetFindMany.mockResolvedValue([makeDbSetRow({ ivs: null })]);

    const result = await getSetsForPokemon("gen9ou", "garchomp");

    expect(result[0].ivs).toBeUndefined();
  });

  it("maps teraType when present", async () => {
    mockSetFindMany.mockResolvedValue([
      makeDbSetRow({ teraType: "Fairy" }),
    ]);

    const result = await getSetsForPokemon("gen9ou", "garchomp");

    expect(result[0].teraType).toBe("Fairy");
  });
});

describe("getAllSetsForFormat", () => {
  beforeEach(() => vi.clearAllMocks());

  it("groups sets by pokemonId", async () => {
    mockSetFindMany.mockResolvedValue([
      makeDbSetRow({ pokemonId: "garchomp", setName: "SD" }),
      makeDbSetRow({ pokemonId: "garchomp", setName: "Scarf" }),
      makeDbSetRow({ pokemonId: "heatran", setName: "Special Wall" }),
    ]);

    const result = await getAllSetsForFormat("gen9ou");

    expect(Object.keys(result)).toContain("garchomp");
    expect(Object.keys(result)).toContain("heatran");
    expect(result["garchomp"]).toHaveLength(2);
    expect(result["heatran"]).toHaveLength(1);
  });

  it("returns empty object when no sets exist", async () => {
    mockSetFindMany.mockResolvedValue([]);

    const result = await getAllSetsForFormat("gen9ou");

    expect(result).toEqual({});
  });
});

describe("fetchSmogonSets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("fetches sets and saves to DB", async () => {
    const mockJson = {
      Garchomp: {
        "Swords Dance": {
          ability: "Rough Skin",
          item: "Leftovers",
          nature: "Jolly",
          moves: ["Earthquake", "Dragon Claw", "Swords Dance", "Scale Shot"],
          evs: { atk: 252, spe: 252, spd: 4 },
        },
      },
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockJson),
    });
    vi.stubGlobal("fetch", mockFetch);

    mockSetUpsert.mockResolvedValue({});
    mockSyncLogUpsert.mockResolvedValue({});

    await fetchSmogonSets("gen9ou");

    expect(mockSetUpsert).toHaveBeenCalledTimes(1);
    expect(mockSyncLogUpsert).toHaveBeenCalled();
  });

  it("throws when fetch fails", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
    });
    vi.stubGlobal("fetch", mockFetch);

    await expect(fetchSmogonSets("gen9ou")).rejects.toThrow(
      "Failed to fetch sets"
    );
  });

  it("handles array fields (ability, item, nature)", async () => {
    const mockJson = {
      Garchomp: {
        "Mixed Set": {
          ability: ["Rough Skin", "Sand Veil"],
          item: ["Life Orb", "Choice Scarf"],
          nature: ["Jolly", "Adamant"],
          moves: ["Earthquake", ["Dragon Claw", "Outrage"]],
          evs: { atk: 252, spe: 252, spd: 4 },
        },
      },
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockJson),
    });
    vi.stubGlobal("fetch", mockFetch);

    mockSetUpsert.mockResolvedValue({});
    mockSyncLogUpsert.mockResolvedValue({});

    await fetchSmogonSets("gen9ou");

    // Should take first element of arrays
    expect(mockSetUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          ability: "Rough Skin",
          item: "Life Orb",
          nature: "Jolly",
        }),
      })
    );
  });

  it("handles teraType field", async () => {
    const mockJson = {
      Garchomp: {
        "Tera Set": {
          ability: "Rough Skin",
          item: "Leftovers",
          nature: "Jolly",
          teraType: "Fairy",
          moves: ["Earthquake"],
          evs: { atk: 252 },
        },
      },
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockJson),
    });
    vi.stubGlobal("fetch", mockFetch);

    mockSetUpsert.mockResolvedValue({});
    mockSyncLogUpsert.mockResolvedValue({});

    await fetchSmogonSets("gen9ou");

    expect(mockSetUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          teraType: "Fairy",
        }),
      })
    );
  });

  it("saves multiple Pokemon and sets", async () => {
    const mockJson = {
      Garchomp: {
        "SD": {
          ability: "Rough Skin",
          item: "Leftovers",
          nature: "Jolly",
          moves: ["Earthquake"],
          evs: {},
        },
        "Scarf": {
          ability: "Rough Skin",
          item: "Choice Scarf",
          nature: "Jolly",
          moves: ["Earthquake"],
          evs: {},
        },
      },
      Heatran: {
        "Wall": {
          ability: "Flash Fire",
          item: "Leftovers",
          nature: "Calm",
          moves: ["Lava Plume"],
          evs: {},
        },
      },
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockJson),
    });
    vi.stubGlobal("fetch", mockFetch);

    mockSetUpsert.mockResolvedValue({});
    mockSyncLogUpsert.mockResolvedValue({});

    await fetchSmogonSets("gen9ou");

    expect(mockSetUpsert).toHaveBeenCalledTimes(3);
  });
});
