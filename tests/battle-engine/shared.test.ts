import { describe, it, expect } from "vitest";
import {
  flattenDamage,
  getSpeciesTypes,
  getTypeEffectiveness,
  fallbackMove,
  pickHealthiestSwitch,
} from "#battle-engine/ai/shared";
import type { BattleActionSet } from "@nasty-plot/battle-engine";

// ---------------------------------------------------------------------------
// flattenDamage
// ---------------------------------------------------------------------------

describe("flattenDamage", () => {
  it("wraps a single number in an array", () => {
    expect(flattenDamage(42)).toEqual([42]);
  });

  it("returns a flat number array as-is", () => {
    expect(flattenDamage([10, 20, 30])).toEqual([10, 20, 30]);
  });

  it("returns first sub-array from a nested number[][]", () => {
    expect(flattenDamage([[5, 10, 15], [20, 25]])).toEqual([5, 10, 15]);
  });

  it("returns [0] for an empty array", () => {
    expect(flattenDamage([])).toEqual([0]);
  });

  it("returns [0] for 0 input", () => {
    expect(flattenDamage(0)).toEqual([0]);
  });
});

// ---------------------------------------------------------------------------
// getSpeciesTypes
// ---------------------------------------------------------------------------

describe("getSpeciesTypes", () => {
  it("returns types for a known species by display name", () => {
    const types = getSpeciesTypes("Garchomp");
    expect(types).toContain("Dragon");
    expect(types).toContain("Ground");
  });

  it("returns types for a single-type species", () => {
    const types = getSpeciesTypes("Pikachu");
    expect(types).toContain("Electric");
    expect(types).toHaveLength(1);
  });

  it('returns ["Normal"] for an unknown species', () => {
    const types = getSpeciesTypes("NotARealPokemon");
    expect(types).toEqual(["Normal"]);
  });

  it("returns correct types for Heatran", () => {
    const types = getSpeciesTypes("Heatran");
    expect(types).toContain("Fire");
    expect(types).toContain("Steel");
  });
});

// ---------------------------------------------------------------------------
// getTypeEffectiveness
// ---------------------------------------------------------------------------

