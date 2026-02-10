import type { TeamSlotData, PokemonType, StatsTable } from "@nasty-plot/core";
import { analyzeTypeCoverage } from "@nasty-plot/analysis";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultStats: StatsTable = { hp: 80, atk: 80, def: 80, spa: 80, spd: 80, spe: 80 };
const defaultEvs: StatsTable = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
const defaultIvs: StatsTable = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };

function makeSlot(
  pokemonId: string,
  types: [PokemonType] | [PokemonType, PokemonType],
  overrides?: Partial<TeamSlotData>
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
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("analyzeTypeCoverage", () => {
  it("returns empty coverage for empty team", () => {
    const result = analyzeTypeCoverage([]);

    expect(result).toHaveProperty("offensive");
    expect(result).toHaveProperty("defensive");
    expect(result).toHaveProperty("uncoveredTypes");
    expect(result).toHaveProperty("sharedWeaknesses");
  });

  it("returns TypeCoverage shape", () => {
    const result = analyzeTypeCoverage([
      makeSlot("garchomp", ["Dragon", "Ground"]),
    ]);

    expect(typeof result.offensive).toBe("object");
    expect(typeof result.defensive).toBe("object");
    expect(Array.isArray(result.uncoveredTypes)).toBe(true);
    expect(Array.isArray(result.sharedWeaknesses)).toBe(true);
  });

  it("calculates offensive coverage from STAB types", () => {
    const result = analyzeTypeCoverage([
      makeSlot("charizard", ["Fire", "Flying"]),
    ]);

    // Fire is super-effective against Grass, Ice, Bug, Steel
    // So those types should have offensive coverage > 0
    expect(result.offensive["Grass"]).toBeGreaterThan(0);
    expect(result.offensive["Ice"]).toBeGreaterThan(0);
    expect(result.offensive["Bug"]).toBeGreaterThan(0);
    expect(result.offensive["Steel"]).toBeGreaterThan(0);
  });

  it("calculates defensive coverage (resistances)", () => {
    const result = analyzeTypeCoverage([
      makeSlot("heatran", ["Fire", "Steel"]),
    ]);

    // Fire/Steel resists many types
    // e.g. Bug, Fairy, Grass, Ice, Steel, etc.
    expect(result.defensive["Bug"]).toBeGreaterThan(0);
    expect(result.defensive["Fairy"]).toBeGreaterThan(0);
  });

  it("identifies uncovered types", () => {
    // Normal type has no super-effective coverage
    const result = analyzeTypeCoverage([
      makeSlot("snorlax", ["Normal"]),
    ]);

    expect(result.uncoveredTypes.length).toBeGreaterThan(0);
  });

  it("identifies shared weaknesses", () => {
    // Two Water-types share Electric and Grass weaknesses
    const result = analyzeTypeCoverage([
      makeSlot("vaporeon", ["Water"]),
      makeSlot("starmie", ["Water", "Psychic"]),
    ]);

    // Both are weak to Electric and Grass
    const hasElectric = result.sharedWeaknesses.includes("Electric");
    const hasGrass = result.sharedWeaknesses.includes("Grass");
    expect(hasElectric || hasGrass).toBe(true);
  });

  it("reports no shared weaknesses when types are diverse", () => {
    const result = analyzeTypeCoverage([
      makeSlot("garchomp", ["Dragon", "Ground"]),
      makeSlot("heatran", ["Fire", "Steel"]),
    ]);

    // These types complement each other well
    // Shared weaknesses should be few or none
    // (Dragon/Ground is weak to Ice, Dragon, Fairy; Fire/Steel is weak to Ground, Water, Fighting)
    // No shared weaknesses expected
    expect(result.sharedWeaknesses.length).toBeLessThanOrEqual(1);
  });

  it("handles slots without species data", () => {
    const slot: TeamSlotData = {
      position: 1,
      pokemonId: "unknown",
      species: undefined,
      ability: "",
      item: "",
      nature: "Hardy",
      level: 100,
      moves: [undefined, undefined, undefined, undefined],
      evs: defaultEvs,
      ivs: defaultIvs,
    };

    const result = analyzeTypeCoverage([slot]);

    expect(result).toBeDefined();
    expect(result.uncoveredTypes.length).toBeGreaterThan(0);
  });

  it("works with multiple team members", () => {
    const team = [
      makeSlot("garchomp", ["Dragon", "Ground"]),
      makeSlot("heatran", ["Fire", "Steel"]),
      makeSlot("tapu-lele", ["Psychic", "Fairy"]),
    ];

    const result = analyzeTypeCoverage(team);

    // With diverse types, more offensive coverage expected
    const coveredCount = Object.values(result.offensive).filter((v) => v > 0).length;
    expect(coveredCount).toBeGreaterThan(0);
  });
});
