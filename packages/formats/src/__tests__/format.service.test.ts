import { getFormat, getAllFormats, getActiveFormats, getFormatPokemon, isLegalInFormat } from "../format.service";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("../data/format-definitions", () => ({
  FORMAT_DEFINITIONS: [
    {
      id: "gen9ou",
      name: "OU",
      generation: 9,
      gameType: "singles",
      dexScope: "sv",
      teamSize: 6,
      maxLevel: 100,
      defaultLevel: 100,
      rules: ["Species Clause"],
      bans: ["Koraidon", "Miraidon", "Arena Trap"],
      isActive: true,
    },
    {
      id: "gen9uu",
      name: "UU",
      generation: 9,
      gameType: "singles",
      dexScope: "sv",
      teamSize: 6,
      maxLevel: 100,
      defaultLevel: 100,
      rules: ["Species Clause"],
      bans: ["OU", "UUBL"],
      isActive: true,
    },
    {
      id: "gen9lc",
      name: "LC",
      generation: 9,
      gameType: "singles",
      dexScope: "sv",
      teamSize: 6,
      maxLevel: 5,
      defaultLevel: 5,
      rules: ["Species Clause", "Little Cup"],
      bans: ["Dragon Rage"],
      isActive: true,
    },
    {
      id: "gen9vgc2024",
      name: "VGC 2024",
      generation: 9,
      gameType: "doubles",
      dexScope: "sv",
      teamSize: 6,
      maxLevel: 50,
      defaultLevel: 50,
      rules: ["Species Clause"],
      bans: ["Koraidon"],
      isActive: false,
    },
  ],
}));

vi.mock("@nasty-plot/pokemon-data", () => ({
  getAllSpecies: vi.fn(() => [
    {
      id: "garchomp", name: "Garchomp", num: 445,
      types: ["Dragon", "Ground"],
      baseStats: { hp: 108, atk: 130, def: 95, spa: 80, spd: 85, spe: 102 },
      abilities: { "0": "Sand Veil" }, weightkg: 95, tier: "OU",
    },
    {
      id: "pikachu", name: "Pikachu", num: 25,
      types: ["Electric"],
      baseStats: { hp: 35, atk: 55, def: 40, spa: 50, spd: 50, spe: 90 },
      abilities: { "0": "Static" }, weightkg: 6, tier: "LC",
    },
    {
      id: "koraidon", name: "Koraidon", num: 1007,
      types: ["Fighting", "Dragon"],
      baseStats: { hp: 100, atk: 135, def: 115, spa: 85, spd: 100, spe: 135 },
      abilities: { "0": "Orichalcum Pulse" }, weightkg: 303, tier: "Uber",
    },
  ]),
  getSpecies: vi.fn((id: string) => {
    const species: Record<string, unknown> = {
      garchomp: {
        id: "garchomp", name: "Garchomp", num: 445,
        types: ["Dragon", "Ground"],
        baseStats: { hp: 108, atk: 130, def: 95, spa: 80, spd: 85, spe: 102 },
        abilities: { "0": "Sand Veil" }, weightkg: 95, tier: "OU",
      },
      koraidon: {
        id: "koraidon", name: "Koraidon", num: 1007,
        types: ["Fighting", "Dragon"],
        baseStats: { hp: 100, atk: 135, def: 115, spa: 85, spd: 100, spe: 135 },
        abilities: { "0": "Orichalcum Pulse" }, weightkg: 303, tier: "Uber",
      },
      pikachu: {
        id: "pikachu", name: "Pikachu", num: 25,
        types: ["Electric"],
        baseStats: { hp: 35, atk: 55, def: 40, spa: 50, spd: 50, spe: 90 },
        abilities: { "0": "Static" }, weightkg: 6, tier: "LC",
      },
    };
    return species[id] ?? null;
  }),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getFormat", () => {
  it("returns format definition by id", () => {
    const result = getFormat("gen9ou");

    expect(result).not.toBeNull();
    expect(result!.id).toBe("gen9ou");
    expect(result!.name).toBe("OU");
  });

  it("returns null for unknown format", () => {
    const result = getFormat("gen9unknown");

    expect(result).toBeNull();
  });
});

describe("getAllFormats", () => {
  it("returns all format definitions", () => {
    const result = getAllFormats();

    expect(result.length).toBe(4);
  });
});

describe("getActiveFormats", () => {
  it("returns only active formats", () => {
    const result = getActiveFormats();

    expect(result.every((f) => f.isActive)).toBe(true);
    expect(result.length).toBe(3); // gen9ou, gen9uu, gen9lc are active
  });

  it("excludes inactive formats", () => {
    const result = getActiveFormats();

    const ids = result.map((f) => f.id);
    expect(ids).not.toContain("gen9vgc2024");
  });
});

describe("getFormatPokemon", () => {
  it("returns Pokemon legal in a format", () => {
    const result = getFormatPokemon("gen9ou");

    expect(result.length).toBeGreaterThan(0);
  });

  it("excludes banned Pokemon", () => {
    const result = getFormatPokemon("gen9ou");

    const ids = result.map((p) => p.id);
    expect(ids).not.toContain("koraidon");
  });

  it("returns empty array for unknown format", () => {
    const result = getFormatPokemon("gen9unknown");

    expect(result).toEqual([]);
  });
});

describe("isLegalInFormat", () => {
  it("returns true for legal Pokemon", () => {
    const result = isLegalInFormat("garchomp", "gen9ou");

    expect(result).toBe(true);
  });

  it("returns false for banned Pokemon", () => {
    const result = isLegalInFormat("koraidon", "gen9ou");

    expect(result).toBe(false);
  });

  it("returns false for unknown format", () => {
    const result = isLegalInFormat("garchomp", "gen9unknown");

    expect(result).toBe(false);
  });

  it("returns false for unknown Pokemon", () => {
    const result = isLegalInFormat("fakemon", "gen9ou");

    expect(result).toBe(false);
  });
});
