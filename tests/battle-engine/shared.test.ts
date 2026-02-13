import { describe, it, expect } from "vitest"
import {
  flattenDamage,
  getSpeciesTypes,
  fallbackMove,
  pickHealthiestSwitch,
  getEffectiveSpeed,
} from "#battle-engine/ai/shared"
import type { BattleActionSet, BattlePokemon, SideConditions } from "@nasty-plot/battle-engine"
import { DEFAULT_LEVEL } from "@nasty-plot/core"

// ---------------------------------------------------------------------------
// flattenDamage
// ---------------------------------------------------------------------------

describe("flattenDamage", () => {
  it("wraps a single number in an array", () => {
    expect(flattenDamage(42)).toEqual([42])
  })

  it("returns a flat number array as-is", () => {
    expect(flattenDamage([10, 20, 30])).toEqual([10, 20, 30])
  })

  it("returns first sub-array from a nested number[][]", () => {
    expect(
      flattenDamage([
        [5, 10, 15],
        [20, 25],
      ]),
    ).toEqual([5, 10, 15])
  })

  it("returns [0] for an empty array", () => {
    expect(flattenDamage([])).toEqual([0])
  })

  it("returns [0] for 0 input", () => {
    expect(flattenDamage(0)).toEqual([0])
  })
})

// ---------------------------------------------------------------------------
// getSpeciesTypes
// ---------------------------------------------------------------------------

describe("getSpeciesTypes", () => {
  it("returns types for a known species by display name", () => {
    const types = getSpeciesTypes("Garchomp")
    expect(types).toContain("Dragon")
    expect(types).toContain("Ground")
  })

  it("returns types for a single-type species", () => {
    const types = getSpeciesTypes("Pikachu")
    expect(types).toContain("Electric")
    expect(types).toHaveLength(1)
  })

  it('returns ["Normal"] for an unknown species', () => {
    const types = getSpeciesTypes("NotARealPokemon")
    expect(types).toEqual(["Normal"])
  })

  it("returns correct types for Heatran", () => {
    const types = getSpeciesTypes("Heatran")
    expect(types).toContain("Fire")
    expect(types).toContain("Steel")
  })
})

// ---------------------------------------------------------------------------
// fallbackMove
// ---------------------------------------------------------------------------

describe("fallbackMove", () => {
  it("returns first non-disabled move", () => {
    const actions: BattleActionSet = {
      moves: [
        {
          name: "Fire Blast",
          id: "fireblast",
          pp: 8,
          maxPp: 8,
          type: "Fire",
          disabled: true,
          target: "normal",
          basePower: 110,
          category: "Special",
          accuracy: 85,
          description: "",
        },
        {
          name: "Earth Power",
          id: "earthpower",
          pp: 16,
          maxPp: 16,
          type: "Ground",
          disabled: false,
          target: "normal",
          basePower: 90,
          category: "Special",
          accuracy: 100,
          description: "",
        },
        {
          name: "Flash Cannon",
          id: "flashcannon",
          pp: 16,
          maxPp: 16,
          type: "Steel",
          disabled: false,
          target: "normal",
          basePower: 80,
          category: "Special",
          accuracy: 100,
          description: "",
        },
      ],
      canTera: false,
      switches: [],
      forceSwitch: false,
    }

    const result = fallbackMove(actions)
    expect(result).toEqual({ type: "move", moveIndex: 2 })
  })

  it("returns move index 1 when all moves are disabled (Struggle)", () => {
    const actions: BattleActionSet = {
      moves: [
        {
          name: "Fire Blast",
          id: "fireblast",
          pp: 0,
          maxPp: 8,
          type: "Fire",
          disabled: true,
          target: "normal",
          basePower: 110,
          category: "Special",
          accuracy: 85,
          description: "",
        },
        {
          name: "Earth Power",
          id: "earthpower",
          pp: 0,
          maxPp: 16,
          type: "Ground",
          disabled: true,
          target: "normal",
          basePower: 90,
          category: "Special",
          accuracy: 100,
          description: "",
        },
      ],
      canTera: false,
      switches: [],
      forceSwitch: false,
    }

    const result = fallbackMove(actions)
    expect(result).toEqual({ type: "move", moveIndex: 1 })
  })

  it("returns move index 1 when moves array is empty", () => {
    const actions: BattleActionSet = {
      moves: [],
      canTera: false,
      switches: [],
      forceSwitch: false,
    }

    const result = fallbackMove(actions)
    expect(result).toEqual({ type: "move", moveIndex: 1 })
  })
})

// ---------------------------------------------------------------------------
// pickHealthiestSwitch
// ---------------------------------------------------------------------------

