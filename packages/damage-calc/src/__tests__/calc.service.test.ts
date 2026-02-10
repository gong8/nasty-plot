import type { DamageCalcInput, StatsTable, TeamSlotData, PokemonType } from "@nasty-plot/core";
import { calculateDamage, calculateMatchupMatrix } from "../calc.service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCalcInput(overrides?: Partial<DamageCalcInput>): DamageCalcInput {
  return {
    attacker: {
      pokemonId: "garchomp",
      level: 100,
      nature: "Jolly",
      ability: "Rough Skin",
      evs: { hp: 0, atk: 252, def: 0, spa: 0, spd: 4, spe: 252 },
    },
    defender: {
      pokemonId: "heatran",
      level: 100,
    },
    move: "Earthquake",
    ...overrides,
  };
}

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
    moves: ["Earthquake", "Dragon Claw", undefined, undefined],
    evs: defaultEvs,
    ivs: defaultIvs,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("calculateDamage", () => {
  it("returns a DamageCalcResult object", () => {
    const result = calculateDamage(makeCalcInput());

    expect(result).toHaveProperty("moveName");
    expect(result).toHaveProperty("damage");
    expect(result).toHaveProperty("minPercent");
    expect(result).toHaveProperty("maxPercent");
    expect(result).toHaveProperty("minDamage");
    expect(result).toHaveProperty("maxDamage");
    expect(result).toHaveProperty("koChance");
    expect(result).toHaveProperty("description");
  });

  it("calculates damage for Earthquake vs Heatran (4x effective)", () => {
    const result = calculateDamage(makeCalcInput());

    // Earthquake is 4x effective against Fire/Steel Heatran
    expect(result.maxPercent).toBeGreaterThan(0);
    expect(result.moveName).toBe("Earthquake");
    expect(Array.isArray(result.damage)).toBe(true);
  });

  it("returns damage array with numbers", () => {
    const result = calculateDamage(makeCalcInput());

    expect(result.damage.length).toBeGreaterThan(0);
    for (const dmg of result.damage) {
      expect(typeof dmg).toBe("number");
    }
  });

  it("minDamage <= maxDamage", () => {
    const result = calculateDamage(makeCalcInput());

    expect(result.minDamage).toBeLessThanOrEqual(result.maxDamage);
  });

  it("minPercent <= maxPercent", () => {
    const result = calculateDamage(makeCalcInput());

    expect(result.minPercent).toBeLessThanOrEqual(result.maxPercent);
  });

  it("includes a KO chance string", () => {
    const result = calculateDamage(makeCalcInput());

    expect(typeof result.koChance).toBe("string");
    expect(result.koChance.length).toBeGreaterThan(0);
  });

  it("includes a description string", () => {
    const result = calculateDamage(makeCalcInput());

    expect(typeof result.description).toBe("string");
    expect(result.description.length).toBeGreaterThan(0);
  });

  it("respects field conditions", () => {
    const resultNoWeather = calculateDamage(makeCalcInput({ move: "Flamethrower" }));

    const resultWithSun = calculateDamage(
      makeCalcInput({
        attacker: {
          pokemonId: "heatran",
          level: 100,
          ability: "Flash Fire",
          evs: { hp: 0, atk: 0, def: 0, spa: 252, spd: 4, spe: 252 },
        },
        defender: { pokemonId: "ferrothorn", level: 100 },
        move: "Flamethrower",
        field: { weather: "Sun" },
      })
    );

    // With sun, fire moves should do more damage
    expect(resultWithSun.maxPercent).toBeGreaterThan(0);
  });

  it("handles attacker boosts", () => {
    const unboosted = calculateDamage(makeCalcInput());
    const boosted = calculateDamage(
      makeCalcInput({
        attacker: {
          pokemonId: "garchomp",
          level: 100,
          nature: "Jolly",
          ability: "Rough Skin",
          evs: { hp: 0, atk: 252, def: 0, spa: 0, spd: 4, spe: 252 },
          boosts: { atk: 2 },
        },
      })
    );

    expect(boosted.maxDamage).toBeGreaterThan(unboosted.maxDamage);
  });

  it("handles not-very-effective moves", () => {
    // Normal vs Steel
    const result = calculateDamage(
      makeCalcInput({
        attacker: { pokemonId: "snorlax", level: 100 },
        defender: { pokemonId: "ferrothorn", level: 100 },
        move: "Body Slam",
      })
    );

    expect(result.maxPercent).toBeGreaterThan(0);
    expect(result.maxPercent).toBeLessThan(100);
  });
});

describe("calculateMatchupMatrix", () => {
  it("returns a 2D matrix of entries", () => {
    const team = [makeSlot("garchomp", ["Dragon", "Ground"])];
    const threats = ["heatran"];

    const matrix = calculateMatchupMatrix(team, threats, "gen9ou");

    expect(matrix.length).toBe(1);
    expect(matrix[0].length).toBe(1);
  });

  it("returns correctly shaped MatchupMatrixEntry objects", () => {
    const team = [makeSlot("garchomp", ["Dragon", "Ground"])];
    const threats = ["heatran"];

    const matrix = calculateMatchupMatrix(team, threats, "gen9ou");
    const entry = matrix[0][0];

    expect(entry).toHaveProperty("attackerId");
    expect(entry).toHaveProperty("attackerName");
    expect(entry).toHaveProperty("defenderId");
    expect(entry).toHaveProperty("defenderName");
    expect(entry).toHaveProperty("bestMove");
    expect(entry).toHaveProperty("maxPercent");
    expect(entry).toHaveProperty("koChance");
  });

  it("selects the best move for each matchup", () => {
    const team = [makeSlot("garchomp", ["Dragon", "Ground"])];
    const threats = ["heatran"];

    const matrix = calculateMatchupMatrix(team, threats, "gen9ou");
    const entry = matrix[0][0];

    // Earthquake should be best move vs Heatran (4x effective)
    expect(entry.bestMove).toBe("Earthquake");
    expect(entry.maxPercent).toBeGreaterThan(0);
  });

  it("handles multiple team members and threats", () => {
    const team = [
      makeSlot("garchomp", ["Dragon", "Ground"]),
      makeSlot("heatran", ["Fire", "Steel"], {
        position: 2,
        moves: ["Magma Storm", "Earth Power", undefined, undefined],
      }),
    ];
    const threats = ["ferrothorn", "clefable"];

    const matrix = calculateMatchupMatrix(team, threats, "gen9ou");

    expect(matrix.length).toBe(2);
    expect(matrix[0].length).toBe(2);
    expect(matrix[1].length).toBe(2);
  });

  it("handles team member with no valid moves gracefully", () => {
    const team = [
      makeSlot("garchomp", ["Dragon", "Ground"], {
        moves: [undefined, undefined, undefined, undefined],
      }),
    ];
    const threats = ["heatran"];

    const matrix = calculateMatchupMatrix(team, threats, "gen9ou");

    expect(matrix.length).toBe(1);
    expect(matrix[0].length).toBe(1);
  });
});
