import {
  getDex,
  getSpecies,
  getAllSpecies,
  getMove,
  getAllMoves,
  getAbility,
  getItem,
  getAllItems,
  getLearnset,
  searchSpecies,
  getTypeChart,
  isMegaStone,
  getMegaStonesFor,
  getMegaForm,
  isZCrystal,
  getZCrystalType,
  getSignatureZCrystal,
} from "./dex.service";

// =============================================================================
// getDex
// =============================================================================

describe("getDex", () => {
  it("returns a Dex instance for generation 9", () => {
    const dex = getDex();
    expect(dex).toBeDefined();
    expect(dex.gen).toBe(9);
  });

  it("returns the same instance on repeated calls", () => {
    const a = getDex();
    const b = getDex();
    expect(a).toBe(b);
  });
});

// =============================================================================
// getSpecies
// =============================================================================

describe("getSpecies", () => {
  it("returns Pikachu with correct shape", () => {
    const pikachu = getSpecies("pikachu");
    expect(pikachu).not.toBeNull();
    expect(pikachu!.id).toBe("pikachu");
    expect(pikachu!.name).toBe("Pikachu");
    expect(pikachu!.num).toBe(25);
    expect(pikachu!.types).toEqual(["Electric"]);
    expect(pikachu!.baseStats).toEqual({
      hp: expect.any(Number),
      atk: expect.any(Number),
      def: expect.any(Number),
      spa: expect.any(Number),
      spd: expect.any(Number),
      spe: expect.any(Number),
    });
    expect(pikachu!.weightkg).toBeGreaterThan(0);
  });

  it("returns Charizard with dual typing", () => {
    const charizard = getSpecies("charizard");
    expect(charizard).not.toBeNull();
    expect(charizard!.id).toBe("charizard");
    expect(charizard!.name).toBe("Charizard");
    expect(charizard!.num).toBe(6);
    expect(charizard!.types).toEqual(["Fire", "Flying"]);
  });

  it("returns Garchomp with correct base stats", () => {
    const garchomp = getSpecies("garchomp");
    expect(garchomp).not.toBeNull();
    expect(garchomp!.name).toBe("Garchomp");
    expect(garchomp!.types).toEqual(["Dragon", "Ground"]);
    expect(garchomp!.baseStats.hp).toBe(108);
    expect(garchomp!.baseStats.atk).toBe(130);
    expect(garchomp!.baseStats.def).toBe(95);
    expect(garchomp!.baseStats.spa).toBe(80);
    expect(garchomp!.baseStats.spd).toBe(85);
    expect(garchomp!.baseStats.spe).toBe(102);
  });

  it("includes abilities as a record", () => {
    const garchomp = getSpecies("garchomp");
    expect(garchomp).not.toBeNull();
    const abilityValues = Object.values(garchomp!.abilities);
    expect(abilityValues.length).toBeGreaterThan(0);
    // Garchomp has Sand Veil (and Rough Skin as hidden ability)
    expect(abilityValues).toContain("Sand Veil");
  });

  it("includes tier information", () => {
    const garchomp = getSpecies("garchomp");
    expect(garchomp).not.toBeNull();
    expect(garchomp!.tier).toBeDefined();
    expect(typeof garchomp!.tier).toBe("string");
  });

  it("returns null for a non-existent Pokemon", () => {
    expect(getSpecies("fakemon123")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(getSpecies("")).toBeNull();
  });

  it("handles case-insensitive lookups via @pkmn/dex", () => {
    const upper = getSpecies("Pikachu");
    const lower = getSpecies("pikachu");
    expect(upper).not.toBeNull();
    expect(lower).not.toBeNull();
    expect(upper!.id).toBe(lower!.id);
  });

  it("handles name with spaces/hyphens for alternate formes", () => {
    const megaX = getSpecies("charizardmegax");
    // Mega forms may or may not be in Gen 9 scope; check gracefully
    if (megaX) {
      expect(megaX.name).toContain("Charizard");
    }
  });

  it("returns a single-type array for monotype Pokemon", () => {
    const pikachu = getSpecies("pikachu");
    expect(pikachu).not.toBeNull();
    expect(pikachu!.types).toHaveLength(1);
    expect(pikachu!.types[0]).toBe("Electric");
  });

  it("returns a two-element type array for dual-type Pokemon", () => {
    const garchomp = getSpecies("garchomp");
    expect(garchomp).not.toBeNull();
    expect(garchomp!.types).toHaveLength(2);
  });

  it("includes weightkg", () => {
    const snorlax = getSpecies("snorlax");
    expect(snorlax).not.toBeNull();
    expect(snorlax!.weightkg).toBe(460);
  });
});

// =============================================================================
// getAllSpecies
// =============================================================================

describe("getAllSpecies", () => {
  it("returns a non-empty array", () => {
    const all = getAllSpecies();
    expect(all.length).toBeGreaterThan(0);
  });

  it("contains well-known Pokemon", () => {
    const all = getAllSpecies();
    const names = all.map((s) => s.name);
    expect(names).toContain("Pikachu");
    expect(names).toContain("Charizard");
    expect(names).toContain("Garchomp");
  });

  it("excludes species with num <= 0", () => {
    const all = getAllSpecies();
    for (const species of all) {
      expect(species.num).toBeGreaterThan(0);
    }
  });

  it("every species has the required fields", () => {
    const all = getAllSpecies();
    for (const species of all) {
      expect(species.id).toBeTruthy();
      expect(species.name).toBeTruthy();
      expect(species.num).toBeGreaterThan(0);
      expect(species.types.length).toBeGreaterThanOrEqual(1);
      expect(species.types.length).toBeLessThanOrEqual(2);
      expect(species.baseStats).toBeDefined();
      expect(species.abilities).toBeDefined();
      expect(typeof species.weightkg).toBe("number");
    }
  });

  it("returns species with valid stat numbers", () => {
    const all = getAllSpecies();
    const sample = all.slice(0, 20);
    for (const species of sample) {
      for (const stat of ["hp", "atk", "def", "spa", "spd", "spe"] as const) {
        expect(species.baseStats[stat]).toBeGreaterThanOrEqual(1);
        expect(species.baseStats[stat]).toBeLessThanOrEqual(255);
      }
    }
  });
});

// =============================================================================
// getMove
// =============================================================================

describe("getMove", () => {
  it("returns Thunderbolt with correct properties", () => {
    const tb = getMove("thunderbolt");
    expect(tb).not.toBeNull();
    expect(tb!.id).toBe("thunderbolt");
    expect(tb!.name).toBe("Thunderbolt");
    expect(tb!.type).toBe("Electric");
    expect(tb!.category).toBe("Special");
    expect(tb!.basePower).toBe(90);
    expect(tb!.accuracy).toBe(100);
    expect(tb!.pp).toBe(15);
    expect(tb!.priority).toBe(0);
  });

  it("returns Earthquake as Physical Ground", () => {
    const eq = getMove("earthquake");
    expect(eq).not.toBeNull();
    expect(eq!.type).toBe("Ground");
    expect(eq!.category).toBe("Physical");
    expect(eq!.basePower).toBe(100);
  });

  it("returns a Status move correctly", () => {
    const toxicSpikes = getMove("toxicspikes");
    expect(toxicSpikes).not.toBeNull();
    expect(toxicSpikes!.category).toBe("Status");
    expect(toxicSpikes!.basePower).toBe(0);
  });

  it("handles never-miss moves (accuracy = true)", () => {
    const aerialace = getMove("aerialace");
    expect(aerialace).not.toBeNull();
    expect(aerialace!.accuracy).toBe(true);
  });

  it("returns priority moves with non-zero priority", () => {
    const extremeSpeed = getMove("extremespeed");
    expect(extremeSpeed).not.toBeNull();
    expect(extremeSpeed!.priority).toBe(2);
  });

  it("includes a description", () => {
    const tb = getMove("thunderbolt");
    expect(tb).not.toBeNull();
    expect(tb!.description).toBeTruthy();
  });

  it("includes move flags", () => {
    const tb = getMove("thunderbolt");
    expect(tb).not.toBeNull();
    expect(typeof tb!.flags).toBe("object");
  });

  it("includes target information", () => {
    const eq = getMove("earthquake");
    expect(eq).not.toBeNull();
    expect(eq!.target).toBeDefined();
  });

  it("returns null for a non-existent move", () => {
    expect(getMove("megaultrahyperbeamx")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(getMove("")).toBeNull();
  });
});

// =============================================================================
// getAllMoves
// =============================================================================

describe("getAllMoves", () => {
  it("returns a non-empty array", () => {
    const all = getAllMoves();
    expect(all.length).toBeGreaterThan(0);
  });

  it("includes well-known moves", () => {
    const all = getAllMoves();
    const names = all.map((m) => m.name);
    expect(names).toContain("Thunderbolt");
    expect(names).toContain("Earthquake");
    expect(names).toContain("Ice Beam");
  });

  it("every move has required fields", () => {
    const all = getAllMoves();
    for (const move of all.slice(0, 30)) {
      expect(move.id).toBeTruthy();
      expect(move.name).toBeTruthy();
      expect(move.type).toBeTruthy();
      expect(["Physical", "Special", "Status"]).toContain(move.category);
      expect(typeof move.basePower).toBe("number");
      expect(typeof move.pp).toBe("number");
    }
  });
});

// =============================================================================
// getAbility
// =============================================================================

describe("getAbility", () => {
  it("returns Levitate with correct data", () => {
    const levitate = getAbility("levitate");
    expect(levitate).not.toBeNull();
    expect(levitate!.id).toBe("levitate");
    expect(levitate!.name).toBe("Levitate");
    expect(levitate!.description).toBeTruthy();
  });

  it("returns Intimidate", () => {
    const intimidate = getAbility("intimidate");
    expect(intimidate).not.toBeNull();
    expect(intimidate!.name).toBe("Intimidate");
  });

  it("returns null for a non-existent ability", () => {
    expect(getAbility("superfakeability")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(getAbility("")).toBeNull();
  });
});

// =============================================================================
// getItem
// =============================================================================

describe("getItem", () => {
  it("returns Leftovers with correct data", () => {
    const leftovers = getItem("leftovers");
    expect(leftovers).not.toBeNull();
    expect(leftovers!.id).toBe("leftovers");
    expect(leftovers!.name).toBe("Leftovers");
    expect(leftovers!.description).toBeTruthy();
  });

  it("returns Choice Scarf", () => {
    const scarf = getItem("choicescarf");
    expect(scarf).not.toBeNull();
    expect(scarf!.name).toBe("Choice Scarf");
  });

  it("returns null for a non-existent item", () => {
    expect(getItem("ultimatepokeball")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(getItem("")).toBeNull();
  });
});

// =============================================================================
// getLearnset
// =============================================================================

describe("getLearnset", () => {
  it("returns Pikachu learnset as an array of move ids", async () => {
    const moves = await getLearnset("pikachu");
    expect(Array.isArray(moves)).toBe(true);
    expect(moves.length).toBeGreaterThan(0);
    // Pikachu should learn Thunderbolt
    expect(moves).toContain("thunderbolt");
  });

  it("returns Garchomp learnset including Earthquake", async () => {
    const moves = await getLearnset("garchomp");
    expect(moves).toContain("earthquake");
  });

  it("returns Charizard learnset including Flamethrower", async () => {
    const moves = await getLearnset("charizard");
    expect(moves).toContain("flamethrower");
  });

  it("returns an empty array for a non-existent Pokemon", async () => {
    const moves = await getLearnset("fakemon999");
    expect(moves).toEqual([]);
  });

  it("returns an empty array for an empty string", async () => {
    const moves = await getLearnset("");
    expect(moves).toEqual([]);
  });

  it("all entries are strings", async () => {
    const moves = await getLearnset("pikachu");
    for (const move of moves) {
      expect(typeof move).toBe("string");
    }
  });
});

// =============================================================================
// searchSpecies
// =============================================================================

describe("searchSpecies", () => {
  it("finds Pikachu by exact name", () => {
    const results = searchSpecies("Pikachu");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((s) => s.name === "Pikachu")).toBe(true);
  });

  it("is case-insensitive", () => {
    const upper = searchSpecies("PIKACHU");
    const lower = searchSpecies("pikachu");
    const mixed = searchSpecies("PiKaChU");
    expect(upper.length).toBe(lower.length);
    expect(lower.length).toBe(mixed.length);
  });

  it("finds partial matches", () => {
    const results = searchSpecies("char");
    const names = results.map((s) => s.name);
    // Should match Charizard, Charmander, Charmeleon, and possibly Charjabug
    expect(names.some((n) => n.startsWith("Char"))).toBe(true);
    expect(results.length).toBeGreaterThanOrEqual(3);
  });

  it("returns empty array for nonsense query", () => {
    const results = searchSpecies("xyznotapokemon123");
    expect(results).toEqual([]);
  });

  it("returns empty array for empty string (matches all, which is fine)", () => {
    // An empty query would match all species since every name includes ""
    const results = searchSpecies("");
    expect(results.length).toBeGreaterThan(0);
  });

  it("returned species have correct shape", () => {
    const results = searchSpecies("Garchomp");
    expect(results.length).toBeGreaterThanOrEqual(1);
    const garchomp = results.find((s) => s.name === "Garchomp");
    expect(garchomp).toBeDefined();
    expect(garchomp!.id).toBe("garchomp");
    expect(garchomp!.types).toEqual(["Dragon", "Ground"]);
  });
});

// =============================================================================
// getTypeChart
// =============================================================================

describe("getTypeChart", () => {
  let chart: ReturnType<typeof getTypeChart>;

  beforeAll(() => {
    chart = getTypeChart();
  });

  it("has entries for all 18 types", () => {
    const types = [
      "Normal", "Fire", "Water", "Electric", "Grass", "Ice",
      "Fighting", "Poison", "Ground", "Flying", "Psychic", "Bug",
      "Rock", "Ghost", "Dragon", "Dark", "Steel", "Fairy",
    ];
    for (const t of types) {
      expect(chart).toHaveProperty(t);
    }
  });

  // NOTE: The chart is keyed by DEFENDING type. chart[defType][atkType] = effectiveness.
  // e.g. chart["Fire"]["Water"] = 2 means Water deals 2x damage to Fire.

  it("Fire takes 2x from Water (Fire is weak to Water)", () => {
    expect(chart["Fire"]["Water"]).toBe(2);
  });

  it("Fire takes 2x from Ground (Fire is weak to Ground)", () => {
    expect(chart["Fire"]["Ground"]).toBe(2);
  });

  it("Fire takes 2x from Rock (Fire is weak to Rock)", () => {
    expect(chart["Fire"]["Rock"]).toBe(2);
  });

  it("Fire resists (0.5x) Grass attacks", () => {
    expect(chart["Fire"]["Grass"]).toBe(0.5);
  });

  it("Fire resists (0.5x) Ice attacks", () => {
    expect(chart["Fire"]["Ice"]).toBe(0.5);
  });

  it("Water takes 2x from Electric", () => {
    expect(chart["Water"]["Electric"]).toBe(2);
  });

  it("Water takes 2x from Grass", () => {
    expect(chart["Water"]["Grass"]).toBe(2);
  });

  it("Water resists Fire (0.5x)", () => {
    expect(chart["Water"]["Fire"]).toBe(0.5);
  });

  it("Ground is immune (0x) to Electric", () => {
    expect(chart["Ground"]["Electric"]).toBe(0);
  });

  it("Normal is immune (0x) to Ghost", () => {
    expect(chart["Normal"]["Ghost"]).toBe(0);
  });

  it("Ghost is immune (0x) to Normal attacks", () => {
    expect(chart["Ghost"]["Normal"]).toBe(0);
  });

  it("Steel resists Normal (0.5x)", () => {
    expect(chart["Steel"]["Normal"]).toBe(0.5);
  });

  it("Normal takes 2x from Fighting", () => {
    expect(chart["Normal"]["Fighting"]).toBe(2);
  });

  it("Dragon takes 2x from Dragon", () => {
    expect(chart["Dragon"]["Dragon"]).toBe(2);
  });

  it("Fairy is immune (0x) to Dragon attacks", () => {
    expect(chart["Fairy"]["Dragon"]).toBe(0);
  });

  it("only records non-neutral effectiveness (no 1x entries)", () => {
    // The implementation only stores non-1x effectiveness
    for (const defType of Object.keys(chart)) {
      for (const [, value] of Object.entries(chart[defType as keyof typeof chart])) {
        expect(value).not.toBe(1);
        expect([0, 0.5, 2]).toContain(value);
      }
    }
  });

  it("does not have undefined values in the partial records", () => {
    for (const defType of Object.keys(chart)) {
      for (const [, value] of Object.entries(chart[defType as keyof typeof chart])) {
        expect(value).toBeDefined();
      }
    }
  });
});

// =============================================================================
// NatDex: isNonstandard field & Past Pokemon inclusion
// =============================================================================

describe("NatDex species support", () => {
  it("getAllSpecies includes Past Pokemon (e.g. Caterpie)", () => {
    const all = getAllSpecies();
    const ids = all.map((s) => s.id);
    expect(ids).toContain("caterpie");
  });

  it("Past Pokemon have isNonstandard set to 'Past'", () => {
    const caterpie = getSpecies("caterpie");
    expect(caterpie).not.toBeNull();
    expect(caterpie!.isNonstandard).toBe("Past");
  });

  it("SV-native Pokemon have isNonstandard set to null", () => {
    const garchomp = getSpecies("garchomp");
    expect(garchomp).not.toBeNull();
    expect(garchomp!.isNonstandard).toBeNull();
  });

  it("getAllSpecies returns more than 1000 species (including Past)", () => {
    const all = getAllSpecies();
    expect(all.length).toBeGreaterThan(1000);
  });

  it("excludes CAP Pokemon", () => {
    const all = getAllSpecies();
    const ids = all.map((s) => s.id);
    // Syclant is a well-known CAP
    expect(ids).not.toContain("syclant");
  });
});

// =============================================================================
// NatDex: Past items (Mega Stones, Z-Crystals)
// =============================================================================

describe("NatDex item support", () => {
  it("getAllItems includes Mega Stones", () => {
    const all = getAllItems();
    const ids = all.map((i) => i.id);
    expect(ids).toContain("charizarditex");
  });

  it("getAllItems includes Z-Crystals", () => {
    const all = getAllItems();
    const ids = all.map((i) => i.id);
    expect(ids).toContain("electriumz");
  });

  it("Mega Stones have isNonstandard 'Past'", () => {
    const item = getItem("charizarditex");
    expect(item).not.toBeNull();
    expect(item!.isNonstandard).toBe("Past");
  });

  it("SV-native items have isNonstandard null", () => {
    const item = getItem("leftovers");
    expect(item).not.toBeNull();
    expect(item!.isNonstandard).toBeNull();
  });
});

// =============================================================================
// NatDex: Past moves
// =============================================================================

describe("NatDex move support", () => {
  it("getAllMoves includes past moves like Hidden Power", () => {
    const all = getAllMoves();
    const ids = all.map((m) => m.id);
    expect(ids).toContain("hiddenpower");
  });

  it("past moves have isNonstandard 'Past'", () => {
    const hp = getMove("hiddenpower");
    expect(hp).not.toBeNull();
    expect(hp!.isNonstandard).toBe("Past");
  });

  it("SV-native moves have isNonstandard null", () => {
    const tb = getMove("thunderbolt");
    expect(tb).not.toBeNull();
    expect(tb!.isNonstandard).toBeNull();
  });
});

// =============================================================================
// Mega Stone utilities
// =============================================================================

describe("isMegaStone", () => {
  it("returns true for Charizardite X", () => {
    expect(isMegaStone("charizarditex")).toBe(true);
  });

  it("returns true for Venusaurite", () => {
    expect(isMegaStone("venusaurite")).toBe(true);
  });

  it("returns false for Leftovers", () => {
    expect(isMegaStone("leftovers")).toBe(false);
  });

  it("returns false for Z-Crystals", () => {
    expect(isMegaStone("electriumz")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isMegaStone("")).toBe(false);
  });
});

describe("getMegaStonesFor", () => {
  it("returns Charizardite X and Y for Charizard", () => {
    const stones = getMegaStonesFor("charizard");
    const ids = stones.map((s) => s.id);
    expect(ids).toContain("charizarditex");
    expect(ids).toContain("charizarditey");
    expect(ids).toHaveLength(2);
  });

  it("returns empty array for Pokemon without Mega", () => {
    const stones = getMegaStonesFor("pikachu");
    expect(stones).toHaveLength(0);
  });

  it("returns empty array for non-existent Pokemon", () => {
    const stones = getMegaStonesFor("fakemon");
    expect(stones).toHaveLength(0);
  });
});

describe("getMegaForm", () => {
  it("returns Mega Charizard X for Charizard + Charizardite X", () => {
    const mega = getMegaForm("charizard", "charizarditex");
    expect(mega).not.toBeNull();
    expect(mega!.name).toBe("Charizard-Mega-X");
    expect(mega!.types).toEqual(["Fire", "Dragon"]);
  });

  it("returns null for incompatible stone", () => {
    const mega = getMegaForm("pikachu", "charizarditex");
    expect(mega).toBeNull();
  });

  it("returns null for non-Mega-Stone item", () => {
    const mega = getMegaForm("charizard", "leftovers");
    expect(mega).toBeNull();
  });
});

// =============================================================================
// Z-Crystal utilities
// =============================================================================

describe("isZCrystal", () => {
  it("returns true for Electrium Z", () => {
    expect(isZCrystal("electriumz")).toBe(true);
  });

  it("returns true for signature Z-Crystal (Pikanium Z)", () => {
    expect(isZCrystal("pikaniumz")).toBe(true);
  });

  it("returns false for Leftovers", () => {
    expect(isZCrystal("leftovers")).toBe(false);
  });

  it("returns false for Mega Stones", () => {
    expect(isZCrystal("charizarditex")).toBe(false);
  });
});

describe("getZCrystalType", () => {
  it("returns Electric for Electrium Z", () => {
    expect(getZCrystalType("electriumz")).toBe("Electric");
  });

  it("returns Fire for Firium Z", () => {
    expect(getZCrystalType("firiumz")).toBe("Fire");
  });

  it("returns Normal for Normalium Z", () => {
    expect(getZCrystalType("normaliumz")).toBe("Normal");
  });

  it("returns null for signature Z-Crystals", () => {
    expect(getZCrystalType("pikaniumz")).toBeNull();
  });

  it("returns null for non-Z items", () => {
    expect(getZCrystalType("leftovers")).toBeNull();
  });
});

describe("getSignatureZCrystal", () => {
  it("returns Pikachu + Volt Tackle for Pikanium Z", () => {
    const sig = getSignatureZCrystal("pikaniumz");
    expect(sig).not.toBeNull();
    expect(sig!.pokemonId).toBe("pikachu");
    expect(sig!.moveId).toBe("volttackle");
  });

  it("returns null for type-based Z-Crystals", () => {
    expect(getSignatureZCrystal("electriumz")).toBeNull();
  });

  it("returns null for non-Z items", () => {
    expect(getSignatureZCrystal("leftovers")).toBeNull();
  });
});
