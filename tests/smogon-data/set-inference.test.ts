import {
  scoreSetMatch,
  inferFromSets,
  resolveMoves,
  enrichExtractedTeam,
} from "@nasty-plot/smogon-data"
import type { ExtractedPokemon } from "@nasty-plot/smogon-data"
import type { SmogonSetData } from "@nasty-plot/core"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@nasty-plot/db", () => ({
  prisma: {
    smogonSet: {
      findMany: vi.fn(),
    },
  },
}))

import { prisma } from "@nasty-plot/db"

const mockFindMany = prisma.smogonSet.findMany as ReturnType<typeof vi.fn>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSet(overrides?: Partial<SmogonSetData>): SmogonSetData {
  return {
    pokemonId: "garchomp",
    setName: "Swords Dance",
    ability: "Rough Skin",
    item: "Leftovers",
    nature: "Jolly",
    moves: ["Earthquake", "Dragon Claw", "Swords Dance", "Scale Shot"],
    evs: { atk: 252, spe: 252, hp: 4 },
    ...overrides,
  }
}

function makeExtracted(overrides?: Partial<ExtractedPokemon>): ExtractedPokemon {
  return {
    speciesId: "garchomp",
    species: "Garchomp",
    level: 100,
    moves: ["Earthquake"],
    ...overrides,
  }
}

