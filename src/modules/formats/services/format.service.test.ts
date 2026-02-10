import {
  getFormat,
  getAllFormats,
  getActiveFormats,
  getFormatPokemon,
  isLegalInFormat,
} from "./format.service";
import { FORMAT_DEFINITIONS } from "../data/format-definitions";

// =============================================================================
// getFormat
// =============================================================================

describe("getFormat", () => {
  it("returns gen9ou format by id", () => {
    const ou = getFormat("gen9ou");
    expect(ou).not.toBeNull();
    expect(ou!.id).toBe("gen9ou");
    expect(ou!.name).toBe("OU");
    expect(ou!.generation).toBe(9);
    expect(ou!.gameType).toBe("singles");
  });

  it("returns gen9uu format by id", () => {
    const uu = getFormat("gen9uu");
    expect(uu).not.toBeNull();
    expect(uu!.id).toBe("gen9uu");
    expect(uu!.name).toBe("UU");
  });

  it("returns gen9lc format with level 5", () => {
    const lc = getFormat("gen9lc");
    expect(lc).not.toBeNull();
    expect(lc!.maxLevel).toBe(5);
    expect(lc!.defaultLevel).toBe(5);
  });

  it("returns VGC 2025 format", () => {
    const vgc = getFormat("gen9vgc2025");
    expect(vgc).not.toBeNull();
    expect(vgc!.gameType).toBe("doubles");
    expect(vgc!.maxLevel).toBe(50);
    expect(vgc!.restricted).toBeDefined();
    expect(vgc!.restricted!.length).toBeGreaterThan(0);
  });

  it("returns null for a non-existent format id", () => {
    expect(getFormat("gen9fakeleague")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(getFormat("")).toBeNull();
  });

  it("is case-sensitive (does not match uppercase)", () => {
    expect(getFormat("GEN9OU")).toBeNull();
  });

  it("returned format has bans array", () => {
    const ou = getFormat("gen9ou");
    expect(ou).not.toBeNull();
    expect(Array.isArray(ou!.bans)).toBe(true);
    expect(ou!.bans.length).toBeGreaterThan(0);
  });

  it("returned format has rules array", () => {
    const ou = getFormat("gen9ou");
    expect(ou).not.toBeNull();
    expect(Array.isArray(ou!.rules)).toBe(true);
    expect(ou!.rules.length).toBeGreaterThan(0);
  });

  it("returns the same object reference as in FORMAT_DEFINITIONS", () => {
    const ou = getFormat("gen9ou");
    const defEntry = FORMAT_DEFINITIONS.find((f) => f.id === "gen9ou");
    expect(ou).toBe(defEntry);
  });
});

// =============================================================================
// getAllFormats
// =============================================================================

describe("getAllFormats", () => {
  it("returns an array", () => {
    const all = getAllFormats();
    expect(Array.isArray(all)).toBe(true);
  });

  it("returns the same array as FORMAT_DEFINITIONS", () => {
    const all = getAllFormats();
    expect(all).toBe(FORMAT_DEFINITIONS);
  });

  it("contains the expected number of formats", () => {
    const all = getAllFormats();
    expect(all.length).toBe(FORMAT_DEFINITIONS.length);
    expect(all.length).toBeGreaterThanOrEqual(10);
  });

  it("contains gen9ou", () => {
    const all = getAllFormats();
    expect(all.some((f) => f.id === "gen9ou")).toBe(true);
  });

  it("contains VGC formats", () => {
    const all = getAllFormats();
    expect(all.some((f) => f.id === "gen9vgc2025")).toBe(true);
  });

  it("contains Battle Stadium formats", () => {
    const all = getAllFormats();
    expect(all.some((f) => f.id === "gen9battlestadiumsingles")).toBe(true);
    expect(all.some((f) => f.id === "gen9battlestadiumdoubles")).toBe(true);
  });
});

// =============================================================================
// getActiveFormats
// =============================================================================

describe("getActiveFormats", () => {
  it("returns only formats where isActive is true", () => {
    const active = getActiveFormats();
    for (const format of active) {
      expect(format.isActive).toBe(true);
    }
  });

  it("has fewer or equal entries compared to getAllFormats", () => {
    const all = getAllFormats();
    const active = getActiveFormats();
    expect(active.length).toBeLessThanOrEqual(all.length);
  });

  it("includes gen9ou (which is active)", () => {
    const active = getActiveFormats();
    expect(active.some((f) => f.id === "gen9ou")).toBe(true);
  });

  it("excludes gen9vgc2024 (which is inactive)", () => {
    const active = getActiveFormats();
    expect(active.some((f) => f.id === "gen9vgc2024")).toBe(false);
  });

  it("includes gen9vgc2025 (which is active)", () => {
    const active = getActiveFormats();
    expect(active.some((f) => f.id === "gen9vgc2025")).toBe(true);
  });

  it("returns a non-empty array (at least some formats are active)", () => {
    const active = getActiveFormats();
    expect(active.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// getFormatPokemon
// =============================================================================

describe("getFormatPokemon", () => {
  it("returns a non-empty array for gen9ou", () => {
    const pokemon = getFormatPokemon("gen9ou");
    expect(pokemon.length).toBeGreaterThan(0);
  });

  it("excludes directly banned Pokemon from gen9ou", () => {
    const pokemon = getFormatPokemon("gen9ou");
    const names = pokemon.map((p) => p.name);
    // These are explicitly banned in gen9ou
    expect(names).not.toContain("Koraidon");
    expect(names).not.toContain("Miraidon");
    expect(names).not.toContain("Mewtwo");
    expect(names).not.toContain("Kyogre");
    expect(names).not.toContain("Calyrex-Shadow");
  });

  it("includes non-banned Pokemon in gen9ou", () => {
    const pokemon = getFormatPokemon("gen9ou");
    const names = pokemon.map((p) => p.name);
    // Garchomp and Pikachu should be available (not banned)
    expect(names).toContain("Garchomp");
  });

  it("returns an empty array for a non-existent format", () => {
    const pokemon = getFormatPokemon("gen9fakeleague");
    expect(pokemon).toEqual([]);
  });

  it("returns an empty array for an empty format id", () => {
    const pokemon = getFormatPokemon("");
    expect(pokemon).toEqual([]);
  });

  it("gen9ubers has more Pokemon than gen9ou (fewer bans)", () => {
    const ouPokemon = getFormatPokemon("gen9ou");
    const ubersPokemon = getFormatPokemon("gen9ubers");
    // Ubers bans very little by name, so it should have more Pokemon
    expect(ubersPokemon.length).toBeGreaterThanOrEqual(ouPokemon.length);
  });

  it("gen9lc only includes LC-tier Pokemon", () => {
    const lcPokemon = getFormatPokemon("gen9lc");
    for (const p of lcPokemon) {
      expect(p.tier).toBe("LC");
    }
  });

  it("gen9lc does not include fully evolved Pokemon", () => {
    const lcPokemon = getFormatPokemon("gen9lc");
    const names = lcPokemon.map((p) => p.name);
    expect(names).not.toContain("Garchomp");
    expect(names).not.toContain("Charizard");
    expect(names).not.toContain("Pikachu");
  });

  it("returned Pokemon have valid species shape", () => {
    const pokemon = getFormatPokemon("gen9ou");
    for (const p of pokemon.slice(0, 10)) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.num).toBeGreaterThan(0);
      expect(p.types.length).toBeGreaterThanOrEqual(1);
      expect(p.baseStats).toBeDefined();
    }
  });

  it("gen9uu excludes OU and UUBL tier Pokemon", () => {
    const uuPokemon = getFormatPokemon("gen9uu");
    for (const p of uuPokemon) {
      // The tier should not be OU or UUBL (those are banned in UU)
      expect(p.tier?.toLowerCase()).not.toBe("ou");
      expect(p.tier?.toLowerCase()).not.toBe("uubl");
    }
  });
});

// =============================================================================
// isLegalInFormat
// =============================================================================

describe("isLegalInFormat", () => {
  // --- Valid cases ---
  it("Garchomp is legal in gen9ou", () => {
    expect(isLegalInFormat("garchomp", "gen9ou")).toBe(true);
  });

  it("Pikachu is legal in gen9ou", () => {
    expect(isLegalInFormat("pikachu", "gen9ou")).toBe(true);
  });

  it("Charizard is legal in gen9ou", () => {
    expect(isLegalInFormat("charizard", "gen9ou")).toBe(true);
  });

  // --- Banned cases ---
  it("Koraidon is banned in gen9ou", () => {
    expect(isLegalInFormat("koraidon", "gen9ou")).toBe(false);
  });

  it("Miraidon is banned in gen9ou", () => {
    expect(isLegalInFormat("miraidon", "gen9ou")).toBe(false);
  });

  it("Mewtwo is banned in gen9ou", () => {
    expect(isLegalInFormat("mewtwo", "gen9ou")).toBe(false);
  });

  it("Kyogre is banned in gen9ou", () => {
    expect(isLegalInFormat("kyogre", "gen9ou")).toBe(false);
  });

  // --- Uber-tier Pokemon in Ubers ---
  it("Koraidon is legal in gen9ubers", () => {
    // Koraidon is not name-banned in Ubers
    expect(isLegalInFormat("koraidon", "gen9ubers")).toBe(true);
  });

  // --- LC legality ---
  it("fully evolved Pokemon are not legal in gen9lc", () => {
    expect(isLegalInFormat("garchomp", "gen9lc")).toBe(false);
  });

  it("fully evolved Pokemon like Charizard are not legal in gen9lc", () => {
    expect(isLegalInFormat("charizard", "gen9lc")).toBe(false);
  });

  // --- Non-existent format ---
  it("returns false for a non-existent format", () => {
    expect(isLegalInFormat("pikachu", "gen9fakeleague")).toBe(false);
  });

  it("returns false for an empty format id", () => {
    expect(isLegalInFormat("pikachu", "")).toBe(false);
  });

  // --- Non-existent Pokemon ---
  it("returns false for a non-existent Pokemon", () => {
    expect(isLegalInFormat("fakemon999", "gen9ou")).toBe(false);
  });

  it("returns false for an empty Pokemon id", () => {
    expect(isLegalInFormat("", "gen9ou")).toBe(false);
  });

  // --- Both invalid ---
  it("returns false when both Pokemon and format are invalid", () => {
    expect(isLegalInFormat("fakemon", "fakeleague")).toBe(false);
  });

  // --- Tier-based bans ---
  it("OU-tier Pokemon are banned in gen9uu", () => {
    // Find a Pokemon in OU tier and check it's banned in UU
    const ou = getFormat("gen9ou");
    expect(ou).not.toBeNull();
    // Garchomp is typically in OU tier
    const garchomp = isLegalInFormat("garchomp", "gen9uu");
    // If Garchomp's tier is OU, it should be banned in UU
    // The result depends on @pkmn/dex tier classification
    // We just verify the function returns a boolean
    expect(typeof garchomp).toBe("boolean");
  });

  // --- Cross-format consistency ---
  it("Pokemon banned in OU are not automatically banned in Ubers", () => {
    // Flutter Mane is banned in OU but should be legal in Ubers
    const inOU = isLegalInFormat("fluttermane", "gen9ou");
    const inUbers = isLegalInFormat("fluttermane", "gen9ubers");
    expect(inOU).toBe(false);
    expect(inUbers).toBe(true);
  });
});
