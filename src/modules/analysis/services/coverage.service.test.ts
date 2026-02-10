import type { TeamSlotData, PokemonType, StatsTable } from "@/shared/types";
import { analyzeTypeCoverage } from "./coverage.service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultStats: StatsTable = { hp: 80, atk: 80, def: 80, spa: 80, spd: 80, spe: 80 };
const defaultEvs: StatsTable = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
const defaultIvs: StatsTable = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };

function makeSlot(
  pokemonId: string,
  types: [PokemonType] | [PokemonType, PokemonType],
  overrides?: Partial<TeamSlotData>,
  baseStats?: Partial<StatsTable>
): TeamSlotData {
  return {
    position: 1,
    pokemonId,
    species: {
      id: pokemonId,
      name: pokemonId,
      num: 1,
      types,
      baseStats: { ...defaultStats, ...(baseStats ?? {}) },
      abilities: { "0": "Ability" },
      weightkg: 50,
    },
    ability: "Ability",
    item: "",
    nature: "Adamant",
    level: 100,
    moves: ["move1", undefined, undefined, undefined],
    evs: defaultEvs,
    ivs: defaultIvs,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("analyzeTypeCoverage", () => {
  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  it("returns zeroed coverage for an empty team", () => {
    const result = analyzeTypeCoverage([]);

    // Every offensive entry should be 0
    for (const val of Object.values(result.offensive)) {
      expect(val).toBe(0);
    }
    for (const val of Object.values(result.defensive)) {
      expect(val).toBe(0);
    }
    // All 18 types are uncovered
    expect(result.uncoveredTypes).toHaveLength(18);
    expect(result.sharedWeaknesses).toHaveLength(0);
  });

  it("handles a slot with no species data gracefully", () => {
    const slot: TeamSlotData = {
      position: 1,
      pokemonId: "unknown",
      species: undefined,
      ability: "",
      item: "",
      nature: "Hardy",
      level: 100,
      moves: ["tackle", undefined, undefined, undefined],
      evs: defaultEvs,
      ivs: defaultIvs,
    };
    const result = analyzeTypeCoverage([slot]);

    // Should still return valid structure; no types contributed
    expect(result.uncoveredTypes).toHaveLength(18);
    expect(result.sharedWeaknesses).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // Offensive coverage
  // -----------------------------------------------------------------------

  describe("offensive coverage", () => {
    it("Water type covers Fire, Ground, Rock super-effectively", () => {
      const team = [makeSlot("quagsire", ["Water", "Ground"])];
      const result = analyzeTypeCoverage(team);

      // Water STAB covers: Fire, Ground, Rock
      expect(result.offensive["Fire"]).toBeGreaterThan(0);
      expect(result.offensive["Ground"]).toBeGreaterThan(0);
      expect(result.offensive["Rock"]).toBeGreaterThan(0);
    });

    it("Ground type covers Fire, Electric, Poison, Rock, Steel", () => {
      const team = [makeSlot("quagsire", ["Water", "Ground"])];
      const result = analyzeTypeCoverage(team);

      // Ground STAB coverage
      expect(result.offensive["Electric"]).toBeGreaterThan(0);
      expect(result.offensive["Poison"]).toBeGreaterThan(0);
      expect(result.offensive["Steel"]).toBeGreaterThan(0);
    });

    it("Dragon/Flying (Salamence) covers the right types", () => {
      const team = [makeSlot("salamence", ["Dragon", "Flying"])];
      const result = analyzeTypeCoverage(team);

      // Dragon hits Dragon super-effectively
      expect(result.offensive["Dragon"]).toBeGreaterThan(0);
      // Flying hits Grass, Fighting, Bug
      expect(result.offensive["Grass"]).toBeGreaterThan(0);
      expect(result.offensive["Fighting"]).toBeGreaterThan(0);
      expect(result.offensive["Bug"]).toBeGreaterThan(0);
    });

    it("multiple team members contribute additive offensive counts", () => {
      const team = [
        makeSlot("charizard", ["Fire", "Flying"]),
        makeSlot("blastoise", ["Water"]),
      ];
      const result = analyzeTypeCoverage(team);

      // Both Fire and Water can hit Ice super-effectively
      // Fire: hits Grass, Ice, Bug, Steel
      // Water: hits Fire, Ground, Rock
      // Ice is hit by Fire (from Charizard), so offensive["Ice"] should be >= 1
      expect(result.offensive["Ice"]).toBeGreaterThanOrEqual(1);
      // Grass hit by both Fire and Flying from Charizard
      expect(result.offensive["Grass"]).toBeGreaterThanOrEqual(1);
    });

    it("correctly identifies uncovered types", () => {
      // A pure Normal type has no super-effective offensive coverage
      const team = [makeSlot("snorlax", ["Normal"])];
      const result = analyzeTypeCoverage(team);

      // Normal hits nothing super-effectively so many types remain uncovered
      // Normal's offensive chart: Rock 0.5, Ghost 0, Steel 0.5 - nothing is > 1
      expect(result.uncoveredTypes).toContain("Normal");
    });
  });

  // -----------------------------------------------------------------------
  // Defensive coverage
  // -----------------------------------------------------------------------

  describe("defensive coverage", () => {
    it("Water/Ground (Quagsire) resists the expected types", () => {
      const team = [makeSlot("quagsire", ["Water", "Ground"])];
      const result = analyzeTypeCoverage(team);

      // Water/Ground resists: Fire (0.5), Poison (0.5), Rock (0.5), Steel (0.5)
      // Immune to: Electric (0)
      expect(result.defensive["Fire"]).toBe(1);
      expect(result.defensive["Poison"]).toBe(1);
      expect(result.defensive["Rock"]).toBe(1);
      expect(result.defensive["Steel"]).toBe(1);
      expect(result.defensive["Electric"]).toBe(1); // immunity counts as resist (<1)
    });

    it("Steel/Fairy resists many types", () => {
      const team = [makeSlot("magearna", ["Steel", "Fairy"])];
      const result = analyzeTypeCoverage(team);

      // Steel/Fairy has many resistances: Normal, Grass, Ice, Flying, Psychic, Bug,
      // Rock, Dark, Dragon (immune), Fairy, Poison (immune - wait, actually Steel resists
      // Poison at 0.5... let's check)
      // Steel resists: Normal, Grass, Ice, Flying, Psychic, Bug, Rock, Dragon, Steel, Fairy
      // Fairy resists: Fighting, Bug, Dark; immune to Dragon
      // Combined: many resists
      expect(result.defensive["Dragon"]).toBe(1); // immune
      expect(result.defensive["Bug"]).toBe(1);
      expect(result.defensive["Dark"]).toBe(1);
      expect(result.defensive["Normal"]).toBe(1);
    });

    it("multiple resistors are counted", () => {
      const team = [
        makeSlot("quagsire", ["Water", "Ground"]),
        makeSlot("ferrothorn", ["Grass", "Steel"]),
      ];
      const result = analyzeTypeCoverage(team);

      // Both resist Electric:
      // Water/Ground: Ground is immune to Electric => eff = 0 => <1 (counts)
      // Grass/Steel: Grass resists Electric (0.5), Steel resists Electric (0.5) => eff = 0.25 => <1 (counts)
      expect(result.defensive["Electric"]).toBe(2);
    });
  });

  // -----------------------------------------------------------------------
  // Shared weaknesses
  // -----------------------------------------------------------------------

  describe("shared weaknesses", () => {
    it("identifies shared Grass weakness for Water/Ground and Water/Rock", () => {
      const team = [
        makeSlot("quagsire", ["Water", "Ground"]),
        makeSlot("kabutops", ["Water", "Rock"]),
      ];
      const result = analyzeTypeCoverage(team);

      // Water/Ground: 4x weak to Grass
      // Water/Rock: weak to Grass
      expect(result.sharedWeaknesses).toContain("Grass");
    });

    it("identifies shared Ice weakness for Dragon/Flying and Ground/Flying", () => {
      const team = [
        makeSlot("salamence", ["Dragon", "Flying"]),
        makeSlot("gliscor", ["Ground", "Flying"]),
      ];
      const result = analyzeTypeCoverage(team);

      // Dragon/Flying: 4x weak to Ice
      // Ground/Flying: 4x weak to Ice
      expect(result.sharedWeaknesses).toContain("Ice");
    });

    it("returns empty shared weaknesses when types are complementary", () => {
      // Water resists Fire/Ice, Fire resists Grass/Ice/Bug/Steel
      // They don't share weaknesses typically
      const team = [
        makeSlot("arcanine", ["Fire"]),
        makeSlot("vaporeon", ["Water"]),
      ];
      const result = analyzeTypeCoverage(team);

      // Fire weak to: Water, Ground, Rock
      // Water weak to: Electric, Grass
      // No overlap => no shared weaknesses
      expect(result.sharedWeaknesses).toHaveLength(0);
    });

    it("does not flag a weakness shared by only 1 member", () => {
      const team = [makeSlot("charizard", ["Fire", "Flying"])];
      const result = analyzeTypeCoverage(team);

      // Only 1 member, so no type can have 2+ weaknesses
      expect(result.sharedWeaknesses).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Full team scenarios
  // -----------------------------------------------------------------------

  describe("full team scenarios", () => {
    it("balanced team has good coverage and few shared weaknesses", () => {
      const team = [
        makeSlot("garchomp", ["Dragon", "Ground"]),
        makeSlot("corviknight", ["Flying", "Steel"]),
        makeSlot("rotom-wash", ["Electric", "Water"]),
      ];
      const result = analyzeTypeCoverage(team);

      // This team covers many types offensively
      // Dragon: hits Dragon
      // Ground: hits Fire, Electric, Poison, Rock, Steel
      // Flying: hits Grass, Fighting, Bug
      // Steel: hits Ice, Rock, Fairy
      // Electric: hits Water, Flying
      // Water: hits Fire, Ground, Rock

      // Should have few uncovered types
      expect(result.uncoveredTypes.length).toBeLessThan(10);

      // Coverage structure should be valid
      expect(result.offensive).toBeDefined();
      expect(result.defensive).toBeDefined();
    });

    it("mono-type team has many shared weaknesses", () => {
      const team = [
        makeSlot("gyarados", ["Water", "Flying"]),
        makeSlot("vaporeon", ["Water"]),
        makeSlot("starmie", ["Water", "Psychic"]),
      ];
      const result = analyzeTypeCoverage(team);

      // All are Water type => all weak to Electric
      expect(result.sharedWeaknesses).toContain("Electric");
    });
  });

  // -----------------------------------------------------------------------
  // Return shape
  // -----------------------------------------------------------------------

  describe("return shape", () => {
    it("returns all 18 types as keys in offensive and defensive", () => {
      const result = analyzeTypeCoverage([]);

      const expectedTypes = [
        "Normal", "Fire", "Water", "Electric", "Grass", "Ice",
        "Fighting", "Poison", "Ground", "Flying", "Psychic", "Bug",
        "Rock", "Ghost", "Dragon", "Dark", "Steel", "Fairy",
      ];

      for (const t of expectedTypes) {
        expect(result.offensive).toHaveProperty(t);
        expect(result.defensive).toHaveProperty(t);
      }
    });

    it("uncoveredTypes only contains PokemonType values", () => {
      const result = analyzeTypeCoverage([makeSlot("pikachu", ["Electric"])]);
      const validTypes = new Set([
        "Normal", "Fire", "Water", "Electric", "Grass", "Ice",
        "Fighting", "Poison", "Ground", "Flying", "Psychic", "Bug",
        "Rock", "Ghost", "Dragon", "Dark", "Steel", "Fairy",
      ]);

      for (const t of result.uncoveredTypes) {
        expect(validTypes.has(t)).toBe(true);
      }
    });
  });
});
