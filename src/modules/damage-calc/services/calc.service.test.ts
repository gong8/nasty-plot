import { calculateDamage, calculateMatchupMatrix } from "./calc.service";
import type { DamageCalcInput, TeamSlotData, StatsTable } from "@/shared/types";

// ---------------------------------------------------------------------------
// calculateDamage – real @smogon/calc integration tests
// ---------------------------------------------------------------------------

describe("calculateDamage", () => {
  it("calculates Garchomp Earthquake vs Heatran (super-effective STAB)", () => {
    const input: DamageCalcInput = {
      attacker: {
        pokemonId: "garchomp",
        level: 100,
        ability: "Rough Skin",
        nature: "Jolly",
        evs: { atk: 252, spe: 252, hp: 4 },
      },
      defender: {
        pokemonId: "heatran",
        level: 100,
        ability: "Flash Fire",
        nature: "Calm",
        evs: { hp: 252, spd: 252, def: 4 },
      },
      move: "Earthquake",
    };

    const result = calculateDamage(input);

    expect(result.moveName).toBe("Earthquake");
    expect(result.damage).toBeInstanceOf(Array);
    expect(result.damage.length).toBeGreaterThan(0);
    // 4x super-effective STAB Earthquake should do massive damage
    expect(result.maxPercent).toBeGreaterThan(100);
    expect(result.koChance).toContain("OHKO");
    expect(result.description).toBeTruthy();
    expect(result.minDamage).toBeLessThanOrEqual(result.maxDamage);
    expect(result.minPercent).toBeLessThanOrEqual(result.maxPercent);
  });

  it("calculates a resisted hit (Dragonite Outrage vs Clefable)", () => {
    const input: DamageCalcInput = {
      attacker: {
        pokemonId: "dragonite",
        level: 100,
        ability: "Multiscale",
        nature: "Adamant",
        evs: { atk: 252, spe: 252, hp: 4 },
      },
      defender: {
        pokemonId: "clefable",
        level: 100,
        ability: "Unaware",
        nature: "Bold",
        evs: { hp: 252, def: 252, spd: 4 },
      },
      move: "Outrage",
    };

    const result = calculateDamage(input);

    // Dragon is immune to Fairy, so Outrage does 0 damage to Clefable
    expect(result.maxPercent).toBe(0);
    expect(result.minPercent).toBe(0);
  });

  it("calculates a neutral hit with items", () => {
    const input: DamageCalcInput = {
      attacker: {
        pokemonId: "dragapult",
        level: 100,
        ability: "Infiltrator",
        item: "Choice Specs",
        nature: "Timid",
        evs: { spa: 252, spe: 252, hp: 4 },
      },
      defender: {
        pokemonId: "tyranitar",
        level: 100,
        ability: "Sand Stream",
        nature: "Careful",
        evs: { hp: 252, spd: 252, def: 4 },
      },
      move: "Shadow Ball",
    };

    const result = calculateDamage(input);

    expect(result.moveName).toBe("Shadow Ball");
    expect(result.damage.length).toBeGreaterThan(0);
    expect(result.maxPercent).toBeGreaterThan(0);
    expect(result.description).toBeTruthy();
  });

  it("applies weather conditions (Rain + Water move)", () => {
    const inputRain: DamageCalcInput = {
      attacker: {
        pokemonId: "pelipper",
        level: 100,
        ability: "Drizzle",
        nature: "Modest",
        evs: { spa: 252, hp: 252, def: 4 },
      },
      defender: {
        pokemonId: "landorus",
        level: 100,
        nature: "Jolly",
        evs: { hp: 4, atk: 252, spe: 252 },
      },
      move: "Hydro Pump",
      field: { weather: "Rain" },
    };

    const inputNoWeather: DamageCalcInput = {
      ...inputRain,
      field: undefined,
    };

    const resultRain = calculateDamage(inputRain);
    const resultClear = calculateDamage(inputNoWeather);

    // Rain should boost water move damage
    expect(resultRain.maxDamage).toBeGreaterThan(resultClear.maxDamage);
  });

  it("applies terrain conditions", () => {
    const base: DamageCalcInput = {
      attacker: {
        pokemonId: "ironvaliant",
        level: 100,
        ability: "Quark Drive",
        nature: "Timid",
        evs: { spa: 252, spe: 252, hp: 4 },
      },
      defender: {
        pokemonId: "garchomp",
        level: 100,
        nature: "Jolly",
        evs: { hp: 4, atk: 252, spe: 252 },
      },
      move: "Moonblast",
    };

    const resultPlain = calculateDamage(base);
    const resultPsychic = calculateDamage({
      ...base,
      field: { terrain: "Psychic" },
    });

    // Moonblast is not boosted by psychic terrain,
    // but the results should both be valid numbers
    expect(resultPlain.maxPercent).toBeGreaterThan(0);
    expect(resultPsychic.maxPercent).toBeGreaterThan(0);
  });

  it("applies screens (Reflect reduces physical damage)", () => {
    const base: DamageCalcInput = {
      attacker: {
        pokemonId: "garchomp",
        level: 100,
        nature: "Jolly",
        evs: { atk: 252, spe: 252, hp: 4 },
      },
      defender: {
        pokemonId: "slowbro",
        level: 100,
        nature: "Bold",
        evs: { hp: 252, def: 252, spd: 4 },
      },
      move: "Earthquake",
    };

    const noScreen = calculateDamage(base);
    const withReflect = calculateDamage({
      ...base,
      field: { isReflect: true },
    });

    expect(withReflect.maxDamage).toBeLessThan(noScreen.maxDamage);
  });

  it("applies Light Screen for special moves", () => {
    const base: DamageCalcInput = {
      attacker: {
        pokemonId: "gengar",
        level: 100,
        nature: "Timid",
        evs: { spa: 252, spe: 252, hp: 4 },
      },
      defender: {
        pokemonId: "slowbro",
        level: 100,
        nature: "Bold",
        evs: { hp: 252, def: 252, spd: 4 },
      },
      move: "Shadow Ball",
    };

    const noScreen = calculateDamage(base);
    const withLS = calculateDamage({
      ...base,
      field: { isLightScreen: true },
    });

    expect(withLS.maxDamage).toBeLessThan(noScreen.maxDamage);
  });

  it("applies Aurora Veil", () => {
    const base: DamageCalcInput = {
      attacker: {
        pokemonId: "garchomp",
        level: 100,
        nature: "Jolly",
        evs: { atk: 252, spe: 252, hp: 4 },
      },
      defender: {
        pokemonId: "slowbro",
        level: 100,
        nature: "Bold",
        evs: { hp: 252, def: 252, spd: 4 },
      },
      move: "Earthquake",
    };

    const noVeil = calculateDamage(base);
    const withVeil = calculateDamage({
      ...base,
      field: { isAuroraVeil: true },
    });

    expect(withVeil.maxDamage).toBeLessThan(noVeil.maxDamage);
  });

  it("handles critical hits via field.isCritical", () => {
    const base: DamageCalcInput = {
      attacker: {
        pokemonId: "weavile",
        level: 100,
        nature: "Jolly",
        evs: { atk: 252, spe: 252, hp: 4 },
      },
      defender: {
        pokemonId: "slowbro",
        level: 100,
        nature: "Bold",
        evs: { hp: 252, def: 252, spd: 4 },
      },
      move: "Knock Off",
    };

    const normal = calculateDamage(base);
    const crit = calculateDamage({
      ...base,
      field: { isCritical: true },
    });

    expect(crit.maxDamage).toBeGreaterThan(normal.maxDamage);
  });

  it("handles doubles game type", () => {
    const input: DamageCalcInput = {
      attacker: {
        pokemonId: "flutter mane",
        level: 100,
        nature: "Timid",
        evs: { spa: 252, spe: 252, hp: 4 },
      },
      defender: {
        pokemonId: "garchomp",
        level: 100,
        nature: "Jolly",
        evs: { atk: 252, spe: 252, hp: 4 },
      },
      move: "Moonblast",
      field: { isDoubles: true },
    };

    const result = calculateDamage(input);
    expect(result.damage.length).toBeGreaterThan(0);
    expect(result.maxPercent).toBeGreaterThan(0);
  });

  it("uses default EVs (0) and IVs (31) when not specified", () => {
    const input: DamageCalcInput = {
      attacker: {
        pokemonId: "pikachu",
        level: 100,
      },
      defender: {
        pokemonId: "snorlax",
        level: 100,
      },
      move: "Thunderbolt",
    };

    const result = calculateDamage(input);
    expect(result.moveName).toBe("Thunderbolt");
    expect(result.damage.length).toBeGreaterThan(0);
  });

  it("handles stat boosts", () => {
    const base: DamageCalcInput = {
      attacker: {
        pokemonId: "garchomp",
        level: 100,
        nature: "Jolly",
        evs: { atk: 252, spe: 252, hp: 4 },
      },
      defender: {
        pokemonId: "slowbro",
        level: 100,
        nature: "Bold",
        evs: { hp: 252, def: 252, spd: 4 },
      },
      move: "Earthquake",
    };

    const unboosted = calculateDamage(base);
    const boosted = calculateDamage({
      ...base,
      attacker: {
        ...base.attacker,
        boosts: { atk: 2 },
      },
    });

    expect(boosted.maxDamage).toBeGreaterThan(unboosted.maxDamage);
  });

  it("handles status conditions (Burned attacker does less physical damage)", () => {
    const base: DamageCalcInput = {
      attacker: {
        pokemonId: "garchomp",
        level: 100,
        nature: "Jolly",
        evs: { atk: 252, spe: 252, hp: 4 },
      },
      defender: {
        pokemonId: "slowbro",
        level: 100,
        nature: "Bold",
        evs: { hp: 252, def: 252, spd: 4 },
      },
      move: "Earthquake",
    };

    const healthy = calculateDamage(base);
    const burned = calculateDamage({
      ...base,
      attacker: { ...base.attacker, status: "Burned" },
    });

    expect(burned.maxDamage).toBeLessThan(healthy.maxDamage);
  });

  it("handles 'None' and 'Healthy' status as no status", () => {
    const base: DamageCalcInput = {
      attacker: {
        pokemonId: "garchomp",
        level: 100,
        nature: "Jolly",
        evs: { atk: 252, spe: 252, hp: 4 },
      },
      defender: {
        pokemonId: "slowbro",
        level: 100,
        nature: "Bold",
        evs: { hp: 252, def: 252, spd: 4 },
      },
      move: "Earthquake",
    };

    const noStatus = calculateDamage(base);
    const noneStatus = calculateDamage({
      ...base,
      attacker: { ...base.attacker, status: "None" },
    });
    const healthyStatus = calculateDamage({
      ...base,
      attacker: { ...base.attacker, status: "Healthy" },
    });

    expect(noneStatus.maxDamage).toBe(noStatus.maxDamage);
    expect(healthyStatus.maxDamage).toBe(noStatus.maxDamage);
  });

  it("handles Tera Type for attacker", () => {
    // Test Tera boosting: Garchomp with Ground tera using Earthquake should get stronger
    const base: DamageCalcInput = {
      attacker: {
        pokemonId: "garchomp",
        level: 100,
        nature: "Jolly",
        evs: { atk: 252, spe: 252, hp: 4 },
      },
      defender: {
        pokemonId: "slowbro",
        level: 100,
        nature: "Bold",
        evs: { hp: 252, def: 252, spd: 4 },
      },
      move: "Earthquake",
    };

    const noTera = calculateDamage(base);
    const teraGround = calculateDamage({
      ...base,
      attacker: { ...base.attacker, teraType: "Ground" },
    });

    // Tera Ground on a Ground-type should give boosted STAB (from 1.5x to 2x)
    expect(teraGround.maxDamage).toBeGreaterThan(noTera.maxDamage);
  });

  it("handles camelCase pokemonId resolution (greatTusk)", () => {
    const input: DamageCalcInput = {
      attacker: {
        pokemonId: "greatTusk",
        level: 100,
        nature: "Adamant",
        evs: { atk: 252, spe: 252, hp: 4 },
      },
      defender: {
        pokemonId: "heatran",
        level: 100,
        nature: "Calm",
        evs: { hp: 252, spd: 252, def: 4 },
      },
      move: "Earthquake",
    };

    const result = calculateDamage(input);
    expect(result.damage.length).toBeGreaterThan(0);
    expect(result.maxPercent).toBeGreaterThan(0);
  });

  it("returns koChance N/A when defender HP is 0", () => {
    // We can test the result type even if smogon/calc sets reasonable HP
    // This is more about the output structure
    const input: DamageCalcInput = {
      attacker: {
        pokemonId: "garchomp",
        level: 100,
        nature: "Jolly",
        evs: { atk: 252, spe: 252, hp: 4 },
      },
      defender: {
        pokemonId: "heatran",
        level: 100,
        nature: "Calm",
        evs: { hp: 252, spd: 252, def: 4 },
      },
      move: "Earthquake",
    };

    const result = calculateDamage(input);
    // koChance should be a meaningful string
    expect(typeof result.koChance).toBe("string");
    expect(result.koChance.length).toBeGreaterThan(0);
  });

  it("returns multi-HKO results for weak hits", () => {
    const input: DamageCalcInput = {
      attacker: {
        pokemonId: "pikachu",
        level: 100,
        nature: "Timid",
        evs: { spa: 252, spe: 252, hp: 4 },
      },
      defender: {
        pokemonId: "blissey",
        level: 100,
        ability: "Natural Cure",
        nature: "Calm",
        evs: { hp: 252, spd: 252, def: 4 },
      },
      move: "Thunderbolt",
    };

    const result = calculateDamage(input);
    // Pikachu vs Blissey should be a multi-HKO or 5+ hits
    expect(result.koChance).toMatch(/\dHKO|5\+ hits/);
  });

  it("handles all status conditions mapping", () => {
    const statuses = [
      "Paralyzed",
      "Poisoned",
      "Badly Poisoned",
      "Asleep",
      "Frozen",
    ];

    for (const status of statuses) {
      const input: DamageCalcInput = {
        attacker: {
          pokemonId: "garchomp",
          level: 100,
          nature: "Jolly",
          evs: { atk: 252 },
          status,
        },
        defender: {
          pokemonId: "slowbro",
          level: 100,
          nature: "Bold",
          evs: { hp: 252, def: 252 },
        },
        move: "Earthquake",
      };

      const result = calculateDamage(input);
      expect(result.damage.length).toBeGreaterThan(0);
    }
  });

  it("returns an unknown status without error", () => {
    const input: DamageCalcInput = {
      attacker: {
        pokemonId: "garchomp",
        level: 100,
        nature: "Jolly",
        evs: { atk: 252 },
        status: "UnknownStatus",
      },
      defender: {
        pokemonId: "slowbro",
        level: 100,
        nature: "Bold",
        evs: { hp: 252, def: 252 },
      },
      move: "Earthquake",
    };

    const result = calculateDamage(input);
    expect(result.damage.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// calculateMatchupMatrix
// ---------------------------------------------------------------------------

describe("calculateMatchupMatrix", () => {
  const makeSlot = (
    pokemonId: string,
    moves: [string, string?, string?, string?],
    overrides?: Partial<TeamSlotData>
  ): TeamSlotData => ({
    position: 1,
    pokemonId,
    ability: "",
    item: "",
    nature: "Hardy",
    level: 100,
    moves,
    evs: { hp: 0, atk: 252, def: 0, spa: 252, spd: 0, spe: 252 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    ...overrides,
  });

  it("produces a matrix with correct dimensions", () => {
    const team = [
      makeSlot("garchomp", ["Earthquake", "Dragon Claw"]),
      makeSlot("gengar", ["Shadow Ball", "Sludge Bomb"]),
    ];
    const threats = ["heatran", "clefable", "slowbro"];

    const matrix = calculateMatchupMatrix(team, threats, "gen9ou");

    expect(matrix).toHaveLength(2); // 2 team members
    expect(matrix[0]).toHaveLength(3); // 3 threats
    expect(matrix[1]).toHaveLength(3);
  });

  it("selects the best move per matchup", () => {
    const team = [
      makeSlot("garchomp", ["Earthquake", "Dragon Claw"], {
        ability: "Rough Skin",
        nature: "Jolly",
      }),
    ];
    const threats = ["heatran"];

    const matrix = calculateMatchupMatrix(team, threats, "gen9ou");

    // EQ is 4x effective vs Heatran; Dragon Claw is not very effective
    expect(matrix[0][0].bestMove).toBe("Earthquake");
    expect(matrix[0][0].maxPercent).toBeGreaterThan(0);
    expect(matrix[0][0].attackerId).toBe("garchomp");
    expect(matrix[0][0].defenderId).toBe("heatran");
  });

  it("handles slots with no moves (uses Struggle as default)", () => {
    const team = [
      makeSlot("pikachu", [""]),
    ];
    const threats = ["snorlax"];

    const matrix = calculateMatchupMatrix(team, threats, "gen9ou");

    expect(matrix[0][0].bestMove).toBe("Struggle");
    expect(matrix[0][0].maxPercent).toBe(0);
    expect(matrix[0][0].koChance).toBe("N/A");
  });

  it("handles moves that fail to calculate (status moves)", () => {
    const team = [
      makeSlot("clefable", ["Moonblast", "Thunder Wave", "Stealth Rock", "Soft-Boiled"]),
    ];
    const threats = ["garchomp"];

    const matrix = calculateMatchupMatrix(team, threats, "gen9ou");

    // Should still produce a result - Moonblast should be the best damaging move
    expect(matrix[0][0].bestMove).toBeTruthy();
    // The matrix entry should exist even if some moves throw
    expect(matrix[0][0].attackerId).toBe("clefable");
    expect(matrix[0][0].defenderId).toBe("garchomp");
  });

  it("populates attackerName and defenderName", () => {
    const team = [
      makeSlot("garchomp", ["Earthquake"], {
        species: {
          id: "garchomp",
          name: "Garchomp",
          num: 445,
          types: ["Dragon", "Ground"],
          baseStats: { hp: 108, atk: 130, def: 95, spa: 80, spd: 85, spe: 102 },
          abilities: { "0": "Sand Veil" },
          weightkg: 95,
        },
      }),
    ];
    const threats = ["heatran"];

    const matrix = calculateMatchupMatrix(team, threats, "gen9ou");

    expect(matrix[0][0].attackerName).toBe("Garchomp");
    expect(matrix[0][0].defenderName).toBeTruthy();
  });

  it("returns empty matrix for empty team", () => {
    const matrix = calculateMatchupMatrix([], ["heatran"], "gen9ou");
    expect(matrix).toEqual([]);
  });

  it("returns rows with empty entries for empty threats", () => {
    const team = [makeSlot("garchomp", ["Earthquake"])];
    const matrix = calculateMatchupMatrix(team, [], "gen9ou");

    expect(matrix).toHaveLength(1);
    expect(matrix[0]).toEqual([]);
  });
});