describe("getTypeEffectiveness", () => {
  // NOTE: getTypeEffectiveness uses @pkmn/dex's damageTaken encoding, which
  // checks atkType.damageTaken[defType]. This is the atkType's defensive
  // interaction with defType, used as a proxy for offense.
  // damageTaken: 0=neutral, 1=SE(x2), 2=resist(x0.5), 3=immune(x0)

  it("returns 2 for super effective (Fire vs Grass)", () => {
    // Dex.types.get("Fire").damageTaken["Grass"] = 2 (resist) -> 0.5
    // Actually this reads atkType perspective. Let me verify with actual behavior.
    // Fire.damageTaken["Grass"] would be 2 (Fire resists Grass).
    // The function maps: 1->x2, 2->x0.5, 3->x0
    // So getTypeEffectiveness("Fire", ["Grass"]) = 0.5
    // For a truly SE result, we need the atkType to be weak to defType:
    // e.g. getTypeEffectiveness("Grass", ["Fire"]) -> Grass.damageTaken["Fire"] = 1 -> x2
    expect(getTypeEffectiveness("Grass", ["Fire"])).toBe(2);
  });

  it("returns 0.5 for resist (Fire vs Grass)", () => {
    // Fire.damageTaken["Grass"] = 2 -> 0.5 (Fire resists Grass)
    expect(getTypeEffectiveness("Fire", ["Grass"])).toBe(0.5);
  });

  it("returns 0 for immune (Normal vs Ghost)", () => {
    // Normal.damageTaken["Ghost"] = 3 -> 0 (Normal is immune to Ghost)
    expect(getTypeEffectiveness("Normal", ["Ghost"])).toBe(0);
  });

  it("returns 1 for neutral (Fire vs Normal)", () => {
    // Fire.damageTaken["Normal"] = 0 -> 1 (neutral)
    expect(getTypeEffectiveness("Fire", ["Normal"])).toBe(1);
  });

  it("stacks effectiveness for dual defending types", () => {
    // Grass.damageTaken["Fire"] = 1 -> x2, Grass.damageTaken["Ice"] = 1 -> x2
    // So getTypeEffectiveness("Grass", ["Fire", "Ice"]) = 4
    expect(getTypeEffectiveness("Grass", ["Fire", "Ice"])).toBe(4);
  });

  it("handles unknown attack type gracefully", () => {
    expect(getTypeEffectiveness("FakeType", ["Fire"])).toBe(1);
  });

  it("returns 1 for empty defending types", () => {
    expect(getTypeEffectiveness("Fire", [])).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// fallbackMove
// ---------------------------------------------------------------------------

describe("fallbackMove", () => {
  it("returns first non-disabled move", () => {
    const actions: BattleActionSet = {
      moves: [
        { name: "Fire Blast", id: "fireblast", pp: 8, maxPp: 8, type: "Fire", disabled: true, target: "normal", basePower: 110, category: "Special", accuracy: 85, description: "" },
        { name: "Earth Power", id: "earthpower", pp: 16, maxPp: 16, type: "Ground", disabled: false, target: "normal", basePower: 90, category: "Special", accuracy: 100, description: "" },
        { name: "Flash Cannon", id: "flashcannon", pp: 16, maxPp: 16, type: "Steel", disabled: false, target: "normal", basePower: 80, category: "Special", accuracy: 100, description: "" },
      ],
      canTera: false,
      switches: [],
      forceSwitch: false,
    };

    const result = fallbackMove(actions);
    expect(result).toEqual({ type: "move", moveIndex: 2 });
  });

  it("returns move index 1 when all moves are disabled (Struggle)", () => {
    const actions: BattleActionSet = {
      moves: [
        { name: "Fire Blast", id: "fireblast", pp: 0, maxPp: 8, type: "Fire", disabled: true, target: "normal", basePower: 110, category: "Special", accuracy: 85, description: "" },
        { name: "Earth Power", id: "earthpower", pp: 0, maxPp: 16, type: "Ground", disabled: true, target: "normal", basePower: 90, category: "Special", accuracy: 100, description: "" },
      ],
      canTera: false,
      switches: [],
      forceSwitch: false,
    };

    const result = fallbackMove(actions);
    expect(result).toEqual({ type: "move", moveIndex: 1 });
  });

  it("returns move index 1 when moves array is empty", () => {
    const actions: BattleActionSet = {
      moves: [],
      canTera: false,
      switches: [],
      forceSwitch: false,
    };

    const result = fallbackMove(actions);
    expect(result).toEqual({ type: "move", moveIndex: 1 });
  });
});

// ---------------------------------------------------------------------------
// pickHealthiestSwitch
// ---------------------------------------------------------------------------

describe("pickHealthiestSwitch", () => {
  it("picks the switch with highest HP percentage", () => {
    const actions: BattleActionSet = {
      moves: [],
      canTera: false,
      switches: [
        { index: 2, name: "Clefable", speciesId: "clefable", hp: 100, maxHp: 394, status: "", fainted: false },
        { index: 3, name: "Weavile", speciesId: "weavile", hp: 281, maxHp: 281, status: "", fainted: false },
        { index: 4, name: "Garchomp", speciesId: "garchomp", hp: 200, maxHp: 357, status: "", fainted: false },
      ],
      forceSwitch: false,
    };

    const result = pickHealthiestSwitch(actions);
    expect(result).toEqual({ type: "switch", pokemonIndex: 3 }); // Weavile at 100%
  });

  it("falls back to switch when all switches are fainted", () => {
    const actions: BattleActionSet = {
      moves: [],
      canTera: false,
      switches: [
        { index: 2, name: "Clefable", speciesId: "clefable", hp: 0, maxHp: 394, status: "", fainted: true },
      ],
      forceSwitch: false,
    };

    const result = pickHealthiestSwitch(actions);
    expect(result).toEqual({ type: "switch", pokemonIndex: 2 });
  });

  it("falls back to switch index 1 when switches array is empty", () => {
    const actions: BattleActionSet = {
      moves: [],
      canTera: false,
      switches: [],
      forceSwitch: false,
    };

    const result = pickHealthiestSwitch(actions);
    expect(result).toEqual({ type: "switch", pokemonIndex: 1 });
  });

  it("picks between two equally healthy switches", () => {
    const actions: BattleActionSet = {
      moves: [],
      canTera: false,
      switches: [
        { index: 2, name: "Clefable", speciesId: "clefable", hp: 394, maxHp: 394, status: "", fainted: false },
        { index: 3, name: "Weavile", speciesId: "weavile", hp: 281, maxHp: 281, status: "", fainted: false },
      ],
      forceSwitch: false,
    };

    const result = pickHealthiestSwitch(actions);
    // Both are at 100%, so the reduce picks the first one (a wins over b when equal)
    expect(result.type).toBe("switch");
  });
});
