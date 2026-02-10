import {
  getTypeEffectiveness,
  getWeaknesses,
  getResistances,
  getImmunities,
  getDefensiveProfile,
  getOffensiveCoverage,
} from "./type-chart";
import type { PokemonType } from "@/shared/types";

// ---------------------------------------------------------------------------
// getTypeEffectiveness - single type defense
// ---------------------------------------------------------------------------

describe("getTypeEffectiveness - single defending type", () => {
  // Super effective
  it("Water vs Fire is 2x", () => {
    expect(getTypeEffectiveness("Water", ["Fire"])).toBe(2);
  });

  it("Fire vs Grass is 2x", () => {
    expect(getTypeEffectiveness("Fire", ["Grass"])).toBe(2);
  });

  it("Electric vs Water is 2x", () => {
    expect(getTypeEffectiveness("Electric", ["Water"])).toBe(2);
  });

  it("Ground vs Electric is 2x", () => {
    expect(getTypeEffectiveness("Ground", ["Electric"])).toBe(2);
  });

  it("Ice vs Dragon is 2x", () => {
    expect(getTypeEffectiveness("Ice", ["Dragon"])).toBe(2);
  });

  it("Fairy vs Dragon is 2x", () => {
    expect(getTypeEffectiveness("Fairy", ["Dragon"])).toBe(2);
  });

  // Not very effective
  it("Fire vs Water is 0.5x", () => {
    expect(getTypeEffectiveness("Fire", ["Water"])).toBe(0.5);
  });

  it("Grass vs Fire is 0.5x", () => {
    expect(getTypeEffectiveness("Grass", ["Fire"])).toBe(0.5);
  });

  it("Normal vs Rock is 0.5x", () => {
    expect(getTypeEffectiveness("Normal", ["Rock"])).toBe(0.5);
  });

  // Immunities (0x)
  it("Normal vs Ghost is 0x", () => {
    expect(getTypeEffectiveness("Normal", ["Ghost"])).toBe(0);
  });

  it("Ghost vs Normal is 0x", () => {
    expect(getTypeEffectiveness("Ghost", ["Normal"])).toBe(0);
  });

  it("Electric vs Ground is 0x", () => {
    expect(getTypeEffectiveness("Electric", ["Ground"])).toBe(0);
  });

  it("Ground vs Flying is 0x", () => {
    expect(getTypeEffectiveness("Ground", ["Flying"])).toBe(0);
  });

  it("Fighting vs Ghost is 0x", () => {
    expect(getTypeEffectiveness("Fighting", ["Ghost"])).toBe(0);
  });

  it("Psychic vs Dark is 0x", () => {
    expect(getTypeEffectiveness("Psychic", ["Dark"])).toBe(0);
  });

  it("Poison vs Steel is 0x", () => {
    expect(getTypeEffectiveness("Poison", ["Steel"])).toBe(0);
  });

  it("Dragon vs Fairy is 0x", () => {
    expect(getTypeEffectiveness("Dragon", ["Fairy"])).toBe(0);
  });

  // Neutral (1x, not in chart = defaults to 1)
  it("Normal vs Normal is 1x", () => {
    expect(getTypeEffectiveness("Normal", ["Normal"])).toBe(1);
  });

  it("Fire vs Normal is 1x", () => {
    expect(getTypeEffectiveness("Fire", ["Normal"])).toBe(1);
  });

  it("Water vs Psychic is 1x", () => {
    expect(getTypeEffectiveness("Water", ["Psychic"])).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// getTypeEffectiveness - dual type defense
// ---------------------------------------------------------------------------

describe("getTypeEffectiveness - dual type defense", () => {
  // 4x weakness
  it("Ice vs Dragon/Ground (Garchomp) is 4x", () => {
    expect(getTypeEffectiveness("Ice", ["Dragon", "Ground"])).toBe(4);
  });

  it("Ground vs Fire/Steel (Heatran) is 4x", () => {
    expect(getTypeEffectiveness("Ground", ["Fire", "Steel"])).toBe(4);
  });

  it("Fighting vs Normal/Rock is 4x", () => {
    expect(getTypeEffectiveness("Fighting", ["Normal", "Rock"])).toBe(4);
  });

  // Double resistance (0.25x)
  it("Fire vs Fire/Dragon is 0.25x", () => {
    expect(getTypeEffectiveness("Fire", ["Fire", "Dragon"])).toBe(0.25);
  });

  it("Grass vs Grass/Dragon is 0.25x", () => {
    expect(getTypeEffectiveness("Grass", ["Grass", "Dragon"])).toBe(0.25);
  });

  // Immunity overrides super effective
  it("Ground vs Electric/Flying is 0x (Flying immune to Ground)", () => {
    expect(getTypeEffectiveness("Ground", ["Electric", "Flying"])).toBe(0);
  });

  it("Electric vs Water/Ground is 0x (Ground immune to Electric)", () => {
    expect(getTypeEffectiveness("Electric", ["Water", "Ground"])).toBe(0);
  });

  // Normal effectiveness on dual type
  it("Water vs Grass/Poison is 0.5x (Grass resists, Poison neutral)", () => {
    expect(getTypeEffectiveness("Water", ["Grass", "Poison"])).toBe(0.5);
  });

  // Super effective cancelled by resistance
  it("Fire vs Grass/Water is 1x (2x on Grass, 0.5x on Water)", () => {
    expect(getTypeEffectiveness("Fire", ["Grass", "Water"])).toBe(1);
  });

  it("Ice vs Water/Ground is 1x (0.5x on Water, 2x on Ground cancel out)", () => {
    // TYPE_CHART.Ice.Water = 0.5, TYPE_CHART.Ice.Ground = 2 => 0.5 * 2 = 1
    expect(getTypeEffectiveness("Ice", ["Water", "Ground"])).toBe(1);
  });

  // Fairy/Steel combination
  it("Fire vs Fairy/Steel is 2x (neutral on Fairy, 2x on Steel)", () => {
    // Fire has no entry for Fairy in TYPE_CHART => 1 (neutral). Fire vs Steel = 2.
    // 1 * 2 = 2
    expect(getTypeEffectiveness("Fire", ["Fairy", "Steel"])).toBe(2);
  });

  it("Ground vs Fairy/Steel is 2x (neutral on Fairy, 2x on Steel)", () => {
    // Ground vs Fairy: not in chart => 1, Ground vs Steel: 2 => 1 * 2 = 2
    expect(getTypeEffectiveness("Ground", ["Fairy", "Steel"])).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// getTypeEffectiveness - empty defense
// ---------------------------------------------------------------------------

describe("getTypeEffectiveness - edge cases", () => {
  it("returns 1 for empty defense types array", () => {
    expect(getTypeEffectiveness("Fire", [])).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// getWeaknesses
// ---------------------------------------------------------------------------

describe("getWeaknesses", () => {
  it("returns Fire weaknesses for Grass mono-type", () => {
    const weaknesses = getWeaknesses(["Grass"]);
    expect(weaknesses).toContain("Fire");
    expect(weaknesses).toContain("Ice");
    expect(weaknesses).toContain("Poison");
    expect(weaknesses).toContain("Flying");
    expect(weaknesses).toContain("Bug");
  });

  it("does not include resisted or neutral types in weaknesses", () => {
    const weaknesses = getWeaknesses(["Grass"]);
    expect(weaknesses).not.toContain("Water");
    expect(weaknesses).not.toContain("Grass");
    expect(weaknesses).not.toContain("Ground");
    expect(weaknesses).not.toContain("Electric");
    expect(weaknesses).not.toContain("Normal");
  });

  it("returns weaknesses for dual-type (Steel/Fairy)", () => {
    const weaknesses = getWeaknesses(["Steel", "Fairy"]);
    // Steel/Fairy is weak to: Fire (2x: 0.5 on Fairy, 2 on Steel = 1... wait)
    // Actually: Fire vs Steel = 0.5 per chart (Fire resisted by... no, Steel chart entry)
    // Let me check: TYPE_CHART.Fire = { Fire: 0.5, Water: 0.5, Grass: 2, Ice: 2, Bug: 2, Rock: 0.5, Dragon: 0.5, Steel: 2 }
    // Fire vs Fairy: not in Fire's chart, so 1.
    // Fire vs Steel: 2.  So Fire vs Steel/Fairy = 1 * 2 = 2 -> weakness
    // Ground vs Steel: TYPE_CHART.Ground = { Fire: 2, Electric: 2, Grass: 0.5, Poison: 2, Flying: 0, Bug: 0.5, Rock: 2, Steel: 2 }
    // Ground vs Fairy: not in chart = 1. Ground vs Steel = 2. So 2 -> weakness
    expect(weaknesses).toContain("Fire");
    expect(weaknesses).toContain("Ground");
  });

  it("includes 4x weaknesses for dual-type", () => {
    // Dragon/Ground is 4x weak to Ice
    const weaknesses = getWeaknesses(["Dragon", "Ground"]);
    expect(weaknesses).toContain("Ice");
  });

  it("returns empty array for a type with no weaknesses (hypothetical check)", () => {
    // Every single type has at least one weakness, but this tests the filter logic
    const weaknesses = getWeaknesses(["Normal"]);
    expect(weaknesses).toContain("Fighting");
    expect(weaknesses.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// getResistances
// ---------------------------------------------------------------------------

describe("getResistances", () => {
  it("returns resistances for Steel type", () => {
    const resistances = getResistances(["Steel"]);
    // Steel resists many types. Let's check some known ones.
    // Types that hit Steel for 0.5x: Normal (0.5), Grass (0.5), Ice (0.5),
    // Flying (0.5), Psychic (0.5), Bug (0.5), Rock (0.5), Dragon (0.5),
    // Steel (0.5), Fairy (0.5)
    // We need to check: what attacks Steel and gets 0.5?
    // TYPE_CHART[X].Steel entries:
    // Normal -> Steel: 0.5 => Normal is resisted
    // Grass -> Steel: 0.5
    // Ice -> Steel: 0.5
    // Bug -> Steel: 0.5
    // Rock -> Steel: 0.5
    // Fairy -> Steel: 0.5
    // Dragon -> Steel: 0.5
    // Flying -> Steel: 0.5
    // Psychic -> Steel: 0.5
    // Dark -> not in chart => 1 (neutral)
    expect(resistances).toContain("Normal");
    expect(resistances).toContain("Grass");
    expect(resistances).toContain("Ice");
    expect(resistances).toContain("Bug");
    expect(resistances).toContain("Rock");
    expect(resistances).toContain("Fairy");
    expect(resistances).toContain("Dragon");
  });

  it("does not include immunities in resistances", () => {
    // Ghost is immune to Normal and Fighting, those should NOT be in resistances
    const resistances = getResistances(["Ghost"]);
    expect(resistances).not.toContain("Normal");
    expect(resistances).not.toContain("Fighting");
  });

  it("returns resistances for dual-type Water/Ground", () => {
    const resistances = getResistances(["Water", "Ground"]);
    // Fire vs Water: TYPE_CHART.Fire.Water = 0.5, Fire vs Ground: not in chart => 1. 0.5*1 = 0.5 (resisted)
    // Poison vs Water: not in chart => 1, Poison vs Ground: TYPE_CHART.Poison.Ground = 0.5. 1*0.5 = 0.5 (resisted)
    // Rock vs Water: not in chart => 1, Rock vs Ground: TYPE_CHART.Rock.Ground = 0.5. 1*0.5 = 0.5 (resisted)
    // Steel vs Water: TYPE_CHART.Steel.Water = 0.5, Steel vs Ground: not in chart => 1. 0.5*1 = 0.5 (resisted)
    expect(resistances).toContain("Fire");
    expect(resistances).toContain("Poison");
    expect(resistances).toContain("Rock");
    expect(resistances).toContain("Steel");
  });

  it("includes double resistances (0.25x)", () => {
    // Fire/Dragon double-resists Fire: Fire vs Fire = 0.5, Fire vs Dragon = 0.5 => 0.25
    const resistances = getResistances(["Fire", "Dragon"]);
    expect(resistances).toContain("Fire");
    // Grass should also be resisted: Grass vs Fire = 0.5, Grass vs Dragon = 0.5 => 0.25
    expect(resistances).toContain("Grass");
  });
});

// ---------------------------------------------------------------------------
// getImmunities
// ---------------------------------------------------------------------------

describe("getImmunities", () => {
  it("Normal type is immune to Ghost", () => {
    const immunities = getImmunities(["Normal"]);
    expect(immunities).toContain("Ghost");
  });

  it("Ghost type is immune to Normal and Fighting", () => {
    const immunities = getImmunities(["Ghost"]);
    expect(immunities).toContain("Normal");
    expect(immunities).toContain("Fighting");
  });

  it("Flying type is immune to Ground", () => {
    const immunities = getImmunities(["Flying"]);
    expect(immunities).toContain("Ground");
  });

  it("Ground type is immune to Electric", () => {
    const immunities = getImmunities(["Ground"]);
    expect(immunities).toContain("Electric");
  });

  it("Dark type is immune to Psychic", () => {
    const immunities = getImmunities(["Dark"]);
    expect(immunities).toContain("Psychic");
  });

  it("Fairy type is immune to Dragon", () => {
    const immunities = getImmunities(["Fairy"]);
    expect(immunities).toContain("Dragon");
  });

  it("Steel type is immune to Poison", () => {
    const immunities = getImmunities(["Steel"]);
    expect(immunities).toContain("Poison");
  });

  it("dual-type inherits immunity from one type", () => {
    // Water/Flying: immune to Ground via Flying
    const immunities = getImmunities(["Water", "Flying"]);
    expect(immunities).toContain("Ground");
  });

  it("dual-type with immunity that overrides super-effectiveness", () => {
    // Electric/Flying: Ground is super-effective on Electric but Flying is immune
    // Ground vs Electric = 2, Ground vs Flying = 0 => 2*0 = 0
    const immunities = getImmunities(["Electric", "Flying"]);
    expect(immunities).toContain("Ground");
  });

  it("returns empty for type with no immunities", () => {
    const immunities = getImmunities(["Water"]);
    expect(immunities).toEqual([]);
  });

  it("returns empty for Grass (no immunities)", () => {
    const immunities = getImmunities(["Grass"]);
    expect(immunities).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getDefensiveProfile
// ---------------------------------------------------------------------------

describe("getDefensiveProfile", () => {
  it("returns correct profile for mono Fire", () => {
    const profile = getDefensiveProfile(["Fire"]);

    // Fire is weak to: Water, Ground, Rock (each 2x from type chart attacking Fire)
    // We need to find which types have Fire in their chart with > 1 multiplier
    // TYPE_CHART[Water].Fire = 2 => Water is 2x
    // TYPE_CHART[Ground].Fire = 2 => Ground is 2x
    // TYPE_CHART[Rock].Fire = 2 => Rock is 2x
    expect(profile["2x"]).toContain("Water");
    expect(profile["2x"]).toContain("Ground");
    expect(profile["2x"]).toContain("Rock");
    expect(profile["4x"]).toEqual([]);

    // Fire resists: Fire(0.5), Grass(2 for attacking Fire? No: we need chart[X].Fire)
    // TYPE_CHART[Fire].Fire = 0.5 => Fire resists Fire
    // TYPE_CHART[Grass].Fire = 0.5 => Grass is resisted
    // TYPE_CHART[Ice].Fire = 0.5 => Ice is resisted
    // TYPE_CHART[Bug].Fire = 0.5 => Bug is resisted
    // TYPE_CHART[Steel].Fire = 0.5 => Steel is resisted
    // TYPE_CHART[Fairy].Fire = 0.5 => Fairy is resisted
    expect(profile["0.5x"]).toContain("Fire");
    expect(profile["0.5x"]).toContain("Grass");
    expect(profile["0.5x"]).toContain("Ice");
    expect(profile["0.5x"]).toContain("Bug");
    expect(profile["0.5x"]).toContain("Steel");
    expect(profile["0.5x"]).toContain("Fairy");

    expect(profile["0x"]).toEqual([]);
  });

  it("returns 4x weakness for Dragon/Ground vs Ice", () => {
    const profile = getDefensiveProfile(["Dragon", "Ground"]);
    expect(profile["4x"]).toContain("Ice");
  });

  it("returns 0.25x for Fire/Dragon vs Fire", () => {
    const profile = getDefensiveProfile(["Fire", "Dragon"]);
    // Fire vs Fire = 0.5, Fire vs Dragon = 0.5 => 0.25
    expect(profile["0.25x"]).toContain("Fire");
  });

  it("returns 0x (immunity) for Normal/Ghost vs Normal and Fighting", () => {
    const profile = getDefensiveProfile(["Normal", "Ghost"]);
    // Normal vs Ghost = 0 => immune; also Ghost vs Normal = 0 => immune
    // But wait: Normal attacks against Normal/Ghost:
    // TYPE_CHART[Normal].Ghost = 0. Normal * Ghost = 1 * 0 = 0. Immune.
    // Fighting vs Normal/Ghost:
    // TYPE_CHART[Fighting].Normal = 2, TYPE_CHART[Fighting].Ghost = 0 => 2*0 = 0. Immune.
    expect(profile["0x"]).toContain("Normal");
    expect(profile["0x"]).toContain("Fighting");
  });

  it("contains all 18 types distributed across buckets", () => {
    const profile = getDefensiveProfile(["Water"]);
    const allTypes = [
      ...profile["4x"],
      ...profile["2x"],
      ...profile["1x"],
      ...profile["0.5x"],
      ...profile["0.25x"],
      ...profile["0x"],
    ];
    expect(allTypes).toHaveLength(18);
  });

  it("returns all neutral for empty types", () => {
    // Edge case: empty types array means all multipliers are 1
    const profile = getDefensiveProfile([]);
    expect(profile["1x"]).toHaveLength(18);
    expect(profile["2x"]).toHaveLength(0);
    expect(profile["0.5x"]).toHaveLength(0);
    expect(profile["0x"]).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getOffensiveCoverage
// ---------------------------------------------------------------------------

describe("getOffensiveCoverage", () => {
  it("returns types that Fire hits super-effectively", () => {
    const coverage = getOffensiveCoverage("Fire");
    // TYPE_CHART.Fire: Grass: 2, Ice: 2, Bug: 2, Steel: 2
    expect(coverage).toContain("Grass");
    expect(coverage).toContain("Ice");
    expect(coverage).toContain("Bug");
    expect(coverage).toContain("Steel");
    expect(coverage).toHaveLength(4);
  });

  it("returns types that Ground hits super-effectively", () => {
    const coverage = getOffensiveCoverage("Ground");
    // TYPE_CHART.Ground: Fire: 2, Electric: 2, Poison: 2, Rock: 2, Steel: 2
    expect(coverage).toContain("Fire");
    expect(coverage).toContain("Electric");
    expect(coverage).toContain("Poison");
    expect(coverage).toContain("Rock");
    expect(coverage).toContain("Steel");
    expect(coverage).toHaveLength(5);
  });

  it("does not include types that are resisted, immune, or neutral", () => {
    const coverage = getOffensiveCoverage("Fire");
    expect(coverage).not.toContain("Water");
    expect(coverage).not.toContain("Fire");
    expect(coverage).not.toContain("Rock");
    expect(coverage).not.toContain("Dragon");
    expect(coverage).not.toContain("Normal");
  });

  it("returns coverage for Fighting type", () => {
    const coverage = getOffensiveCoverage("Fighting");
    // TYPE_CHART.Fighting: Normal: 2, Ice: 2, Rock: 2, Dark: 2, Steel: 2
    expect(coverage).toContain("Normal");
    expect(coverage).toContain("Ice");
    expect(coverage).toContain("Rock");
    expect(coverage).toContain("Dark");
    expect(coverage).toContain("Steel");
    expect(coverage).toHaveLength(5);
  });

  it("returns coverage for Dragon type (only hits Dragon SE)", () => {
    const coverage = getOffensiveCoverage("Dragon");
    // TYPE_CHART.Dragon: Dragon: 2, Steel: 0.5, Fairy: 0
    expect(coverage).toContain("Dragon");
    expect(coverage).toHaveLength(1);
  });

  it("returns coverage for Normal type (hits nothing SE)", () => {
    const coverage = getOffensiveCoverage("Normal");
    // TYPE_CHART.Normal: Rock: 0.5, Ghost: 0, Steel: 0.5 => nothing > 1
    expect(coverage).toHaveLength(0);
  });

  it("returns coverage for Ice type", () => {
    const coverage = getOffensiveCoverage("Ice");
    // TYPE_CHART.Ice: Grass: 2, Ground: 2, Flying: 2, Dragon: 2
    expect(coverage).toContain("Grass");
    expect(coverage).toContain("Ground");
    expect(coverage).toContain("Flying");
    expect(coverage).toContain("Dragon");
    expect(coverage).toHaveLength(4);
  });

  it("returns coverage for Ghost type", () => {
    const coverage = getOffensiveCoverage("Ghost");
    // TYPE_CHART.Ghost: Psychic: 2, Ghost: 2, Normal: 0, Dark: 0.5
    expect(coverage).toContain("Psychic");
    expect(coverage).toContain("Ghost");
    expect(coverage).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Cross-check: weaknesses + resistances + immunities + neutrals = 18
// ---------------------------------------------------------------------------

describe("coverage completeness", () => {
  const allTypes: PokemonType[] = [
    "Normal", "Fire", "Water", "Electric", "Grass", "Ice",
    "Fighting", "Poison", "Ground", "Flying", "Psychic", "Bug",
    "Rock", "Ghost", "Dragon", "Dark", "Steel", "Fairy",
  ];

  it.each(allTypes)(
    "weaknesses + resistances + immunities + neutrals = 18 for %s",
    (type) => {
      const weaknesses = getWeaknesses([type]);
      const resistances = getResistances([type]);
      const immunities = getImmunities([type]);
      // Neutral are those not in any of the above
      const nonNeutral = new Set([...weaknesses, ...resistances, ...immunities]);
      const neutralCount = 18 - nonNeutral.size;

      expect(weaknesses.length + resistances.length + immunities.length + neutralCount).toBe(18);
      // Also verify no overlaps
      const combined = [...weaknesses, ...resistances, ...immunities];
      expect(new Set(combined).size).toBe(combined.length);
    }
  );
});
