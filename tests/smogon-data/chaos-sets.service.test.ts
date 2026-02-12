import { generateSetsFromChaos } from "#smogon-data/chaos-sets.service"
import type { SmogonChaosData } from "#smogon-data/usage-stats.service"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeChaosData(
  pokemonEntries: Record<
    string,
    {
      usage?: number
      "Raw count"?: number
      Abilities?: Record<string, number>
      Items?: Record<string, number>
      Moves?: Record<string, number>
      Teammates?: Record<string, number>
      "Checks and Counters"?: Record<string, [number, number, ...number[]]>
      Spreads?: Record<string, number>
      "Tera Types"?: Record<string, number>
    }
  >,
): SmogonChaosData {
  const data: SmogonChaosData["data"] = {}
  for (const [name, entry] of Object.entries(pokemonEntries)) {
    data[name] = {
      usage: entry.usage ?? 0.5,
      "Raw count": entry["Raw count"] ?? 1000,
      Abilities: entry.Abilities ?? {},
      Items: entry.Items ?? {},
      Moves: entry.Moves ?? {},
      Teammates: entry.Teammates ?? {},
      "Checks and Counters": entry["Checks and Counters"] ?? {},
      Spreads: entry.Spreads,
      "Tera Types": entry["Tera Types"],
    }
  }
  return { info: { metagame: "gen9ou", cutoff: 1695 }, data }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("generateSetsFromChaos", () => {
  it("generates a set from basic chaos data", () => {
    const chaos = makeChaosData({
      "Great Tusk": {
        usage: 0.5,
        Abilities: { Protosynthesis: 0.95 },
        Items: { "Booster Energy": 0.7 },
        Moves: {
          "Headlong Rush": 0.9,
          "Close Combat": 0.7,
          "Ice Spinner": 0.5,
          "Rapid Spin": 0.4,
          "Stealth Rock": 0.2,
        },
        Spreads: { "Jolly:0/252/0/0/4/252": 0.6 },
        "Tera Types": { Steel: 0.4 },
      },
    })

    const sets = generateSetsFromChaos(chaos)

    expect(sets).toHaveLength(1)
    expect(sets[0].pokemonId).toBe("greattusk")
    expect(sets[0].setName).toBe("Standard Usage")
    expect(sets[0].ability).toBe("Protosynthesis")
    expect(sets[0].item).toBe("Booster Energy")
    expect(sets[0].nature).toBe("Jolly")
    expect(sets[0].evs).toEqual({ atk: 252, spd: 4, spe: 252 })
    expect(sets[0].moves).toHaveLength(4)
    expect(sets[0].teraType).toBe("Steel")
  })

  it("picks top 4 moves by usage", () => {
    const chaos = makeChaosData({
      Garchomp: {
        usage: 0.3,
        Moves: {
          Earthquake: 0.9,
          "Swords Dance": 0.7,
          "Scale Shot": 0.6,
          "Stealth Rock": 0.5,
          "Fire Fang": 0.2,
        },
      },
    })

    const sets = generateSetsFromChaos(chaos)

    expect(sets[0].moves).toHaveLength(4)
    expect(sets[0].moves).toContain("Earthquake")
    expect(sets[0].moves).toContain("Swords Dance")
    expect(sets[0].moves).toContain("Scale Shot")
    expect(sets[0].moves).toContain("Stealth Rock")
    // Fire Fang (5th) should not be included
    expect(sets[0].moves).not.toContain("Fire Fang")
  })

  it("picks the top ability by usage", () => {
    const chaos = makeChaosData({
      Garchomp: {
        usage: 0.3,
        Abilities: { "Rough Skin": 0.8, "Sand Veil": 0.2 },
      },
    })

    const sets = generateSetsFromChaos(chaos)

    expect(sets[0].ability).toBe("Rough Skin")
  })

  it("picks the top item by usage", () => {
    const chaos = makeChaosData({
      Garchomp: {
        usage: 0.3,
        Items: { Leftovers: 0.5, "Rocky Helmet": 0.3 },
      },
    })

    const sets = generateSetsFromChaos(chaos)

    expect(sets[0].item).toBe("Leftovers")
  })

  it("picks the top spread (nature + EVs)", () => {
    const chaos = makeChaosData({
      Garchomp: {
        usage: 0.3,
        Spreads: {
          "Jolly:0/252/0/0/4/252": 0.6,
          "Adamant:0/252/4/0/0/252": 0.3,
        },
      },
    })

    const sets = generateSetsFromChaos(chaos)

    expect(sets[0].nature).toBe("Jolly")
    expect(sets[0].evs).toEqual({ atk: 252, spd: 4, spe: 252 })
  })

  it("skips Pokemon below the minimum usage threshold", () => {
    const chaos = makeChaosData({
      Garchomp: { usage: 0.5 },
      // Usage below MIN_USAGE_PERCENT/100 = 0.0001
      Unown: { usage: 0.00005 },
    })

    const sets = generateSetsFromChaos(chaos)

    expect(sets).toHaveLength(1)
    expect(sets[0].pokemonId).toBe("garchomp")
  })

  it("skips Pokemon with zero usage", () => {
    const chaos = makeChaosData({
      Garchomp: { usage: 0.5 },
      Unown: { usage: 0 },
    })

    const sets = generateSetsFromChaos(chaos)

    expect(sets).toHaveLength(1)
    expect(sets[0].pokemonId).toBe("garchomp")
  })

  it("generates sets for multiple Pokemon", () => {
    const chaos = makeChaosData({
      Garchomp: { usage: 0.5 },
      Heatran: { usage: 0.3 },
      Clefable: { usage: 0.2 },
    })

    const sets = generateSetsFromChaos(chaos)

    expect(sets).toHaveLength(3)
    const ids = sets.map((s) => s.pokemonId)
    expect(ids).toContain("garchomp")
    expect(ids).toContain("heatran")
    expect(ids).toContain("clefable")
  })

  it("normalizes tera type casing", () => {
    const chaos = makeChaosData({
      Garchomp: {
        usage: 0.3,
        "Tera Types": { fire: 0.5 },
      },
    })

    const sets = generateSetsFromChaos(chaos)

    expect(sets[0].teraType).toBe("Fire")
  })

  it("handles uppercase tera type", () => {
    const chaos = makeChaosData({
      Garchomp: {
        usage: 0.3,
        "Tera Types": { WATER: 0.5 },
      },
    })

    const sets = generateSetsFromChaos(chaos)

    expect(sets[0].teraType).toBe("Water")
  })

  it("returns undefined teraType when no tera types data exists", () => {
    const chaos = makeChaosData({
      Garchomp: { usage: 0.3 },
    })

    const sets = generateSetsFromChaos(chaos)

    expect(sets[0].teraType).toBeUndefined()
  })

  it("defaults nature to Serious and evs to empty when no Spreads data", () => {
    const chaos = makeChaosData({
      Garchomp: { usage: 0.3 },
    })

    const sets = generateSetsFromChaos(chaos)

    expect(sets[0].nature).toBe("Serious")
    expect(sets[0].evs).toEqual({})
  })

  it("defaults ability to 'No Ability' when no abilities data", () => {
    const chaos = makeChaosData({
      Garchomp: { usage: 0.3, Abilities: {} },
    })

    const sets = generateSetsFromChaos(chaos)

    expect(sets[0].ability).toBe("No Ability")
  })

  it("defaults item to empty string when no items data", () => {
    const chaos = makeChaosData({
      Garchomp: { usage: 0.3, Items: {} },
    })

    const sets = generateSetsFromChaos(chaos)

    expect(sets[0].item).toBe("")
  })

  it("returns empty moves array when no moves data", () => {
    const chaos = makeChaosData({
      Garchomp: { usage: 0.3, Moves: {} },
    })

    const sets = generateSetsFromChaos(chaos)

    expect(sets[0].moves).toEqual([])
  })

  it("returns ivs as undefined (chaos data does not track IVs)", () => {
    const chaos = makeChaosData({
      Garchomp: { usage: 0.3 },
    })

    const sets = generateSetsFromChaos(chaos)

    expect(sets[0].ivs).toBeUndefined()
  })

  it("handles spread with all zeros (only nature)", () => {
    const chaos = makeChaosData({
      Garchomp: {
        usage: 0.3,
        Spreads: { "Timid:0/0/0/0/0/0": 0.5 },
      },
    })

    const sets = generateSetsFromChaos(chaos)

    expect(sets[0].nature).toBe("Timid")
    expect(sets[0].evs).toEqual({})
  })

  it("handles spread with partial EVs", () => {
    const chaos = makeChaosData({
      Garchomp: {
        usage: 0.3,
        Spreads: { "Bold:252/0/252/0/0/4": 0.5 },
      },
    })

    const sets = generateSetsFromChaos(chaos)

    expect(sets[0].nature).toBe("Bold")
    expect(sets[0].evs).toEqual({ hp: 252, def: 252, spe: 4 })
  })

  it("returns empty array for empty chaos data", () => {
    const chaos: SmogonChaosData = {
      info: { metagame: "gen9ou", cutoff: 1695 },
      data: {},
    }

    const sets = generateSetsFromChaos(chaos)

    expect(sets).toEqual([])
  })
})
