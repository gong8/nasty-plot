import {
  NATURE_DATA,
  TYPE_COLORS,
  TYPE_CHART,
  STAT_LABELS,
  STAT_COLORS,
  CURRENT_GENERATION,
  MAX_TOTAL_EVS,
  MAX_SINGLE_EV,
  MAX_IV,
  MIN_IV,
  DEFAULT_IVS,
  DEFAULT_EVS,
} from "./index";
import { POKEMON_TYPES, NATURES, STATS } from "@/shared/types";
import type { PokemonType, StatName } from "@/shared/types";

// ---------------------------------------------------------------------------
// NATURE_DATA
// ---------------------------------------------------------------------------

describe("NATURE_DATA", () => {
  it("contains exactly 25 natures", () => {
    expect(Object.keys(NATURE_DATA)).toHaveLength(25);
  });

  it("contains all canon nature names", () => {
    const expectedNatures = [
      "Adamant", "Bashful", "Bold", "Brave", "Calm",
      "Careful", "Docile", "Gentle", "Hardy", "Hasty",
      "Impish", "Jolly", "Lax", "Lonely", "Mild",
      "Modest", "Naive", "Naughty", "Quiet", "Quirky",
      "Rash", "Relaxed", "Sassy", "Serious", "Timid",
    ];

    for (const nature of expectedNatures) {
      expect(NATURE_DATA).toHaveProperty(nature);
    }
  });

  it("matches the NATURES array from types", () => {
    for (const nature of NATURES) {
      expect(NATURE_DATA).toHaveProperty(nature);
      expect(NATURE_DATA[nature].name).toBe(nature);
    }
  });

  it("has 5 neutral natures (no plus/minus)", () => {
    const neutralNatures = Object.values(NATURE_DATA).filter(
      (n) => !n.plus && !n.minus
    );
    expect(neutralNatures).toHaveLength(5);

    const neutralNames = neutralNatures.map((n) => n.name).sort();
    expect(neutralNames).toEqual(
      ["Bashful", "Docile", "Hardy", "Quirky", "Serious"].sort()
    );
  });

  it("has 20 natures with both plus and minus stats", () => {
    const nonNeutral = Object.values(NATURE_DATA).filter(
      (n) => n.plus && n.minus
    );
    expect(nonNeutral).toHaveLength(20);
  });

  it("never boosts and reduces the same stat", () => {
    for (const nature of Object.values(NATURE_DATA)) {
      if (nature.plus && nature.minus) {
        expect(nature.plus).not.toBe(nature.minus);
      }
    }
  });

  it("only references valid stat names for plus/minus", () => {
    const validStats: string[] = ["atk", "def", "spa", "spd", "spe"];

    for (const nature of Object.values(NATURE_DATA)) {
      if (nature.plus) {
        expect(validStats).toContain(nature.plus);
      }
      if (nature.minus) {
        expect(validStats).toContain(nature.minus);
      }
    }
  });

  it("has correct data for well-known natures", () => {
    expect(NATURE_DATA.Adamant).toEqual({ name: "Adamant", plus: "atk", minus: "spa" });
    expect(NATURE_DATA.Jolly).toEqual({ name: "Jolly", plus: "spe", minus: "spa" });
    expect(NATURE_DATA.Modest).toEqual({ name: "Modest", plus: "spa", minus: "atk" });
    expect(NATURE_DATA.Timid).toEqual({ name: "Timid", plus: "spe", minus: "atk" });
    expect(NATURE_DATA.Bold).toEqual({ name: "Bold", plus: "def", minus: "atk" });
    expect(NATURE_DATA.Calm).toEqual({ name: "Calm", plus: "spd", minus: "atk" });
    expect(NATURE_DATA.Impish).toEqual({ name: "Impish", plus: "def", minus: "spa" });
    expect(NATURE_DATA.Careful).toEqual({ name: "Careful", plus: "spd", minus: "spa" });
    expect(NATURE_DATA.Hardy).toEqual({ name: "Hardy" });
  });
});

// ---------------------------------------------------------------------------
// TYPE_COLORS
// ---------------------------------------------------------------------------

