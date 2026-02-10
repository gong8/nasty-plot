import {
  getFormat,
  getAllFormats,
  getActiveFormats,
  getFormatPokemon,
  isLegalInFormat,
  getFormatItems,
  getFormatMoves,
  getFormatLearnset,
} from "@nasty-plot/formats"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("#formats/data/format-definitions", () => ({
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
    {
      id: "gen9nationaldex",
      name: "National Dex",
      generation: 9,
      gameType: "singles",
      dexScope: "natdex",
      teamSize: 6,
      maxLevel: 100,
      defaultLevel: 100,
      rules: ["Species Clause", "Mega Rayquaza Clause"],
      bans: ["Koraidon", "Miraidon", "Baton Pass"],
      isActive: true,
    },
    {
      id: "gen9idbans",
      name: "ID Bans Test",
      generation: 9,
      gameType: "singles",
      dexScope: "natdex",
      teamSize: 6,
      maxLevel: 100,
      defaultLevel: 100,
      rules: [],
      bans: ["garchomp", "leftovers", "earthquake"],
      isActive: false,
    },
  ],
}))

vi.mock("@nasty-plot/pokemon-data", () => ({
  getAllSpecies: vi.fn(() => [
    {
      id: "garchomp",
      name: "Garchomp",
      num: 445,
      types: ["Dragon", "Ground"],
      baseStats: { hp: 108, atk: 130, def: 95, spa: 80, spd: 85, spe: 102 },
      abilities: { "0": "Sand Veil" },
      weightkg: 95,
      tier: "OU",
      isNonstandard: null,
    },
    {
      id: "pikachu",
      name: "Pikachu",
      num: 25,
      types: ["Electric"],
      baseStats: { hp: 35, atk: 55, def: 40, spa: 50, spd: 50, spe: 90 },
      abilities: { "0": "Static" },
      weightkg: 6,
      tier: "LC",
      isNonstandard: null,
    },
    {
      id: "koraidon",
      name: "Koraidon",
      num: 1007,
      types: ["Fighting", "Dragon"],
      baseStats: { hp: 100, atk: 135, def: 115, spa: 85, spd: 100, spe: 135 },
      abilities: { "0": "Orichalcum Pulse" },
      weightkg: 303,
      tier: "Uber",
      isNonstandard: null,
    },
    {
      id: "caterpie",
      name: "Caterpie",
      num: 658,
      types: ["Water", "Dark"],
      baseStats: { hp: 72, atk: 95, def: 67, spa: 103, spd: 71, spe: 122 },
      abilities: { "0": "Torrent" },
      weightkg: 40,
      tier: "OU",
      isNonstandard: "Past",
    },
  ]),
  getSpecies: vi.fn((id: string) => {
    const species: Record<string, unknown> = {
      garchomp: {
        id: "garchomp",
        name: "Garchomp",
        num: 445,
        types: ["Dragon", "Ground"],
        baseStats: { hp: 108, atk: 130, def: 95, spa: 80, spd: 85, spe: 102 },
        abilities: { "0": "Sand Veil" },
        weightkg: 95,
        tier: "OU",
        isNonstandard: null,
      },
      koraidon: {
        id: "koraidon",
        name: "Koraidon",
        num: 1007,
        types: ["Fighting", "Dragon"],
        baseStats: { hp: 100, atk: 135, def: 115, spa: 85, spd: 100, spe: 135 },
        abilities: { "0": "Orichalcum Pulse" },
        weightkg: 303,
        tier: "Uber",
        isNonstandard: null,
      },
      pikachu: {
        id: "pikachu",
        name: "Pikachu",
        num: 25,
        types: ["Electric"],
        baseStats: { hp: 35, atk: 55, def: 40, spa: 50, spd: 50, spe: 90 },
        abilities: { "0": "Static" },
        weightkg: 6,
        tier: "LC",
        isNonstandard: null,
      },
      caterpie: {
        id: "caterpie",
        name: "Caterpie",
        num: 658,
        types: ["Water", "Dark"],
        baseStats: { hp: 72, atk: 95, def: 67, spa: 103, spd: 71, spe: 122 },
        abilities: { "0": "Torrent" },
        weightkg: 40,
        tier: "OU",
        isNonstandard: "Past",
      },
    }
    return species[id] ?? null
  }),
  getAllItems: vi.fn(() => [
    { id: "leftovers", name: "Leftovers", description: "Restores HP", isNonstandard: null },
    { id: "choicescarf", name: "Choice Scarf", description: "Boosts Speed", isNonstandard: null },
    {
      id: "charizarditex",
      name: "Charizardite X",
      description: "Mega Stone",
      isNonstandard: "Past",
    },
    { id: "electriumz", name: "Electrium Z", description: "Z-Crystal", isNonstandard: "Past" },
  ]),
  getAllMoves: vi.fn(() => [
    {
      id: "earthquake",
      name: "Earthquake",
      type: "Ground",
      category: "Physical",
      basePower: 100,
      accuracy: 100,
      pp: 10,
      priority: 0,
      target: "allAdjacent",
      flags: {},
      isNonstandard: null,
    },
    {
      id: "thunderbolt",
      name: "Thunderbolt",
      type: "Electric",
      category: "Special",
      basePower: 90,
      accuracy: 100,
      pp: 15,
      priority: 0,
      target: "normal",
      flags: {},
      isNonstandard: null,
    },
    {
      id: "hiddenpower",
      name: "Hidden Power",
      type: "Normal",
      category: "Special",
      basePower: 60,
      accuracy: 100,
      pp: 15,
      priority: 0,
      target: "normal",
      flags: {},
      isNonstandard: "Past",
    },
    {
      id: "batonpass",
      name: "Baton Pass",
      type: "Normal",
      category: "Status",
      basePower: 0,
      accuracy: true,
      pp: 40,
      priority: 0,
      target: "self",
      flags: {},
      isNonstandard: null,
    },
  ]),
  getLearnset: vi.fn(async () => ["earthquake", "thunderbolt", "hiddenpower", "batonpass"]),
}))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getFormat", () => {
  it("returns format definition by id", () => {
    const result = getFormat("gen9ou")

    expect(result).not.toBeNull()
    expect(result!.id).toBe("gen9ou")
    expect(result!.name).toBe("OU")
  })

  it("returns null for unknown format", () => {
    const result = getFormat("gen9unknown")

    expect(result).toBeNull()
  })
})