describe("pickHealthiestSwitch", () => {
  it("picks the switch with highest HP percentage", () => {
    const actions: BattleActionSet = {
      moves: [],
      canTera: false,
      switches: [
        {
          index: 2,
          name: "Clefable",
          speciesId: "clefable",
          hp: 100,
          maxHp: 394,
          status: "",
          fainted: false,
        },
        {
          index: 3,
          name: "Weavile",
          speciesId: "weavile",
          hp: 281,
          maxHp: 281,
          status: "",
          fainted: false,
        },
        {
          index: 4,
          name: "Garchomp",
          speciesId: "garchomp",
          hp: 200,
          maxHp: 357,
          status: "",
          fainted: false,
        },
      ],
      forceSwitch: false,
    }

    const result = pickHealthiestSwitch(actions)
    expect(result).toEqual({ type: "switch", pokemonIndex: 3 }) // Weavile at 100%
  })

  it("falls back to switch when all switches are fainted", () => {
    const actions: BattleActionSet = {
      moves: [],
      canTera: false,
      switches: [
        {
          index: 2,
          name: "Clefable",
          speciesId: "clefable",
          hp: 0,
          maxHp: 394,
          status: "",
          fainted: true,
        },
      ],
      forceSwitch: false,
    }

    const result = pickHealthiestSwitch(actions)
    expect(result).toEqual({ type: "switch", pokemonIndex: 2 })
  })

  it("falls back to switch index 1 when switches array is empty", () => {
    const actions: BattleActionSet = {
      moves: [],
      canTera: false,
      switches: [],
      forceSwitch: false,
    }

    const result = pickHealthiestSwitch(actions)
    expect(result).toEqual({ type: "switch", pokemonIndex: 1 })
  })

  it("picks between two equally healthy switches", () => {
    const actions: BattleActionSet = {
      moves: [],
      canTera: false,
      switches: [
        {
          index: 2,
          name: "Clefable",
          speciesId: "clefable",
          hp: 394,
          maxHp: 394,
          status: "",
          fainted: false,
        },
        {
          index: 3,
          name: "Weavile",
          speciesId: "weavile",
          hp: 281,
          maxHp: 281,
          status: "",
          fainted: false,
        },
      ],
      forceSwitch: false,
    }

    const result = pickHealthiestSwitch(actions)
    // Both are at 100%, so the reduce picks the first one (a wins over b when equal)
    expect(result.type).toBe("switch")
  })
})

// ---------------------------------------------------------------------------
// getEffectiveSpeed
// ---------------------------------------------------------------------------

function makeSideConditions(overrides: Partial<SideConditions> = {}): SideConditions {
  return {
    stealthRock: false,
    spikes: 0,
    toxicSpikes: 0,
    stickyWeb: false,
    reflect: 0,
    lightScreen: 0,
    auroraVeil: 0,
    tailwind: 0,
    ...overrides,
  }
}

function makeSpeedPokemon(overrides: Partial<BattlePokemon> = {}): BattlePokemon {
  return {
    speciesId: "garchomp",
    name: "Garchomp",
    nickname: "Garchomp",
    level: DEFAULT_LEVEL,
    types: ["Dragon", "Ground"],
    hp: 357,
    maxHp: 357,
    hpPercent: 100,
    status: "",
    fainted: false,
    item: "",
    ability: "",
    isTerastallized: false,
    moves: [],
    stats: { hp: 357, atk: 394, def: 226, spa: 196, spd: 206, spe: 333 },
    boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 },
    volatiles: [],
    ...overrides,
  }
}

describe("getEffectiveSpeed", () => {
  it("returns base speed with no modifiers", () => {
    const pokemon = makeSpeedPokemon()
    const sc = makeSideConditions()
    expect(getEffectiveSpeed(pokemon, sc)).toBe(333)
  })

  it("applies +2 speed boost correctly", () => {
    const pokemon = makeSpeedPokemon({
      boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 2, accuracy: 0, evasion: 0 },
    })
    const sc = makeSideConditions()
    // floor(333 * (2+2)/2) = floor(333 * 2) = 666
    expect(getEffectiveSpeed(pokemon, sc)).toBe(666)
  })

  it("applies -1 speed boost correctly", () => {
    const pokemon = makeSpeedPokemon({
      boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: -1, accuracy: 0, evasion: 0 },
    })
    const sc = makeSideConditions()
    // floor(333 * 2 / (2+1)) = floor(666/3) = 222
    expect(getEffectiveSpeed(pokemon, sc)).toBe(222)
  })

  it("applies paralysis speed reduction (50%)", () => {
    const pokemon = makeSpeedPokemon({ status: "par" })
    const sc = makeSideConditions()
    // floor(333 * 0.5) = 166
    expect(getEffectiveSpeed(pokemon, sc)).toBe(166)
  })

  it("applies Tailwind speed doubling", () => {
    const pokemon = makeSpeedPokemon()
    const sc = makeSideConditions({ tailwind: 3 })
    // floor(333 * 2) = 666
    expect(getEffectiveSpeed(pokemon, sc)).toBe(666)
  })

  it("applies paralysis + Tailwind combined", () => {
    const pokemon = makeSpeedPokemon({ status: "par" })
    const sc = makeSideConditions({ tailwind: 3 })
    // floor(333 * 0.5) = 166, then floor(166 * 2) = 332
    expect(getEffectiveSpeed(pokemon, sc)).toBe(332)
  })

  it("returns minimum of 1 for very low speed", () => {
    const pokemon = makeSpeedPokemon({
      stats: { hp: 357, atk: 394, def: 226, spa: 196, spd: 206, spe: 1 },
      boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: -6, accuracy: 0, evasion: 0 },
      status: "par",
    })
    const sc = makeSideConditions()
    // floor(1 * 2/8) = 0, then floor(0 * 0.5) = 0, clamped to 1
    expect(getEffectiveSpeed(pokemon, sc)).toBe(1)
  })
})