describe("TYPE_COLORS", () => {
  it("contains all 18 Pokemon types", () => {
    expect(Object.keys(TYPE_COLORS)).toHaveLength(18);

    for (const type of POKEMON_TYPES) {
      expect(TYPE_COLORS).toHaveProperty(type);
    }
  });

  it("all values are valid hex color strings", () => {
    const hexRegex = /^#[0-9A-Fa-f]{6}$/;

    for (const [type, color] of Object.entries(TYPE_COLORS)) {
      expect(color).toMatch(hexRegex);
    }
  });

  it("has expected colors for well-known types", () => {
    expect(TYPE_COLORS.Fire).toBe("#F08030");
    expect(TYPE_COLORS.Water).toBe("#6890F0");
    expect(TYPE_COLORS.Grass).toBe("#78C850");
    expect(TYPE_COLORS.Electric).toBe("#F8D030");
  });
});

// ---------------------------------------------------------------------------
// TYPE_CHART
// ---------------------------------------------------------------------------

describe("TYPE_CHART", () => {
  it("has entries for all 18 types as attacker", () => {
    expect(Object.keys(TYPE_CHART)).toHaveLength(18);

    for (const type of POKEMON_TYPES) {
      expect(TYPE_CHART).toHaveProperty(type);
    }
  });

  it("all effectiveness values are valid multipliers (0, 0.5, or 2)", () => {
    for (const [atkType, defMap] of Object.entries(TYPE_CHART)) {
      for (const [defType, mult] of Object.entries(defMap)) {
        expect([0, 0.5, 2]).toContain(mult);
      }
    }
  });

  // Known canonical type interactions
  describe("canonical type matchups", () => {
    it("Fire is super effective against Grass, Ice, Bug, Steel", () => {
      expect(TYPE_CHART.Fire.Grass).toBe(2);
      expect(TYPE_CHART.Fire.Ice).toBe(2);
      expect(TYPE_CHART.Fire.Bug).toBe(2);
      expect(TYPE_CHART.Fire.Steel).toBe(2);
    });

    it("Fire is not very effective against Fire, Water, Rock, Dragon", () => {
      expect(TYPE_CHART.Fire.Fire).toBe(0.5);
      expect(TYPE_CHART.Fire.Water).toBe(0.5);
      expect(TYPE_CHART.Fire.Rock).toBe(0.5);
      expect(TYPE_CHART.Fire.Dragon).toBe(0.5);
    });

    it("Water is super effective against Fire, Ground, Rock", () => {
      expect(TYPE_CHART.Water.Fire).toBe(2);
      expect(TYPE_CHART.Water.Ground).toBe(2);
      expect(TYPE_CHART.Water.Rock).toBe(2);
    });

    it("Electric is immune to Ground (Ground vs Electric = 0)", () => {
      expect(TYPE_CHART.Electric.Ground).toBe(0);
    });

    it("Normal is immune to Ghost and vice versa", () => {
      expect(TYPE_CHART.Normal.Ghost).toBe(0);
      expect(TYPE_CHART.Ghost.Normal).toBe(0);
    });

    it("Ground is immune to Flying", () => {
      expect(TYPE_CHART.Ground.Flying).toBe(0);
    });

    it("Fighting is immune to Ghost", () => {
      expect(TYPE_CHART.Fighting.Ghost).toBe(0);
    });

    it("Psychic is immune to Dark", () => {
      expect(TYPE_CHART.Psychic.Dark).toBe(0);
    });

    it("Dragon is immune to Fairy", () => {
      expect(TYPE_CHART.Dragon.Fairy).toBe(0);
    });

    it("Poison is immune to Steel", () => {
      expect(TYPE_CHART.Poison.Steel).toBe(0);
    });

    it("Electric is super effective against Water and Flying", () => {
      expect(TYPE_CHART.Electric.Water).toBe(2);
      expect(TYPE_CHART.Electric.Flying).toBe(2);
    });

    it("Fairy is super effective against Dragon, Fighting, Dark", () => {
      expect(TYPE_CHART.Fairy.Dragon).toBe(2);
      expect(TYPE_CHART.Fairy.Fighting).toBe(2);
      expect(TYPE_CHART.Fairy.Dark).toBe(2);
    });

    it("Ice is super effective against Dragon, Grass, Ground, Flying", () => {
      expect(TYPE_CHART.Ice.Dragon).toBe(2);
      expect(TYPE_CHART.Ice.Grass).toBe(2);
      expect(TYPE_CHART.Ice.Ground).toBe(2);
      expect(TYPE_CHART.Ice.Flying).toBe(2);
    });

    it("Steel is super effective against Ice, Rock, Fairy", () => {
      expect(TYPE_CHART.Steel.Ice).toBe(2);
      expect(TYPE_CHART.Steel.Rock).toBe(2);
      expect(TYPE_CHART.Steel.Fairy).toBe(2);
    });

    it("Fighting is super effective against Normal, Ice, Rock, Dark, Steel", () => {
      expect(TYPE_CHART.Fighting.Normal).toBe(2);
      expect(TYPE_CHART.Fighting.Ice).toBe(2);
      expect(TYPE_CHART.Fighting.Rock).toBe(2);
      expect(TYPE_CHART.Fighting.Dark).toBe(2);
      expect(TYPE_CHART.Fighting.Steel).toBe(2);
    });

    it("Ghost is super effective against Psychic and Ghost", () => {
      expect(TYPE_CHART.Ghost.Psychic).toBe(2);
      expect(TYPE_CHART.Ghost.Ghost).toBe(2);
    });

    it("Dark is super effective against Psychic and Ghost", () => {
      expect(TYPE_CHART.Dark.Psychic).toBe(2);
      expect(TYPE_CHART.Dark.Ghost).toBe(2);
    });
  });

  it("omits neutral (1x) matchups (only non-neutral entries stored)", () => {
    // TYPE_CHART only stores non-1x matchups
    // For example, Fire vs Normal should be undefined (1x)
    expect(TYPE_CHART.Fire.Normal).toBeUndefined();
    expect(TYPE_CHART.Water.Normal).toBeUndefined();
    expect(TYPE_CHART.Normal.Normal).toBeUndefined();
  });

  it("all defending types referenced are valid Pokemon types", () => {
    for (const [, defMap] of Object.entries(TYPE_CHART)) {
      for (const defType of Object.keys(defMap)) {
        expect(POKEMON_TYPES).toContain(defType);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// STAT_LABELS
// ---------------------------------------------------------------------------

describe("STAT_LABELS", () => {
  it("has labels for all 6 stats", () => {
    expect(Object.keys(STAT_LABELS)).toHaveLength(6);

    for (const stat of STATS) {
      expect(STAT_LABELS).toHaveProperty(stat);
    }
  });

  it("has correct display labels", () => {
    expect(STAT_LABELS.hp).toBe("HP");
    expect(STAT_LABELS.atk).toBe("Atk");
    expect(STAT_LABELS.def).toBe("Def");
    expect(STAT_LABELS.spa).toBe("SpA");
    expect(STAT_LABELS.spd).toBe("SpD");
    expect(STAT_LABELS.spe).toBe("Spe");
  });
});

// ---------------------------------------------------------------------------
// STAT_COLORS
// ---------------------------------------------------------------------------

describe("STAT_COLORS", () => {
  it("has colors for all 6 stats", () => {
    expect(Object.keys(STAT_COLORS)).toHaveLength(6);

    for (const stat of STATS) {
      expect(STAT_COLORS).toHaveProperty(stat);
    }
  });

  it("all values are valid hex color strings", () => {
    const hexRegex = /^#[0-9A-Fa-f]{6}$/;

    for (const color of Object.values(STAT_COLORS)) {
      expect(color).toMatch(hexRegex);
    }
  });
});

// ---------------------------------------------------------------------------
// Scalar constants
// ---------------------------------------------------------------------------

describe("scalar constants", () => {
  it("CURRENT_GENERATION is 9", () => {
    expect(CURRENT_GENERATION).toBe(9);
  });

  it("MAX_TOTAL_EVS is 510", () => {
    expect(MAX_TOTAL_EVS).toBe(510);
  });

  it("MAX_SINGLE_EV is 252", () => {
    expect(MAX_SINGLE_EV).toBe(252);
  });

  it("MAX_IV is 31", () => {
    expect(MAX_IV).toBe(31);
  });

  it("MIN_IV is 0", () => {
    expect(MIN_IV).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// DEFAULT_IVS and DEFAULT_EVS
// ---------------------------------------------------------------------------

describe("DEFAULT_IVS", () => {
  it("has all 6 stats set to 31", () => {
    expect(DEFAULT_IVS).toEqual({
      hp: 31,
      atk: 31,
      def: 31,
      spa: 31,
      spd: 31,
      spe: 31,
    });
  });
});

describe("DEFAULT_EVS", () => {
  it("has all 6 stats set to 0", () => {
    expect(DEFAULT_EVS).toEqual({
      hp: 0,
      atk: 0,
      def: 0,
      spa: 0,
      spd: 0,
      spe: 0,
    });
  });
});
