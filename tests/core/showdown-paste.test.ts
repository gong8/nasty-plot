import { parseShowdownPaste, serializeShowdownPaste, toId } from "@nasty-plot/core"
import { DEFAULT_EVS, DEFAULT_IVS } from "@nasty-plot/core"
import type { NatureName, TeamSlotData, StatsTable } from "@nasty-plot/core"

// ---------------------------------------------------------------------------
// Helper to build a full TeamSlotData for serialization tests
// ---------------------------------------------------------------------------

function makeSlot(overrides: Partial<TeamSlotData> = {}): TeamSlotData {
  return {
    position: 1,
    pokemonId: "garchomp",
    species: {
      id: "garchomp",
      name: "Garchomp",
      num: 445,
      types: ["Dragon", "Ground"],
      baseStats: { hp: 108, atk: 130, def: 95, spa: 80, spd: 85, spe: 102 },
      abilities: { "0": "Sand Veil" },
      weightkg: 95,
    },
    ability: "Rough Skin",
    item: "Rocky Helmet",
    nature: "Jolly" as NatureName,
    level: 100,
    moves: ["Earthquake", "Dragon Claw", "Swords Dance", "Scale Shot"],
    evs: { hp: 0, atk: 252, def: 0, spa: 0, spd: 4, spe: 252 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// toId
// ---------------------------------------------------------------------------

describe("toId", () => {
  it("converts a simple name to lowercase", () => {
    expect(toId("Pikachu")).toBe("pikachu")
  })

  it("removes spaces", () => {
    expect(toId("Great Tusk")).toBe("greattusk")
  })

  it("removes hyphens and special characters", () => {
    expect(toId("Porygon-Z")).toBe("porygonz")
  })

  it("removes parentheses", () => {
    expect(toId("Urshifu (Rapid Strike)")).toBe("urshifurapidstrike")
  })

  it("returns empty string for empty input", () => {
    expect(toId("")).toBe("")
  })

  it("handles names with apostrophes", () => {
    expect(toId("Farfetch'd")).toBe("farfetchd")
  })

  it("handles names with periods", () => {
    expect(toId("Mr. Mime")).toBe("mrmime")
  })

  it("preserves digits", () => {
    expect(toId("Porygon2")).toBe("porygon2")
  })

  it("handles already-lowercase IDs", () => {
    expect(toId("garchomp")).toBe("garchomp")
  })
})

// ---------------------------------------------------------------------------
// parseShowdownPaste - single Pokemon
// ---------------------------------------------------------------------------

describe("parseShowdownPaste - single Pokemon", () => {
  it("parses a standard competitive set", () => {
    const paste = `Garchomp @ Rocky Helmet
Ability: Rough Skin
Level: 100
Tera Type: Steel
EVs: 252 Atk / 4 SpD / 252 Spe
Jolly Nature
- Earthquake
- Dragon Claw
- Swords Dance
- Scale Shot`

    const result = parseShowdownPaste(paste)
    expect(result).toHaveLength(1)

    const slot = result[0]
    expect(slot.pokemonId).toBe("garchomp")
    expect(slot.nickname).toBeUndefined()
    expect(slot.item).toBe("Rocky Helmet")
    expect(slot.ability).toBe("Rough Skin")
    expect(slot.level).toBe(100)
    expect(slot.teraType).toBe("Steel")
    expect(slot.nature).toBe("Jolly")
    expect(slot.evs).toEqual({ hp: 0, atk: 252, def: 0, spa: 0, spd: 4, spe: 252 })
    expect(slot.ivs).toEqual({ hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 })
    expect(slot.moves).toEqual(["Earthquake", "Dragon Claw", "Swords Dance", "Scale Shot"])
  })

  it("parses a Pokemon with nickname", () => {
    const paste = `Chompy (Garchomp) @ Choice Scarf
Ability: Rough Skin
EVs: 252 Atk / 252 Spe
Adamant Nature
- Earthquake
- Outrage`

    const result = parseShowdownPaste(paste)
    expect(result[0].pokemonId).toBe("garchomp")
    expect(result[0].nickname).toBe("Chompy")
    expect(result[0].item).toBe("Choice Scarf")
  })

  it("parses a Pokemon with nickname and gender", () => {
    const paste = `Chompy (Garchomp) (M) @ Life Orb
Ability: Rough Skin
- Earthquake`

    const result = parseShowdownPaste(paste)
    expect(result[0].pokemonId).toBe("garchomp")
    expect(result[0].nickname).toBe("Chompy")
    expect(result[0].item).toBe("Life Orb")
  })

  it("parses a Pokemon with gender but no nickname", () => {
    const paste = `Garchomp (F) @ Leftovers
Ability: Rough Skin
- Earthquake`

    const result = parseShowdownPaste(paste)
    expect(result[0].pokemonId).toBe("garchomp")
    expect(result[0].nickname).toBeUndefined()
    expect(result[0].item).toBe("Leftovers")
  })

  it("parses a Pokemon with nickname (e.g. asol (Miraidon))", () => {
    const paste = `asol (Miraidon) @ Life Orb
Ability: Hadron Engine
Tera Type: Electric
EVs: 252 SpA / 4 SpD / 252 Spe
Timid Nature
- Electro Drift
- Draco Meteor
- Volt Switch
- Protect`

    const result = parseShowdownPaste(paste)
    expect(result[0].pokemonId).toBe("miraidon")
    expect(result[0].nickname).toBe("asol")
    expect(result[0].item).toBe("Life Orb")
    expect(result[0].ability).toBe("Hadron Engine")
    expect(result[0].teraType).toBe("Electric")
  })

  it("parses a Pokemon with no item", () => {
    const paste = `Garchomp
Ability: Rough Skin
- Earthquake`

    const result = parseShowdownPaste(paste)
    expect(result[0].pokemonId).toBe("garchomp")
    expect(result[0].item).toBe("")
  })

  it("defaults to Level 100 when no level specified", () => {
    const paste = `Pikachu @ Light Ball
Ability: Static
- Thunderbolt`

    const result = parseShowdownPaste(paste)
    expect(result[0].level).toBe(100)
  })

  it("parses custom level", () => {
    const paste = `Pikachu @ Light Ball
Ability: Static
Level: 50
- Thunderbolt`

    const result = parseShowdownPaste(paste)
    expect(result[0].level).toBe(50)
  })

  it("defaults to Hardy nature when none specified", () => {
    const paste = `Pikachu @ Light Ball
Ability: Static
- Thunderbolt`

    const result = parseShowdownPaste(paste)
    expect(result[0].nature).toBe("Hardy")
  })

  it("defaults EVs to all 0 when not specified", () => {
    const paste = `Pikachu @ Light Ball
Ability: Static
- Thunderbolt`

    const result = parseShowdownPaste(paste)
    expect(result[0].evs).toEqual(DEFAULT_EVS)
  })

  it("defaults IVs to all 31 when not specified", () => {
    const paste = `Pikachu @ Light Ball
Ability: Static
- Thunderbolt`

    const result = parseShowdownPaste(paste)
    expect(result[0].ivs).toEqual(DEFAULT_IVS)
  })

  it("parses custom IVs", () => {
    const paste = `Ferrothorn @ Leftovers
Ability: Iron Barbs
IVs: 0 Spe
- Gyro Ball`

    const result = parseShowdownPaste(paste)
    expect(result[0].ivs).toEqual({ hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 0 })
  })

  it("parses multiple custom IVs", () => {
    const paste = `Ditto @ Choice Scarf
Ability: Imposter
IVs: 0 Atk / 0 Spe
- Transform`

    const result = parseShowdownPaste(paste)
    expect(result[0].ivs?.atk).toBe(0)
    expect(result[0].ivs?.spe).toBe(0)
    expect(result[0].ivs?.hp).toBe(31)
  })

  it("handles fewer than 4 moves", () => {
    const paste = `Ditto @ Choice Scarf
Ability: Imposter
- Transform`

    const result = parseShowdownPaste(paste)
    expect(result[0].moves).toEqual(["Transform", undefined, undefined, undefined])
  })

  it("handles exactly 1 move", () => {
    const paste = `Magikarp
- Splash`

    const result = parseShowdownPaste(paste)
    expect(result[0].moves?.[0]).toBe("Splash")
    expect(result[0].moves?.[1]).toBeUndefined()
  })

  it("handles 0 moves", () => {
    const paste = `Magikarp
Ability: Swift Swim`

    const result = parseShowdownPaste(paste)
    expect(result[0].moves).toEqual(["", undefined, undefined, undefined])
  })

  it("sets position to 1 for a single Pokemon", () => {
    const paste = `Pikachu
- Thunderbolt`

    const result = parseShowdownPaste(paste)
    expect(result[0].position).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// parseShowdownPaste - multiple Pokemon
// ---------------------------------------------------------------------------

describe("parseShowdownPaste - multiple Pokemon", () => {
  it("parses multiple Pokemon separated by blank lines", () => {
    const paste = `Garchomp @ Rocky Helmet
Ability: Rough Skin
EVs: 252 Atk / 252 Spe
Jolly Nature
- Earthquake

Pikachu @ Light Ball
Ability: Static
EVs: 252 SpA / 252 Spe
Timid Nature
- Thunderbolt`

    const result = parseShowdownPaste(paste)
    expect(result).toHaveLength(2)
    expect(result[0].pokemonId).toBe("garchomp")
    expect(result[1].pokemonId).toBe("pikachu")
  })

  it("assigns sequential positions", () => {
    const paste = `Garchomp
- Earthquake

Pikachu
- Thunderbolt

Charizard
- Flamethrower`

    const result = parseShowdownPaste(paste)
    expect(result[0].position).toBe(1)
    expect(result[1].position).toBe(2)
    expect(result[2].position).toBe(3)
  })

  it("parses a full team of 6", () => {
    const paste = `Garchomp
- Earthquake

Pikachu
- Thunderbolt

Charizard
- Flamethrower

Blastoise
- Surf

Venusaur
- Solar Beam

Mewtwo
- Psychic`

    const result = parseShowdownPaste(paste)
    expect(result).toHaveLength(6)
    expect(result[5].pokemonId).toBe("mewtwo")
    expect(result[5].position).toBe(6)
  })
})

// ---------------------------------------------------------------------------
// parseShowdownPaste - edge cases
// ---------------------------------------------------------------------------

describe("parseShowdownPaste - edge cases", () => {
  it("returns empty array for empty string", () => {
    expect(parseShowdownPaste("")).toEqual([])
  })

  it("returns empty array for whitespace only", () => {
    expect(parseShowdownPaste("   \n\n   ")).toEqual([])
  })

  it("handles extra whitespace around lines", () => {
    const paste = `  Garchomp @ Rocky Helmet
  Ability: Rough Skin
  - Earthquake  `

    const result = parseShowdownPaste(paste)
    expect(result[0].pokemonId).toBe("garchomp")
    expect(result[0].ability).toBe("Rough Skin")
    expect(result[0].moves?.[0]).toBe("Earthquake")
  })

  it("handles multiple blank lines between Pokemon", () => {
    const paste = `Garchomp
- Earthquake




Pikachu
- Thunderbolt`

    const result = parseShowdownPaste(paste)
    expect(result).toHaveLength(2)
  })

  it("parses a real-world competitive VGC paste", () => {
    const paste = `Flutter Mane @ Booster Energy
Ability: Protosynthesis
Level: 50
Tera Type: Fairy
EVs: 252 SpA / 4 SpD / 252 Spe
Timid Nature
IVs: 0 Atk
- Moonblast
- Shadow Ball
- Dazzling Gleam
- Protect`

    const result = parseShowdownPaste(paste)
    expect(result[0].pokemonId).toBe("fluttermane")
    expect(result[0].item).toBe("Booster Energy")
    expect(result[0].ability).toBe("Protosynthesis")
    expect(result[0].level).toBe(50)
    expect(result[0].teraType).toBe("Fairy")
    expect(result[0].evs).toEqual({ hp: 0, atk: 0, def: 0, spa: 252, spd: 4, spe: 252 })
    expect(result[0].ivs?.atk).toBe(0)
    expect(result[0].nature).toBe("Timid")
    expect(result[0].moves).toEqual(["Moonblast", "Shadow Ball", "Dazzling Gleam", "Protect"])
  })

  it("ignores unrecognized lines (not Ability/Level/Tera/EVs/IVs/Nature/move)", () => {
    const paste = `Garchomp @ Rocky Helmet
Ability: Rough Skin
Shiny: Yes
Happiness: 255
Gigantamax: Yes
- Earthquake`

    const result = parseShowdownPaste(paste)
    expect(result[0].pokemonId).toBe("garchomp")
    expect(result[0].ability).toBe("Rough Skin")
    expect(result[0].moves?.[0]).toBe("Earthquake")
  })

  it("deduplicates moves in paste", () => {
    const paste = `Garchomp @ Rocky Helmet
Ability: Rough Skin
- Earthquake
- Earthquake
- Swords Dance
- Earthquake`

    const result = parseShowdownPaste(paste)
    expect(result[0].moves).toEqual(["Earthquake", "Swords Dance", undefined, undefined])
  })

  it("handles malformed EV string gracefully (non-matching parts ignored)", () => {
    // "badformat" doesn't match /^(\d+)\s+(HP|Atk|Def|SpA|SpD|Spe)$/
    const paste = `Garchomp @ Rocky Helmet
Ability: Rough Skin
EVs: 252 Atk / badformat / 252 Spe
- Earthquake`

    const result = parseShowdownPaste(paste)
    expect(result[0].evs?.atk).toBe(252)
    expect(result[0].evs?.spe).toBe(252)
    // Other EVs remain at default (0)
    expect(result[0].evs?.hp).toBe(0)
  })

  it("handles IV string with invalid stat name (non-matching part ignored)", () => {
    // "0 Foo" doesn't match any valid stat
    const paste = `Garchomp @ Rocky Helmet
Ability: Rough Skin
IVs: 0 Atk / 0 Foo
- Earthquake`

    const result = parseShowdownPaste(paste)
    expect(result[0].ivs?.atk).toBe(0)
    // All other IVs stay at default 31
    expect(result[0].ivs?.hp).toBe(31)
  })

  it("parses Pokemon with multi-word names", () => {
    const paste = `Great Tusk @ Booster Energy
Ability: Protosynthesis
- Headlong Rush`

    const result = parseShowdownPaste(paste)
    expect(result[0].pokemonId).toBe("greattusk")
  })

  it("parses Pokemon with hyphens in names", () => {
    const paste = `Porygon-Z @ Choice Specs
Ability: Adaptability
- Tri Attack`

    const result = parseShowdownPaste(paste)
    expect(result[0].pokemonId).toBe("porygonz")
  })
})

// ---------------------------------------------------------------------------
// serializeShowdownPaste
// ---------------------------------------------------------------------------

describe("serializeShowdownPaste", () => {
  it("serializes a standard slot with item", () => {
    const slot = makeSlot()
    const output = serializeShowdownPaste([slot])

    expect(output).toContain("Garchomp @ Rocky Helmet")
    expect(output).toContain("Ability: Rough Skin")
    expect(output).toContain("Jolly Nature")
    expect(output).toContain("- Earthquake")
    expect(output).toContain("- Dragon Claw")
    expect(output).toContain("- Swords Dance")
    expect(output).toContain("- Scale Shot")
  })

  it("omits Level line when level is 100", () => {
    const slot = makeSlot({ level: 100 })
    const output = serializeShowdownPaste([slot])
    expect(output).not.toContain("Level:")
  })

  it("includes Level line when not 100", () => {
    const slot = makeSlot({ level: 50 })
    const output = serializeShowdownPaste([slot])
    expect(output).toContain("Level: 50")
  })

  it("serializes EVs that differ from defaults", () => {
    const slot = makeSlot({ evs: { hp: 0, atk: 252, def: 0, spa: 0, spd: 4, spe: 252 } })
    const output = serializeShowdownPaste([slot])
    expect(output).toContain("EVs: 252 Atk / 4 SpD / 252 Spe")
  })

  it("omits EVs line when all are default (0)", () => {
    const slot = makeSlot({ evs: { ...DEFAULT_EVS } })
    const output = serializeShowdownPaste([slot])
    expect(output).not.toContain("EVs:")
  })

  it("omits IVs line when all are default (31)", () => {
    const slot = makeSlot({ ivs: { ...DEFAULT_IVS } })
    const output = serializeShowdownPaste([slot])
    expect(output).not.toContain("IVs:")
  })

  it("serializes IVs that differ from defaults", () => {
    const slot = makeSlot({ ivs: { hp: 31, atk: 0, def: 31, spa: 31, spd: 31, spe: 31 } })
    const output = serializeShowdownPaste([slot])
    expect(output).toContain("IVs: 0 Atk")
  })

  it("serializes Tera Type when present", () => {
    const slot = makeSlot({ teraType: "Steel" })
    const output = serializeShowdownPaste([slot])
    expect(output).toContain("Tera Type: Steel")
  })

  it("omits Tera Type when not set", () => {
    const slot = makeSlot({ teraType: undefined })
    const output = serializeShowdownPaste([slot])
    expect(output).not.toContain("Tera Type:")
  })

  it("serializes Pokemon name without item when item is empty", () => {
    const slot = makeSlot({ item: "" })
    const output = serializeShowdownPaste([slot])
    const firstLine = output.split("\n")[0]
    expect(firstLine).toBe("Garchomp")
    expect(firstLine).not.toContain("@")
  })

  it("serializes nickname with species in parentheses", () => {
    const slot = makeSlot({ nickname: "Chompy" })
    const output = serializeShowdownPaste([slot])
    const firstLine = output.split("\n")[0]
    expect(firstLine).toBe("Chompy (Garchomp) @ Rocky Helmet")
  })

  it("serializes nickname without item", () => {
    const slot = makeSlot({ nickname: "Chompy", item: "" })
    const output = serializeShowdownPaste([slot])
    const firstLine = output.split("\n")[0]
    expect(firstLine).toBe("Chompy (Garchomp)")
  })

  it("uses species name when available", () => {
    const slot = makeSlot({
      species: {
        id: "greattusk",
        name: "Great Tusk",
        num: 984,
        types: ["Ground", "Fighting"],
        baseStats: { hp: 115, atk: 131, def: 131, spa: 53, spd: 53, spe: 87 },
        abilities: { "0": "Protosynthesis" },
        weightkg: 320,
      },
    })
    const output = serializeShowdownPaste([slot])
    expect(output.split("\n")[0]).toContain("Great Tusk")
  })

  it("falls back to pokemonId when species is undefined", () => {
    const slot = makeSlot({ species: undefined })
    const output = serializeShowdownPaste([slot])
    expect(output.split("\n")[0]).toContain("garchomp")
  })

  it("omits empty moves", () => {
    const slot = makeSlot({ moves: ["Earthquake", "", undefined, undefined] })
    const output = serializeShowdownPaste([slot])
    const moveLines = output.split("\n").filter((l) => l.startsWith("- "))
    expect(moveLines).toHaveLength(1)
    expect(moveLines[0]).toBe("- Earthquake")
  })

  it("serializes multiple slots separated by double newlines", () => {
    const slot1 = makeSlot({ pokemonId: "garchomp" })
    const slot2 = makeSlot({
      position: 2,
      pokemonId: "pikachu",
      species: {
        id: "pikachu",
        name: "Pikachu",
        num: 25,
        types: ["Electric"],
        baseStats: { hp: 35, atk: 55, def: 40, spa: 50, spd: 50, spe: 90 },
        abilities: { "0": "Static" },
        weightkg: 6,
      },
      item: "Light Ball",
      ability: "Static",
      nature: "Timid" as NatureName,
      moves: ["Thunderbolt", undefined, undefined, undefined],
      evs: { ...DEFAULT_EVS },
      ivs: { ...DEFAULT_IVS },
    })

    const output = serializeShowdownPaste([slot1, slot2])
    const blocks = output.split("\n\n")
    expect(blocks).toHaveLength(2)
    expect(blocks[0]).toContain("Garchomp")
    expect(blocks[1]).toContain("Pikachu")
  })

  it("omits Ability line when ability is empty", () => {
    const slot = makeSlot({ ability: "" })
    const output = serializeShowdownPaste([slot])
    expect(output).not.toContain("Ability:")
  })
})

// ---------------------------------------------------------------------------
// Round-trip: parse then serialize
// ---------------------------------------------------------------------------

describe("round-trip (parse -> serialize -> parse)", () => {
  it("preserves core data through a round-trip", () => {
    const original = `Garchomp @ Rocky Helmet
Ability: Rough Skin
Tera Type: Steel
EVs: 252 Atk / 4 SpD / 252 Spe
Jolly Nature
IVs: 0 SpA
- Earthquake
- Dragon Claw
- Swords Dance
- Scale Shot`

    const parsed = parseShowdownPaste(original)

    // Give the parsed data a species for serialization
    const slot: TeamSlotData = {
      ...parsed[0],
      species: {
        id: "garchomp",
        name: "Garchomp",
        num: 445,
        types: ["Dragon", "Ground"],
        baseStats: { hp: 108, atk: 130, def: 95, spa: 80, spd: 85, spe: 102 },
        abilities: { "0": "Sand Veil" },
        weightkg: 95,
      },
    } as TeamSlotData

    const serialized = serializeShowdownPaste([slot])
    const reparsed = parseShowdownPaste(serialized)

    expect(reparsed[0].pokemonId).toBe(parsed[0].pokemonId)
    expect(reparsed[0].item).toBe(parsed[0].item)
    expect(reparsed[0].ability).toBe(parsed[0].ability)
    expect(reparsed[0].nature).toBe(parsed[0].nature)
    expect(reparsed[0].teraType).toBe(parsed[0].teraType)
    expect(reparsed[0].evs).toEqual(parsed[0].evs)
    expect(reparsed[0].ivs).toEqual(parsed[0].ivs)
    expect(reparsed[0].moves).toEqual(parsed[0].moves)
  })
})
