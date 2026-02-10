import { fetchSmogonSets, getSetsForPokemon, getAllSetsForFormat } from "./smogon-sets.service";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/shared/services/prisma", () => ({
  prisma: {
    smogonSet: {
      upsert: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
    dataSyncLog: {
      upsert: vi.fn().mockResolvedValue({}),
    },
  },
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Pull mocked prisma for assertions
import { prisma } from "@/shared/services/prisma";
const mockedPrisma = vi.mocked(prisma, true);

// ---------------------------------------------------------------------------
// fetchSmogonSets
// ---------------------------------------------------------------------------

describe("fetchSmogonSets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches sets and upserts each set into the database", async () => {
    const fakeJson = {
      "Great Tusk": {
        "Bulky Spinner": {
          ability: "Protosynthesis",
          item: "Booster Energy",
          nature: "Jolly",
          moves: ["Headlong Rush", "Rapid Spin", "Ice Spinner", "Stealth Rock"],
          evs: { hp: 252, atk: 4, spe: 252 },
        },
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => fakeJson,
    });

    await fetchSmogonSets("gen9ou");

    // Should have called fetch with the correct URL
    expect(mockFetch).toHaveBeenCalledWith(
      "https://data.pkmn.cc/sets/gen9ou.json"
    );

    // Should upsert the one set
    expect(mockedPrisma.smogonSet.upsert).toHaveBeenCalledTimes(1);
    const upsertCall = vi.mocked(mockedPrisma.smogonSet.upsert).mock.calls[0][0];
    expect(upsertCall.where.formatId_pokemonId_setName).toEqual({
      formatId: "gen9ou",
      pokemonId: "greattusk",
      setName: "Bulky Spinner",
    });
    expect(upsertCall.create.ability).toBe("Protosynthesis");
    expect(upsertCall.create.item).toBe("Booster Energy");
    expect(upsertCall.create.nature).toBe("Jolly");
    expect(JSON.parse(upsertCall.create.moves as string)).toEqual([
      "Headlong Rush",
      "Rapid Spin",
      "Ice Spinner",
      "Stealth Rock",
    ]);
    expect(JSON.parse(upsertCall.create.evs as string)).toEqual({
      hp: 252,
      atk: 4,
      spe: 252,
    });

    // Should update sync log
    expect(mockedPrisma.dataSyncLog.upsert).toHaveBeenCalledTimes(1);
    const syncCall = vi.mocked(mockedPrisma.dataSyncLog.upsert).mock.calls[0][0];
    expect(syncCall.create.source).toBe("smogon-sets");
    expect(syncCall.create.formatId).toBe("gen9ou");
    expect(syncCall.create.status).toBe("success");
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
    });

    await expect(fetchSmogonSets("gen9ou")).rejects.toThrow(
      "Failed to fetch sets: 404 Not Found"
    );
  });

  it("normalizes array ability/item/nature to first element", async () => {
    const fakeJson = {
      Heatran: {
        "Offensive Set": {
          ability: ["Flash Fire", "Flame Body"],
          item: ["Leftovers", "Air Balloon"],
          nature: ["Timid", "Modest"],
          moves: ["Magma Storm", "Earth Power"],
          evs: { spa: 252, spe: 252, hp: 4 },
        },
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => fakeJson,
    });

    await fetchSmogonSets("gen9ou");

    const upsertCall = vi.mocked(mockedPrisma.smogonSet.upsert).mock.calls[0][0];
    expect(upsertCall.create.ability).toBe("Flash Fire");
    expect(upsertCall.create.item).toBe("Leftovers");
    expect(upsertCall.create.nature).toBe("Timid");
  });

  it("handles teraType field when present", async () => {
    const fakeJson = {
      Garchomp: {
        "Standard": {
          ability: "Rough Skin",
          item: "Leftovers",
          nature: "Jolly",
          teraType: "Steel",
          moves: ["Earthquake"],
          evs: { atk: 252, spe: 252, hp: 4 },
        },
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => fakeJson,
    });

    await fetchSmogonSets("gen9ou");

    const upsertCall = vi.mocked(mockedPrisma.smogonSet.upsert).mock.calls[0][0];
    expect(upsertCall.create.teraType).toBe("Steel");
  });

  it("handles teraType as an array", async () => {
    const fakeJson = {
      Garchomp: {
        "Standard": {
          ability: "Rough Skin",
          item: "Leftovers",
          nature: "Jolly",
          teraType: ["Steel", "Fairy"],
          moves: ["Earthquake"],
          evs: { atk: 252, spe: 252, hp: 4 },
        },
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => fakeJson,
    });

    await fetchSmogonSets("gen9ou");

    const upsertCall = vi.mocked(mockedPrisma.smogonSet.upsert).mock.calls[0][0];
    expect(upsertCall.create.teraType).toBe("Steel");
  });

  it("sets teraType to null when not present", async () => {
    const fakeJson = {
      Garchomp: {
        "Standard": {
          ability: "Rough Skin",
          item: "Leftovers",
          nature: "Jolly",
          moves: ["Earthquake"],
          evs: { atk: 252 },
        },
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => fakeJson,
    });

    await fetchSmogonSets("gen9ou");

    const upsertCall = vi.mocked(mockedPrisma.smogonSet.upsert).mock.calls[0][0];
    expect(upsertCall.create.teraType).toBeNull();
  });

  it("handles EVs as array (takes first element)", async () => {
    const fakeJson = {
      Garchomp: {
        "Standard": {
          ability: "Rough Skin",
          item: "Leftovers",
          nature: "Jolly",
          moves: ["Earthquake"],
          evs: [
            { atk: 252, spe: 252, hp: 4 },
            { atk: 252, def: 128, spe: 128 },
          ],
        },
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => fakeJson,
    });

    await fetchSmogonSets("gen9ou");

    const upsertCall = vi.mocked(mockedPrisma.smogonSet.upsert).mock.calls[0][0];
    expect(JSON.parse(upsertCall.create.evs as string)).toEqual({
      atk: 252,
      spe: 252,
      hp: 4,
    });
  });

  it("handles IVs when present", async () => {
    const fakeJson = {
      Garchomp: {
        "Special": {
          ability: "Rough Skin",
          item: "Leftovers",
          nature: "Quiet",
          moves: ["Draco Meteor"],
          evs: { spa: 252 },
          ivs: { spe: 0 },
        },
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => fakeJson,
    });

    await fetchSmogonSets("gen9ou");

    const upsertCall = vi.mocked(mockedPrisma.smogonSet.upsert).mock.calls[0][0];
    expect(JSON.parse(upsertCall.create.ivs as string)).toEqual({ spe: 0 });
  });

  it("handles IVs as array (takes first element)", async () => {
    const fakeJson = {
      Garchomp: {
        "Special": {
          ability: "Rough Skin",
          item: "Leftovers",
          nature: "Quiet",
          moves: ["Draco Meteor"],
          evs: { spa: 252 },
          ivs: [{ spe: 0 }, { atk: 0 }],
        },
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => fakeJson,
    });

    await fetchSmogonSets("gen9ou");

    const upsertCall = vi.mocked(mockedPrisma.smogonSet.upsert).mock.calls[0][0];
    expect(JSON.parse(upsertCall.create.ivs as string)).toEqual({ spe: 0 });
  });

  it("sets ivs to null when not present", async () => {
    const fakeJson = {
      Garchomp: {
        "Standard": {
          ability: "Rough Skin",
          item: "Leftovers",
          nature: "Jolly",
          moves: ["Earthquake"],
          evs: { atk: 252 },
        },
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => fakeJson,
    });

    await fetchSmogonSets("gen9ou");

    const upsertCall = vi.mocked(mockedPrisma.smogonSet.upsert).mock.calls[0][0];
    expect(upsertCall.create.ivs).toBeNull();
  });

  it("sets ivs to null when ivs is empty object", async () => {
    const fakeJson = {
      Garchomp: {
        "Standard": {
          ability: "Rough Skin",
          item: "Leftovers",
          nature: "Jolly",
          moves: ["Earthquake"],
          evs: { atk: 252 },
          ivs: {},
        },
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => fakeJson,
    });

    await fetchSmogonSets("gen9ou");

    const upsertCall = vi.mocked(mockedPrisma.smogonSet.upsert).mock.calls[0][0];
    expect(upsertCall.create.ivs).toBeNull();
  });

  it("handles missing ability/item fields gracefully", async () => {
    const fakeJson = {
      Garchomp: {
        "Bare": {
          moves: ["Earthquake"],
          evs: { atk: 252 },
          nature: "Jolly",
        },
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => fakeJson,
    });

    await fetchSmogonSets("gen9ou");

    const upsertCall = vi.mocked(mockedPrisma.smogonSet.upsert).mock.calls[0][0];
    expect(upsertCall.create.ability).toBe("");
    expect(upsertCall.create.item).toBe("");
  });

  it("handles missing nature (defaults to Serious)", async () => {
    const fakeJson = {
      Garchomp: {
        "Bare": {
          ability: "Rough Skin",
          item: "Leftovers",
          moves: ["Earthquake"],
          evs: { atk: 252 },
        },
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => fakeJson,
    });

    await fetchSmogonSets("gen9ou");

    const upsertCall = vi.mocked(mockedPrisma.smogonSet.upsert).mock.calls[0][0];
    expect(upsertCall.create.nature).toBe("Serious");
  });

  it("skips entries where pokemonId is empty", async () => {
    const fakeJson = {
      "": {
        "Set": {
          ability: "Test",
          item: "Test",
          nature: "Jolly",
          moves: ["Tackle"],
          evs: {},
        },
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => fakeJson,
    });

    await fetchSmogonSets("gen9ou");

    expect(mockedPrisma.smogonSet.upsert).not.toHaveBeenCalled();
  });

  it("skips entries where sets value is not an object", async () => {
    const fakeJson = {
      Garchomp: null,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => fakeJson,
    });

    await fetchSmogonSets("gen9ou");

    expect(mockedPrisma.smogonSet.upsert).not.toHaveBeenCalled();
  });

  it("skips entries where setData is not an object", async () => {
    const fakeJson = {
      Garchomp: {
        "Bad Set": null,
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => fakeJson,
    });

    await fetchSmogonSets("gen9ou");

    expect(mockedPrisma.smogonSet.upsert).not.toHaveBeenCalled();
  });

  it("handles multiple Pokemon with multiple sets", async () => {
    const fakeJson = {
      Garchomp: {
        "Physical": {
          ability: "Rough Skin",
          item: "Leftovers",
          nature: "Jolly",
          moves: ["Earthquake", "Dragon Claw"],
          evs: { atk: 252, spe: 252 },
        },
        "Swords Dance": {
          ability: "Rough Skin",
          item: "Scale Shot",
          nature: "Jolly",
          moves: ["Swords Dance", "Earthquake", "Scale Shot"],
          evs: { atk: 252, spe: 252 },
        },
      },
      Heatran: {
        "Specially Defensive": {
          ability: "Flash Fire",
          item: "Leftovers",
          nature: "Calm",
          moves: ["Magma Storm", "Earth Power"],
          evs: { hp: 252, spd: 252 },
        },
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => fakeJson,
    });

    await fetchSmogonSets("gen9ou");

    expect(mockedPrisma.smogonSet.upsert).toHaveBeenCalledTimes(3);
    const syncCall = vi.mocked(mockedPrisma.dataSyncLog.upsert).mock.calls[0][0];
    expect(syncCall.create.message).toBe("Fetched 3 sets");
  });

  it("handles missing evs (defaults to empty object)", async () => {
    const fakeJson = {
      Garchomp: {
        "Bare": {
          ability: "Rough Skin",
          item: "Leftovers",
          nature: "Jolly",
          moves: ["Earthquake"],
        },
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => fakeJson,
    });

    await fetchSmogonSets("gen9ou");

    const upsertCall = vi.mocked(mockedPrisma.smogonSet.upsert).mock.calls[0][0];
    expect(JSON.parse(upsertCall.create.evs as string)).toEqual({});
  });

  it("handles missing moves (defaults to empty array)", async () => {
    const fakeJson = {
      Garchomp: {
        "Bare": {
          ability: "Rough Skin",
          item: "Leftovers",
          nature: "Jolly",
          evs: { atk: 252 },
        },
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => fakeJson,
    });

    await fetchSmogonSets("gen9ou");

    const upsertCall = vi.mocked(mockedPrisma.smogonSet.upsert).mock.calls[0][0];
    expect(JSON.parse(upsertCall.create.moves as string)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getSetsForPokemon
// ---------------------------------------------------------------------------

describe("getSetsForPokemon", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries prisma with correct where clause and maps rows", async () => {
    const fakeRows = [
      {
        pokemonId: "garchomp",
        setName: "Physical",
        ability: "Rough Skin",
        item: "Leftovers",
        nature: "Jolly",
        teraType: "Steel",
        moves: '["Earthquake","Dragon Claw"]',
        evs: '{"atk":252,"spe":252}',
        ivs: null,
      },
    ];

    vi.mocked(mockedPrisma.smogonSet.findMany).mockResolvedValueOnce(fakeRows as any);

    const result = await getSetsForPokemon("gen9ou", "garchomp");

    expect(mockedPrisma.smogonSet.findMany).toHaveBeenCalledWith({
      where: { formatId: "gen9ou", pokemonId: "garchomp" },
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      pokemonId: "garchomp",
      setName: "Physical",
      ability: "Rough Skin",
      item: "Leftovers",
      nature: "Jolly",
      teraType: "Steel",
      moves: ["Earthquake", "Dragon Claw"],
      evs: { atk: 252, spe: 252 },
      ivs: undefined,
    });
  });

  it("returns empty array when no rows found", async () => {
    vi.mocked(mockedPrisma.smogonSet.findMany).mockResolvedValueOnce([]);

    const result = await getSetsForPokemon("gen9ou", "missingmon");

    expect(result).toEqual([]);
  });

  it("parses IVs when present in the row", async () => {
    const fakeRows = [
      {
        pokemonId: "garchomp",
        setName: "Trick Room",
        ability: "Rough Skin",
        item: "Leftovers",
        nature: "Brave",
        teraType: null,
        moves: '["Earthquake"]',
        evs: '{"atk":252,"hp":252}',
        ivs: '{"spe":0}',
      },
    ];

    vi.mocked(mockedPrisma.smogonSet.findMany).mockResolvedValueOnce(fakeRows as any);

    const result = await getSetsForPokemon("gen9ou", "garchomp");

    expect(result[0].ivs).toEqual({ spe: 0 });
    expect(result[0].teraType).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getAllSetsForFormat
// ---------------------------------------------------------------------------

describe("getAllSetsForFormat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("groups sets by pokemonId", async () => {
    const fakeRows = [
      {
        pokemonId: "garchomp",
        setName: "Physical",
        ability: "Rough Skin",
        item: "Leftovers",
        nature: "Jolly",
        teraType: null,
        moves: '["Earthquake"]',
        evs: '{"atk":252}',
        ivs: null,
      },
      {
        pokemonId: "garchomp",
        setName: "Swords Dance",
        ability: "Rough Skin",
        item: "Life Orb",
        nature: "Jolly",
        teraType: null,
        moves: '["Swords Dance","Earthquake"]',
        evs: '{"atk":252,"spe":252}',
        ivs: null,
      },
      {
        pokemonId: "heatran",
        setName: "SpDef",
        ability: "Flash Fire",
        item: "Leftovers",
        nature: "Calm",
        teraType: "Grass",
        moves: '["Magma Storm"]',
        evs: '{"hp":252,"spd":252}',
        ivs: null,
      },
    ];

    vi.mocked(mockedPrisma.smogonSet.findMany).mockResolvedValueOnce(fakeRows as any);

    const result = await getAllSetsForFormat("gen9ou");

    expect(mockedPrisma.smogonSet.findMany).toHaveBeenCalledWith({
      where: { formatId: "gen9ou" },
    });

    expect(Object.keys(result)).toEqual(["garchomp", "heatran"]);
    expect(result.garchomp).toHaveLength(2);
    expect(result.heatran).toHaveLength(1);
    expect(result.garchomp[0].setName).toBe("Physical");
    expect(result.garchomp[1].setName).toBe("Swords Dance");
    expect(result.heatran[0].teraType).toBe("Grass");
  });

  it("returns empty object when no rows exist", async () => {
    vi.mocked(mockedPrisma.smogonSet.findMany).mockResolvedValueOnce([]);

    const result = await getAllSetsForFormat("gen9ou");

    expect(result).toEqual({});
  });
});
