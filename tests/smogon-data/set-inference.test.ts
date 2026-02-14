import { inferFromSets, enrichExtractedTeam } from "@nasty-plot/smogon-data"
import { scoreSetMatch, resolveMoves } from "#smogon-data/set-inference.service"
import type { ExtractedPokemon } from "@nasty-plot/smogon-data"
import type { SmogonSetData } from "@nasty-plot/core"
import { DEFAULT_LEVEL, MAX_SINGLE_EV } from "@nasty-plot/core"

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
    evs: { atk: MAX_SINGLE_EV, spe: MAX_SINGLE_EV, hp: 4 },
    ...overrides,
  }
}

function makeExtracted(overrides?: Partial<ExtractedPokemon>): ExtractedPokemon {
  return {
    pokemonId: "garchomp",
    pokemonName: "Garchomp",
    level: DEFAULT_LEVEL,
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
    evs: JSON.stringify({ atk: MAX_SINGLE_EV, spe: MAX_SINGLE_EV, hp: 4 }),
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

  it("heavily penalizes when a revealed move is not in the set", () => {
    const extracted = makeExtracted({
      moves: ["Earthquake", "Flamethrower"],
    })
    const set = makeSet()
    const result = scoreSetMatch(extracted, set)

    // Unmatched moves cause disqualification
    expect(result.score).toBe(0)
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

  it("gives a base score when nothing is revealed (team preview only)", () => {
    const extracted = makeExtracted({
      moves: [],
      // no ability, item, or teraType
    })
    const set = makeSet()
    const result = scoreSetMatch(extracted, set)

    // Should still produce a non-zero score so the first set is selected
    expect(result.score).toBeGreaterThan(0)
    expect(result.matchedMoves).toEqual([])
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

  it("returns null result when moves don't match any set", () => {
    const extracted = makeExtracted({
      moves: ["Flamethrower"],
    })
    const set = makeSet()

    const result = inferFromSets(extracted, [set])

    // Strict scoring returns no match
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
      evs: { atk: MAX_SINGLE_EV, spe: MAX_SINGLE_EV, hp: 4 },
    })

    const result = inferFromSets(extracted, [set])

    expect(result.nature).toBe("Jolly")
    expect(result.evs).toEqual({ atk: MAX_SINGLE_EV, spe: MAX_SINGLE_EV, hp: 4 })
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

  it("picks the first set when nothing is revealed (team preview only)", () => {
    const extracted = makeExtracted({ moves: [] })
    const set1 = makeSet({ setName: "Swords Dance" })
    const set2 = makeSet({ setName: "Stealth Rock" })

    const result = inferFromSets(extracted, [set1, set2])

    expect(result.bestMatch).not.toBeNull()
    expect(result.setName).toBe("Swords Dance")
    expect(result.moves).toEqual(["Earthquake", "Dragon Claw", "Swords Dance", "Scale Shot"])
    expect(result.nature).toBe("Jolly")
    expect(result.evs).toEqual({ atk: MAX_SINGLE_EV, spe: MAX_SINGLE_EV, hp: 4 })
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

  it("avoids duplicate moves when same option appears in multiple slots", () => {
    // Real case: Indeedee-F has Protect as a slash option in two slots
    const result = resolveMoves(
      ["Protect"],
      [
        ["Trick Room", "Protect"],
        ["Helping Hand", "Protect"],
        ["Psychic", "Dazzling Gleam"],
        "Follow Me",
      ],
    )
    expect(result).toEqual(["Protect", "Helping Hand", "Psychic", "Follow Me"])
    // Protect is picked for first slot, second slot falls back to non-duplicate
  })

  it("avoids duplicating a fixed move via slash option", () => {
    // Protect in two slash slots — first picks Protect (revealed), second falls back to Taunt
    const result = resolveMoves(
      ["Protect", "Tailwind"],
      ["Bleakwind Storm", ["Rain Dance", "Protect"], "Tailwind", ["Taunt", "Protect"]],
    )
    expect(result).toEqual(["Bleakwind Storm", "Protect", "Tailwind", "Taunt"])
    // No duplicates: Protect used once, Taunt fills the other slot
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
        evs: JSON.stringify({ atk: MAX_SINGLE_EV, spe: MAX_SINGLE_EV, hp: 4 }),
      }),
    ])

    const team = {
      playerName: "Test Player",
      pokemon: [
        makeExtracted({
          pokemonId: "garchomp",
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
    expect(result.pokemon[0].evs).toEqual({ atk: MAX_SINGLE_EV, spe: MAX_SINGLE_EV, hp: 4 })
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
          pokemonId: "garchomp",
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
      pokemonId: "garchomp",
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
        evs: JSON.stringify({ hp: MAX_SINGLE_EV, spd: MAX_SINGLE_EV, def: 4 }),
      }),
    ])

    const team = {
      playerName: "Test Player",
      pokemon: [
        makeExtracted({ pokemonId: "garchomp", moves: ["Earthquake"] }),
        makeExtracted({
          pokemonId: "heatran",
          pokemonName: "Heatran",
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

  it("calls getAllSetsForFormat once when exact format has sets", async () => {
    mockFindMany.mockResolvedValue([makeDbRow()])

    const team = {
      playerName: "Test Player",
      pokemon: [makeExtracted({ pokemonId: "garchomp" })],
    }

    await enrichExtractedTeam(team, "gen9ou")

    expect(mockFindMany).toHaveBeenCalledTimes(1)
    expect(mockFindMany).toHaveBeenCalledWith({ where: { formatId: "gen9ou" } })
  })

  it("falls back to related format when exact format has no sets", async () => {
    // gen9vgc2025 has sets, everything else is empty
    mockFindMany.mockImplementation(({ where }: { where: { formatId: string } }) => {
      if (where.formatId === "gen9vgc2025") {
        return Promise.resolve([
          makeDbRow({
            pokemonId: "fluttermane",
            setName: "Choice Specs",
            ability: "Protosynthesis",
            item: "Choice Specs",
            nature: "Timid",
            moves: JSON.stringify(["Moonblast", "Shadow Ball", "Mystical Fire", "Dazzling Gleam"]),
            evs: JSON.stringify({ spa: MAX_SINGLE_EV, spe: MAX_SINGLE_EV, hp: 4 }),
          }),
        ])
      }
      return Promise.resolve([])
    })

    const team = {
      playerName: "Test Player",
      pokemon: [
        makeExtracted({
          pokemonId: "fluttermane",
          pokemonName: "Flutter Mane",
          moves: ["Moonblast"],
        }),
      ],
    }

    const result = await enrichExtractedTeam(team, "gen9vgc2026regfbo3")

    // Should have enriched from the fallback format
    expect(result.pokemon[0].nature).toBe("Timid")
    expect(result.pokemon[0].evs).toEqual({ spa: MAX_SINGLE_EV, spe: MAX_SINGLE_EV, hp: 4 })
    expect(result.pokemon[0].moves).toEqual([
      "Moonblast",
      "Shadow Ball",
      "Mystical Fire",
      "Dazzling Gleam",
    ])
  })

  it("falls back to gen9doublesou for unknown VGC formats", async () => {
    // All VGC-specific formats empty, but gen9doublesou has data
    mockFindMany.mockImplementation(({ where }: { where: { formatId: string } }) => {
      if (where.formatId === "gen9doublesou") {
        return Promise.resolve([makeDbRow({ pokemonId: "dondozo" })])
      }
      return Promise.resolve([])
    })

    const team = {
      playerName: "Test Player",
      pokemon: [
        makeExtracted({ pokemonId: "dondozo", pokemonName: "Dondozo", moves: ["Earthquake"] }),
      ],
    }

    const result = await enrichExtractedTeam(team, "gen9vgc2030regz")

    expect(result.pokemon[0].nature).toBe("Jolly")
  })
})