function makeDbRow(overrides?: Record<string, unknown>) {
  return {
    pokemonId: "garchomp",
    setName: "Swords Dance",
    ability: "Rough Skin",
    item: "Leftovers",
    nature: "Jolly",
    teraType: null,
    moves: JSON.stringify(["Earthquake", "Dragon Claw", "Swords Dance", "Scale Shot"]),
    evs: JSON.stringify({ atk: 252, spe: 252, hp: 4 }),
    ivs: null,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// scoreSetMatch
// ---------------------------------------------------------------------------

describe("scoreSetMatch", () => {
  it("scores a perfect match with all fields revealed", () => {
    const extracted = makeExtracted({
      moves: ["Earthquake", "Dragon Claw", "Swords Dance", "Scale Shot"],
      ability: "Rough Skin",
      item: "Leftovers",
    })
    const set = makeSet()
    const result = scoreSetMatch(extracted, set)

    expect(result.score).toBeGreaterThan(0)
    expect(result.matchedMoves).toHaveLength(4)
    // All fields match → score should be 1.0 (perfect)
    expect(result.score).toBeCloseTo(1.0, 1)
  })

  it("scores partial moves correctly", () => {
    const extracted = makeExtracted({
      moves: ["Earthquake", "Dragon Claw"],
    })
    const set = makeSet()
    const result = scoreSetMatch(extracted, set)

    expect(result.score).toBeGreaterThan(0)
    expect(result.matchedMoves).toEqual(["Earthquake", "Dragon Claw"])
  })

  it("returns score 0 when a revealed move is not in the set", () => {
    const extracted = makeExtracted({
      moves: ["Earthquake", "Flamethrower"],
    })
    const set = makeSet()
    const result = scoreSetMatch(extracted, set)

    expect(result.score).toBe(0)
    expect(result.matchedMoves).toEqual([])
  })

  it("matches slash option moves", () => {
    const set = makeSet({
      moves: [["Earthquake", "Stone Edge"], "Dragon Claw", "Swords Dance", "Scale Shot"],
    })
    const extracted = makeExtracted({
      moves: ["Stone Edge"],
    })
    const result = scoreSetMatch(extracted, set)

    expect(result.score).toBeGreaterThan(0)
    expect(result.matchedMoves).toEqual(["Stone Edge"])
  })

  it("penalizes ability mismatch", () => {
    const set = makeSet()

    const matchingAbility = scoreSetMatch(
      makeExtracted({ moves: ["Earthquake"], ability: "Rough Skin" }),
      set,
    )
    const mismatchAbility = scoreSetMatch(
      makeExtracted({ moves: ["Earthquake"], ability: "Sand Veil" }),
      set,
    )

    expect(matchingAbility.score).toBeGreaterThan(mismatchAbility.score)
  })

  it("penalizes item mismatch", () => {
    const set = makeSet()

    const matchingItem = scoreSetMatch(
      makeExtracted({ moves: ["Earthquake"], item: "Leftovers" }),
      set,
    )
    const mismatchItem = scoreSetMatch(
      makeExtracted({ moves: ["Earthquake"], item: "Choice Band" }),
      set,
    )

    expect(matchingItem.score).toBeGreaterThan(mismatchItem.score)
  })

  it("handles no revealed fields (moves only)", () => {
    const extracted = makeExtracted({
      moves: ["Earthquake"],
    })
    const set = makeSet()
    const result = scoreSetMatch(extracted, set)

    // Only move coverage contributes
    expect(result.score).toBeGreaterThan(0)
    expect(result.matchedMoves).toEqual(["Earthquake"])
  })

  it("is case insensitive for moves", () => {
    const extracted = makeExtracted({
      moves: ["earthquake", "DRAGON CLAW"],
    })
    const set = makeSet()
    const result = scoreSetMatch(extracted, set)

    expect(result.score).toBeGreaterThan(0)
    expect(result.matchedMoves).toHaveLength(2)
  })

  it("is case insensitive for abilities and items", () => {
    const extracted = makeExtracted({
      moves: ["Earthquake"],
      ability: "rough skin",
      item: "leftovers",
    })
    const set = makeSet()
    const result = scoreSetMatch(extracted, set)

    // Should still match despite different casing
    const extractedNoFields = makeExtracted({ moves: ["Earthquake"] })
    const resultNoFields = scoreSetMatch(extractedNoFields, set)

    expect(result.score).toBeGreaterThan(resultNoFields.score)
  })
})

// ---------------------------------------------------------------------------
// inferFromSets
// ---------------------------------------------------------------------------

describe("inferFromSets", () => {
  it("returns null result when no sets provided", () => {
    const result = inferFromSets(makeExtracted(), [])

    expect(result.bestMatch).toBeNull()
    expect(result.confidence).toBe(0)
    expect(result.setName).toBeNull()
  })

  it("picks the best matching set from multiple candidates", () => {
    const extracted = makeExtracted({
      moves: ["Earthquake", "Swords Dance"],
      ability: "Rough Skin",
    })

    const sdSet = makeSet({
      setName: "Swords Dance",
      moves: ["Earthquake", "Dragon Claw", "Swords Dance", "Scale Shot"],
      ability: "Rough Skin",
    })
    const scaleSet = makeSet({
      setName: "Special Attacker",
      moves: ["Draco Meteor", "Fire Blast", "Earth Power", "Stealth Rock"],
      ability: "Rough Skin",
    })

    const result = inferFromSets(extracted, [sdSet, scaleSet])

    expect(result.bestMatch).not.toBeNull()
    expect(result.setName).toBe("Swords Dance")
    expect(result.confidence).toBeGreaterThan(0)
  })

  it("returns null result when no sets match", () => {
    const extracted = makeExtracted({
      moves: ["Flamethrower"],
    })
    const set = makeSet()

    const result = inferFromSets(extracted, [set])

    expect(result.bestMatch).toBeNull()
    expect(result.confidence).toBe(0)
  })

  it("preserves revealed data", () => {
    const extracted = makeExtracted({
      moves: ["Earthquake"],
      ability: "Rough Skin",
      item: "Choice Band",
    })
    const set = makeSet({ item: "Leftovers" })

    const result = inferFromSets(extracted, [set])

    // Revealed ability and item should take priority
    expect(result.ability).toBe("Rough Skin")
    expect(result.item).toBe("Choice Band")
  })

  it("infers nature and EVs from the best set", () => {
    const extracted = makeExtracted({
      moves: ["Earthquake"],
    })
    const set = makeSet({
      nature: "Jolly",
      evs: { atk: 252, spe: 252, hp: 4 },
    })

    const result = inferFromSets(extracted, [set])

    expect(result.nature).toBe("Jolly")
    expect(result.evs).toEqual({ atk: 252, spe: 252, hp: 4 })
  })

  it("infers full moveset from the best set", () => {
    const extracted = makeExtracted({
      moves: ["Earthquake"],
    })
    const set = makeSet({
      moves: ["Earthquake", "Dragon Claw", "Swords Dance", "Scale Shot"],
    })

    const result = inferFromSets(extracted, [set])

    expect(result.moves).toEqual(["Earthquake", "Dragon Claw", "Swords Dance", "Scale Shot"])
  })

  it("handles a single candidate set", () => {
    const extracted = makeExtracted({ moves: ["Earthquake"] })
    const set = makeSet()

    const result = inferFromSets(extracted, [set])

    expect(result.bestMatch).not.toBeNull()
    expect(result.setName).toBe("Swords Dance")
  })
})

// ---------------------------------------------------------------------------
// resolveMoves
// ---------------------------------------------------------------------------

describe("resolveMoves", () => {
  it("resolves plain moves", () => {
    const result = resolveMoves([], ["Earthquake", "Dragon Claw", "Swords Dance", "Scale Shot"])
    expect(result).toEqual(["Earthquake", "Dragon Claw", "Swords Dance", "Scale Shot"])
  })

  it("picks first option for unrevealed slash options", () => {
    const result = resolveMoves([], [["Earthquake", "Stone Edge"], "Dragon Claw"])
    expect(result).toEqual(["Earthquake", "Dragon Claw"])
  })

  it("picks revealed move from slash options", () => {
    const result = resolveMoves(["Stone Edge"], [["Earthquake", "Stone Edge"], "Dragon Claw"])
    expect(result).toEqual(["Stone Edge", "Dragon Claw"])
  })

  it("is case insensitive when matching revealed moves to slash options", () => {
    const result = resolveMoves(["stone edge"], [["Earthquake", "Stone Edge"], "Dragon Claw"])
    expect(result).toEqual(["Stone Edge", "Dragon Claw"])
  })

  it("handles all slash options", () => {
    const result = resolveMoves(
      ["Fire Blast"],
      [
        ["Earthquake", "Stone Edge"],
        ["Fire Blast", "Flamethrower"],
      ],
    )
    expect(result).toEqual(["Earthquake", "Fire Blast"])
  })
})

// ---------------------------------------------------------------------------
// enrichExtractedTeam
// ---------------------------------------------------------------------------

describe("enrichExtractedTeam", () => {
  beforeEach(() => {
    mockFindMany.mockReset()
  })

  it("enriches pokemon with inferred set data", async () => {
    mockFindMany.mockResolvedValue([
      makeDbRow({
        pokemonId: "garchomp",
        setName: "Swords Dance",
        ability: "Rough Skin",
        item: "Leftovers",
        nature: "Jolly",
        moves: JSON.stringify(["Earthquake", "Dragon Claw", "Swords Dance", "Scale Shot"]),
        evs: JSON.stringify({ atk: 252, spe: 252, hp: 4 }),
      }),
    ])

    const team = {
      playerName: "Test Player",
      pokemon: [
        makeExtracted({
          speciesId: "garchomp",
          moves: ["Earthquake"],
        }),
      ],
    }

    const result = await enrichExtractedTeam(team, "gen9ou")

    expect(result.pokemon[0].moves).toEqual([
      "Earthquake",
      "Dragon Claw",
      "Swords Dance",
      "Scale Shot",
    ])
    expect(result.pokemon[0].nature).toBe("Jolly")
    expect(result.pokemon[0].evs).toEqual({ atk: 252, spe: 252, hp: 4 })
  })

  it("preserves revealed data over inferred data", async () => {
    mockFindMany.mockResolvedValue([
      makeDbRow({
        pokemonId: "garchomp",
        ability: "Rough Skin",
        item: "Leftovers",
      }),
    ])

    const team = {
      playerName: "Test Player",
      pokemon: [
        makeExtracted({
          speciesId: "garchomp",
          moves: ["Earthquake"],
          ability: "Sand Veil",
          item: "Choice Band",
        }),
      ],
    }

    const result = await enrichExtractedTeam(team, "gen9ou")

    // Revealed ability and item should be preserved
    expect(result.pokemon[0].ability).toBe("Sand Veil")
    expect(result.pokemon[0].item).toBe("Choice Band")
  })

  it("leaves pokemon unchanged when no sets match", async () => {
    mockFindMany.mockResolvedValue([])

    const pokemon = makeExtracted({
      speciesId: "garchomp",
      moves: ["Earthquake"],
    })
    const team = {
      playerName: "Test Player",
      pokemon: [pokemon],
    }

    const result = await enrichExtractedTeam(team, "gen9ou")

    expect(result.pokemon[0]).toEqual(pokemon)
    expect(result.pokemon[0].nature).toBeUndefined()
    expect(result.pokemon[0].evs).toBeUndefined()
  })

  it("handles multiple pokemon with different species", async () => {
    mockFindMany.mockResolvedValue([
      makeDbRow({ pokemonId: "garchomp" }),
      makeDbRow({
        pokemonId: "heatran",
        setName: "Specially Defensive",
        ability: "Flash Fire",
        item: "Leftovers",
        nature: "Calm",
        moves: JSON.stringify(["Lava Plume", "Earth Power", "Stealth Rock", "Toxic"]),
        evs: JSON.stringify({ hp: 252, spd: 252, def: 4 }),
      }),
    ])

    const team = {
      playerName: "Test Player",
      pokemon: [
        makeExtracted({ speciesId: "garchomp", moves: ["Earthquake"] }),
        makeExtracted({
          speciesId: "heatran",
          species: "Heatran",
          moves: ["Lava Plume"],
        }),
      ],
    }

    const result = await enrichExtractedTeam(team, "gen9ou")

    expect(result.pokemon).toHaveLength(2)
    // Both should be enriched
    expect(result.pokemon[0].nature).toBe("Jolly")
    expect(result.pokemon[1].nature).toBe("Calm")
    expect(result.pokemon[1].ability).toBe("Flash Fire")
  })

  it("calls getAllSetsForFormat once", async () => {
    mockFindMany.mockResolvedValue([])

    const team = {
      playerName: "Test Player",
      pokemon: [
        makeExtracted({ speciesId: "garchomp" }),
        makeExtracted({ speciesId: "heatran", species: "Heatran" }),
      ],
    }

    await enrichExtractedTeam(team, "gen9ou")

    expect(mockFindMany).toHaveBeenCalledTimes(1)
    expect(mockFindMany).toHaveBeenCalledWith({ where: { formatId: "gen9ou" } })
  })
})