describe("getAllFormats", () => {
  it("returns all format definitions", () => {
    const result = getAllFormats()

    expect(result.length).toBe(6)
  })
})

describe("getActiveFormats", () => {
  it("returns only active formats", () => {
    const result = getActiveFormats()

    expect(result.every((f) => f.isActive)).toBe(true)
    expect(result.length).toBe(4) // gen9ou, gen9uu, gen9lc, gen9nationaldex are active
  })

  it("excludes inactive formats", () => {
    const result = getActiveFormats()

    const ids = result.map((f) => f.id)
    expect(ids).not.toContain("gen9vgc2024")
  })
})

describe("getFormatPokemon", () => {
  it("returns Pokemon legal in a format", () => {
    const result = getFormatPokemon("gen9ou")

    expect(result.length).toBeGreaterThan(0)
  })

  it("excludes banned Pokemon", () => {
    const result = getFormatPokemon("gen9ou")

    const ids = result.map((p) => p.id)
    expect(ids).not.toContain("koraidon")
  })

  it("returns empty array for unknown format", () => {
    const result = getFormatPokemon("gen9unknown")

    expect(result).toEqual([])
  })
})

describe("isLegalInFormat", () => {
  it("returns true for legal Pokemon", () => {
    const result = isLegalInFormat("garchomp", "gen9ou")

    expect(result).toBe(true)
  })

  it("returns false for banned Pokemon", () => {
    const result = isLegalInFormat("koraidon", "gen9ou")

    expect(result).toBe(false)
  })

  it("returns false for unknown format", () => {
    const result = isLegalInFormat("garchomp", "gen9unknown")

    expect(result).toBe(false)
  })

  it("returns false for unknown Pokemon", () => {
    const result = isLegalInFormat("fakemon", "gen9ou")

    expect(result).toBe(false)
  })

  it("returns false for Past Pokemon in SV format", () => {
    const result = isLegalInFormat("caterpie", "gen9ou")

    expect(result).toBe(false)
  })

  it("returns true for Past Pokemon in NatDex format", () => {
    const result = isLegalInFormat("caterpie", "gen9nationaldex")

    expect(result).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// NatDex: dexScope filtering
// ---------------------------------------------------------------------------

describe("getFormatPokemon — NatDex", () => {
  it("SV format excludes Past Pokemon", () => {
    const result = getFormatPokemon("gen9ou")
    const ids = result.map((p) => p.id)

    expect(ids).not.toContain("caterpie")
    expect(ids).toContain("garchomp")
  })

  it("NatDex format includes Past Pokemon", () => {
    const result = getFormatPokemon("gen9nationaldex")
    const ids = result.map((p) => p.id)

    expect(ids).toContain("caterpie")
    expect(ids).toContain("garchomp")
  })

  it("NatDex still respects bans", () => {
    const result = getFormatPokemon("gen9nationaldex")
    const ids = result.map((p) => p.id)

    expect(ids).not.toContain("koraidon")
  })
})

describe("getFormatItems", () => {
  it("SV format excludes Past items (Mega Stones, Z-Crystals)", () => {
    const result = getFormatItems("gen9ou")
    const ids = result.map((i) => i.id)

    expect(ids).toContain("leftovers")
    expect(ids).toContain("choicescarf")
    expect(ids).not.toContain("charizarditex")
    expect(ids).not.toContain("electriumz")
  })

  it("NatDex format includes Past items", () => {
    const result = getFormatItems("gen9nationaldex")
    const ids = result.map((i) => i.id)

    expect(ids).toContain("leftovers")
    expect(ids).toContain("charizarditex")
    expect(ids).toContain("electriumz")
  })

  it("returns empty array for unknown format", () => {
    expect(getFormatItems("gen9unknown")).toEqual([])
  })
})

describe("getFormatMoves", () => {
  it("SV format excludes Past moves", () => {
    const result = getFormatMoves("gen9ou")
    const ids = result.map((m) => m.id)

    expect(ids).toContain("earthquake")
    expect(ids).toContain("thunderbolt")
    expect(ids).not.toContain("hiddenpower")
  })

  it("NatDex format includes Past moves", () => {
    const result = getFormatMoves("gen9nationaldex")
    const ids = result.map((m) => m.id)

    expect(ids).toContain("earthquake")
    expect(ids).toContain("hiddenpower")
  })

  it("NatDex respects move bans", () => {
    const result = getFormatMoves("gen9nationaldex")
    const ids = result.map((m) => m.id)

    // Baton Pass is banned in NatDex
    expect(ids).not.toContain("batonpass")
  })

  it("returns empty array for unknown format", () => {
    expect(getFormatMoves("gen9unknown")).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// ID-based ban coverage (lines 12, 59-60, 73)
// ---------------------------------------------------------------------------

describe("getFormatPokemon — ID-based bans", () => {
  it("bans Pokemon by id when ban list uses lowercase id", () => {
    const result = getFormatPokemon("gen9idbans")
    const ids = result.map((p) => p.id)

    expect(ids).not.toContain("garchomp")
    expect(ids).toContain("pikachu")
  })
})

describe("getFormatPokemon — tier-based bans", () => {
  it("bans Pokemon by tier in UU (tier OU is banned)", () => {
    const result = getFormatPokemon("gen9uu")
    const ids = result.map((p) => p.id)

    // Garchomp has tier "OU" which is in UU's ban list
    expect(ids).not.toContain("garchomp")
    expect(ids).toContain("pikachu")
  })
})

describe("getFormatPokemon — LC tier filtering", () => {
  it("LC format excludes non-LC tier Pokemon", () => {
    const result = getFormatPokemon("gen9lc")
    const ids = result.map((p) => p.id)

    // Only pikachu has tier "LC"
    expect(ids).toContain("pikachu")
    expect(ids).not.toContain("garchomp")
    expect(ids).not.toContain("koraidon")
  })
})

describe("getFormatItems — ID-based bans", () => {
  it("bans items by id when ban list uses lowercase id", () => {
    const result = getFormatItems("gen9idbans")
    const ids = result.map((i) => i.id)

    expect(ids).not.toContain("leftovers")
    expect(ids).toContain("choicescarf")
  })
})

describe("getFormatMoves — ID-based bans", () => {
  it("bans moves by id when ban list uses lowercase id", () => {
    const result = getFormatMoves("gen9idbans")
    const ids = result.map((m) => m.id)

    expect(ids).not.toContain("earthquake")
    expect(ids).toContain("thunderbolt")
  })
})

describe("getFormatLearnset", () => {
  it("returns empty array for unknown format", async () => {
    const result = await getFormatLearnset("garchomp", "gen9unknown")

    expect(result).toEqual([])
  })

  it("filters learnset to only format-legal moves", async () => {
    const result = await getFormatLearnset("garchomp", "gen9ou")

    // earthquake and thunderbolt are legal in SV; hiddenpower is Past; batonpass is not banned in OU
    expect(result).toContain("earthquake")
    expect(result).toContain("thunderbolt")
    expect(result).toContain("batonpass")
    expect(result).not.toContain("hiddenpower")
  })

  it("respects move bans in NatDex format", async () => {
    const result = await getFormatLearnset("garchomp", "gen9nationaldex")

    // NatDex includes Past moves but bans Baton Pass
    expect(result).toContain("earthquake")
    expect(result).toContain("thunderbolt")
    expect(result).toContain("hiddenpower")
    expect(result).not.toContain("batonpass")
  })
})
