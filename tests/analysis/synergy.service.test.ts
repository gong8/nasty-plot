import type { TeamSlotData } from "@nasty-plot/core"
import { DEFAULT_EVS, DEFAULT_IVS, DEFAULT_LEVEL } from "@nasty-plot/core"
import { calculateSynergy } from "@nasty-plot/analysis"
import { makeSlot } from "../test-utils"

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("calculateSynergy", () => {
  it("returns 0 for empty team", () => {
    const result = calculateSynergy([])
    expect(result).toBe(0)
  })

  it("returns 50 for single Pokemon", () => {
    const result = calculateSynergy([makeSlot("garchomp", ["Dragon", "Ground"])])
    expect(result).toBe(50)
  })

  it("returns a score between 0 and 100", () => {
    const team = [
      makeSlot("garchomp", ["Dragon", "Ground"]),
      makeSlot("heatran", ["Fire", "Steel"]),
      makeSlot("tapu-lele", ["Psychic", "Fairy"]),
    ]

    const result = calculateSynergy(team)

    expect(result).toBeGreaterThanOrEqual(0)
    expect(result).toBeLessThanOrEqual(100)
  })

  it("scores higher for complementary types", () => {
    // Dragon/Ground + Fire/Steel is a classic complementary core
    const goodTeam = [
      makeSlot("garchomp", ["Dragon", "Ground"]),
      makeSlot("heatran", ["Fire", "Steel"]),
    ]

    // Two Normal types have poor synergy
    const badTeam = [makeSlot("snorlax", ["Normal"]), makeSlot("blissey", ["Normal"])]

    const goodScore = calculateSynergy(goodTeam)
    const badScore = calculateSynergy(badTeam)

    expect(goodScore).toBeGreaterThan(badScore)
  })

  it("rewards speed diversity", () => {
    // Team with varied speed stats
    const diverseTeam = [
      makeSlot("garchomp", ["Dragon", "Ground"], {
        species: {
          id: "garchomp",
          name: "Garchomp",
          num: 445,
          types: ["Dragon", "Ground"],
          baseStats: { hp: 108, atk: 130, def: 95, spa: 80, spd: 85, spe: 102 },
          abilities: { "0": "Rough Skin" },
          weightkg: 95,
        },
      }),
      makeSlot("ferrothorn", ["Grass", "Steel"], {
        species: {
          id: "ferrothorn",
          name: "Ferrothorn",
          num: 598,
          types: ["Grass", "Steel"],
          baseStats: { hp: 74, atk: 94, def: 131, spa: 54, spd: 116, spe: 20 },
          abilities: { "0": "Iron Barbs" },
          weightkg: 110,
        },
      }),
    ]

    const result = calculateSynergy(diverseTeam)
    expect(result).toBeGreaterThan(0)
  })

  it("rewards physical/special balance", () => {
    // One physical, one special attacker
    const balancedTeam = [
      makeSlot("garchomp", ["Dragon", "Ground"], {
        species: {
          id: "garchomp",
          name: "Garchomp",
          num: 445,
          types: ["Dragon", "Ground"],
          baseStats: { hp: 108, atk: 130, def: 95, spa: 80, spd: 85, spe: 102 },
          abilities: { "0": "Rough Skin" },
          weightkg: 95,
        },
      }),
      makeSlot("heatran", ["Fire", "Steel"], {
        species: {
          id: "heatran",
          name: "Heatran",
          num: 485,
          types: ["Fire", "Steel"],
          baseStats: { hp: 91, atk: 90, def: 106, spa: 130, spd: 106, spe: 77 },
          abilities: { "0": "Flash Fire" },
          weightkg: 430,
        },
      }),
    ]

    const result = calculateSynergy(balancedTeam)
    expect(result).toBeGreaterThan(0)
  })

  it("handles slots without species data", () => {
    const team: TeamSlotData[] = [
      {
        position: 1,
        pokemonId: "unknown",
        species: undefined,
        ability: "",
        item: "",
        nature: "Hardy",
        level: DEFAULT_LEVEL,
        moves: [undefined, undefined, undefined, undefined],
        evs: DEFAULT_EVS,
        ivs: DEFAULT_IVS,
      },
      makeSlot("garchomp", ["Dragon", "Ground"]),
    ]

    const result = calculateSynergy(team)
    expect(typeof result).toBe("number")
    expect(result).toBeGreaterThanOrEqual(0)
  })

  it("returns an integer score", () => {
    const team = [
      makeSlot("garchomp", ["Dragon", "Ground"]),
      makeSlot("heatran", ["Fire", "Steel"]),
    ]

    const result = calculateSynergy(team)
    expect(Number.isInteger(result)).toBe(true)
  })
})
