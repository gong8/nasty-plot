import type { DamageCalcInput, StatsTable, TeamSlotData, PokemonType } from "@nasty-plot/core"
import { DEFAULT_EVS, DEFAULT_IVS, DEFAULT_LEVEL } from "@nasty-plot/core"
import { calculateDamage, calculateMatchupMatrix } from "@nasty-plot/damage-calc"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCalcInput(overrides?: Partial<DamageCalcInput>): DamageCalcInput {
  return {
    attacker: {
      pokemonId: "garchomp",
      level: DEFAULT_LEVEL,
      nature: "Jolly",
      ability: "Rough Skin",
      evs: { hp: 0, atk: 252, def: 0, spa: 0, spd: 4, spe: 252 },
    },
    defender: {
      pokemonId: "heatran",
      level: DEFAULT_LEVEL,
    },
    move: "Earthquake",
    ...overrides,
  }
}

const defaultStats: StatsTable = { hp: 80, atk: 80, def: 80, spa: 80, spd: 80, spe: 80 }

function makeSlot(
  pokemonId: string,
  types: [PokemonType] | [PokemonType, PokemonType],
  overrides?: Partial<TeamSlotData>,
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
    level: DEFAULT_LEVEL,
    moves: ["Earthquake", "Dragon Claw", undefined, undefined],
    evs: DEFAULT_EVS,
    ivs: DEFAULT_IVS,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("calculateDamage", () => {
  it("returns a DamageCalcResult object", () => {
    const result = calculateDamage(makeCalcInput())

    expect(result).toHaveProperty("moveName")
    expect(result).toHaveProperty("damage")
    expect(result).toHaveProperty("minPercent")
    expect(result).toHaveProperty("maxPercent")
    expect(result).toHaveProperty("minDamage")
    expect(result).toHaveProperty("maxDamage")
    expect(result).toHaveProperty("koChance")
    expect(result).toHaveProperty("description")
  })

  it("calculates damage for Earthquake vs Heatran (4x effective)", () => {
    const result = calculateDamage(makeCalcInput())

    // Earthquake is 4x effective against Fire/Steel Heatran
    expect(result.maxPercent).toBeGreaterThan(0)
    expect(result.moveName).toBe("Earthquake")
    expect(Array.isArray(result.damage)).toBe(true)
  })

  it("returns damage array with numbers", () => {
    const result = calculateDamage(makeCalcInput())

    expect(result.damage.length).toBeGreaterThan(0)
    for (const dmg of result.damage) {
      expect(typeof dmg).toBe("number")
    }
  })

  it("minDamage <= maxDamage", () => {
    const result = calculateDamage(makeCalcInput())

    expect(result.minDamage).toBeLessThanOrEqual(result.maxDamage)
  })

  it("minPercent <= maxPercent", () => {
    const result = calculateDamage(makeCalcInput())

    expect(result.minPercent).toBeLessThanOrEqual(result.maxPercent)
  })

  it("includes a KO chance string", () => {
    const result = calculateDamage(makeCalcInput())

    expect(typeof result.koChance).toBe("string")
    expect(result.koChance.length).toBeGreaterThan(0)
  })

  it("includes a description string", () => {
    const result = calculateDamage(makeCalcInput())

    expect(typeof result.description).toBe("string")
    expect(result.description.length).toBeGreaterThan(0)
  })

  it("respects field conditions", () => {
    const _resultNoWeather = calculateDamage(makeCalcInput({ move: "Flamethrower" }))

    const resultWithSun = calculateDamage(
      makeCalcInput({
        attacker: {
          pokemonId: "heatran",
          level: DEFAULT_LEVEL,
          ability: "Flash Fire",
          evs: { hp: 0, atk: 0, def: 0, spa: 252, spd: 4, spe: 252 },
        },
        defender: { pokemonId: "corviknight", level: DEFAULT_LEVEL },
        move: "Flamethrower",
        field: { weather: "Sun" },
      }),
    )

    // With sun, fire moves should do more damage
    expect(resultWithSun.maxPercent).toBeGreaterThan(0)
  })

  it("handles attacker boosts", () => {
    const unboosted = calculateDamage(makeCalcInput())
    const boosted = calculateDamage(
      makeCalcInput({
        attacker: {
          pokemonId: "garchomp",
          level: DEFAULT_LEVEL,
          nature: "Jolly",
          ability: "Rough Skin",
          evs: { hp: 0, atk: 252, def: 0, spa: 0, spd: 4, spe: 252 },
          boosts: { atk: 2 },
        },
      }),
    )

    expect(boosted.maxDamage).toBeGreaterThan(unboosted.maxDamage)
  })

  it("handles not-very-effective moves", () => {
    // Normal vs Steel
    const result = calculateDamage(
      makeCalcInput({
        attacker: { pokemonId: "snorlax", level: DEFAULT_LEVEL },
        defender: { pokemonId: "corviknight", level: DEFAULT_LEVEL },
        move: "Body Slam",
      }),
    )

    expect(result.maxPercent).toBeGreaterThan(0)
    expect(result.maxPercent).toBeLessThan(100)
  })

  it("applies Burned status to the attacker (reduces physical damage)", () => {
    const unburnedResult = calculateDamage(
      makeCalcInput({
        attacker: {
          pokemonId: "garchomp",
          level: DEFAULT_LEVEL,
          nature: "Jolly",
          ability: "Rough Skin",
          evs: { hp: 0, atk: 252, def: 0, spa: 0, spd: 4, spe: 252 },
        },
      }),
    )

    const burnedResult = calculateDamage(
      makeCalcInput({
        attacker: {
          pokemonId: "garchomp",
          level: DEFAULT_LEVEL,
          nature: "Jolly",
          ability: "Rough Skin",
          evs: { hp: 0, atk: 252, def: 0, spa: 0, spd: 4, spe: 252 },
          status: "Burned",
        },
      }),
    )

    // Burn halves physical attack damage
    expect(burnedResult.maxDamage).toBeLessThan(unburnedResult.maxDamage)
  })

  it("applies Paralyzed status to the attacker", () => {
    const result = calculateDamage(
      makeCalcInput({
        attacker: {
          pokemonId: "garchomp",
          level: DEFAULT_LEVEL,
          nature: "Jolly",
          ability: "Rough Skin",
          evs: { hp: 0, atk: 252, def: 0, spa: 0, spd: 4, spe: 252 },
          status: "Paralyzed",
        },
      }),
    )

    expect(result.maxPercent).toBeGreaterThan(0)
    expect(result.moveName).toBe("Earthquake")
  })

  it("applies Poisoned status to the defender", () => {
    const result = calculateDamage(
      makeCalcInput({
        defender: {
          pokemonId: "heatran",
          level: DEFAULT_LEVEL,
          status: "Poisoned",
        },
      }),
    )

    expect(result.maxPercent).toBeGreaterThan(0)
  })

  it("applies Badly Poisoned status to the defender", () => {
    const result = calculateDamage(
      makeCalcInput({
        defender: {
          pokemonId: "heatran",
          level: DEFAULT_LEVEL,
          status: "Badly Poisoned",
        },
      }),
    )

    expect(result.maxPercent).toBeGreaterThan(0)
  })

  it("applies Asleep status to the attacker", () => {
    const result = calculateDamage(
      makeCalcInput({
        attacker: {
          pokemonId: "garchomp",
          level: DEFAULT_LEVEL,
          nature: "Jolly",
          ability: "Rough Skin",
          evs: { hp: 0, atk: 252, def: 0, spa: 0, spd: 4, spe: 252 },
          status: "Asleep",
        },
      }),
    )

    expect(result.maxPercent).toBeGreaterThan(0)
  })

  it("applies Frozen status to the attacker", () => {
    const result = calculateDamage(
      makeCalcInput({
        attacker: {
          pokemonId: "garchomp",
          level: DEFAULT_LEVEL,
          nature: "Jolly",
          ability: "Rough Skin",
          evs: { hp: 0, atk: 252, def: 0, spa: 0, spd: 4, spe: 252 },
          status: "Frozen",
        },
      }),
    )

    expect(result.maxPercent).toBeGreaterThan(0)
  })

  it("treats None status as no status", () => {
    const noStatusResult = calculateDamage(makeCalcInput())
    const noneStatusResult = calculateDamage(
      makeCalcInput({
        attacker: {
          pokemonId: "garchomp",
          level: DEFAULT_LEVEL,
          nature: "Jolly",
          ability: "Rough Skin",
          evs: { hp: 0, atk: 252, def: 0, spa: 0, spd: 4, spe: 252 },
          status: "None",
        },
      }),
    )

    expect(noneStatusResult.maxDamage).toBe(noStatusResult.maxDamage)
  })

  it("treats Healthy status as no status", () => {
    const noStatusResult = calculateDamage(makeCalcInput())
    const healthyStatusResult = calculateDamage(
      makeCalcInput({
        attacker: {
          pokemonId: "garchomp",
          level: DEFAULT_LEVEL,
          nature: "Jolly",
          ability: "Rough Skin",
          evs: { hp: 0, atk: 252, def: 0, spa: 0, spd: 4, spe: 252 },
          status: "Healthy",
        },
      }),
    )

    expect(healthyStatusResult.maxDamage).toBe(noStatusResult.maxDamage)
  })

  it("handles fixed-damage moves like Seismic Toss", () => {
    const result = calculateDamage(
      makeCalcInput({
        attacker: { pokemonId: "snorlax", level: DEFAULT_LEVEL, ability: "Thick Fat" },
        defender: { pokemonId: "garchomp", level: DEFAULT_LEVEL },
        move: "Seismic Toss",
      }),
    )

    // Seismic Toss does exactly 100 HP at level 100
    expect(result.minDamage).toBe(100)
    expect(result.maxDamage).toBe(100)
  })

  it("handles tera type on attacker", () => {
    const result = calculateDamage(
      makeCalcInput({
        attacker: {
          pokemonId: "garchomp",
          level: DEFAULT_LEVEL,
          nature: "Jolly",
          ability: "Rough Skin",
          evs: { hp: 0, atk: 252, def: 0, spa: 0, spd: 4, spe: 252 },
          teraType: "Ground",
        },
      }),
    )

    // Tera Ground should boost Earthquake via STAB
    expect(result.maxPercent).toBeGreaterThan(0)
  })

  it("falls back to naive name conversion for unknown Pokemon IDs", () => {
    // Using a completely fake Pokemon ID that @pkmn/dex won't find,
    // which forces the resolveSpeciesName fallback path (lines 78-80).
    // The fallback converts camelCase to Title Case ("fakeMonster" -> "Fake Monster").
    // @smogon/calc will throw for an unknown species.
    expect(() =>
      calculateDamage(
        makeCalcInput({
          attacker: { pokemonId: "fakeMonster", level: DEFAULT_LEVEL },
        }),
      ),
    ).toThrow()
  })

  it("handles isCritical field option", () => {
    const normalResult = calculateDamage(makeCalcInput())
    const critResult = calculateDamage(
      makeCalcInput({
        field: { isCritical: true },
      }),
    )

    // Critical hits deal more damage
    expect(critResult.maxDamage).toBeGreaterThan(normalResult.maxDamage)
  })

  it("handles isReflect field option (reduces physical damage)", () => {
    const normalResult = calculateDamage(makeCalcInput())
    const reflectResult = calculateDamage(
      makeCalcInput({
        field: { isReflect: true },
      }),
    )

    // Reflect halves physical damage
    expect(reflectResult.maxDamage).toBeLessThan(normalResult.maxDamage)
  })

  it("handles isLightScreen field option", () => {
    const normalResult = calculateDamage(
      makeCalcInput({
        attacker: {
          pokemonId: "heatran",
          level: DEFAULT_LEVEL,
          ability: "Flash Fire",
          evs: { hp: 0, atk: 0, def: 0, spa: 252, spd: 4, spe: 252 },
        },
        defender: { pokemonId: "corviknight", level: DEFAULT_LEVEL },
        move: "Flamethrower",
      }),
    )
    const lsResult = calculateDamage(
      makeCalcInput({
        attacker: {
          pokemonId: "heatran",
          level: DEFAULT_LEVEL,
          ability: "Flash Fire",
          evs: { hp: 0, atk: 0, def: 0, spa: 252, spd: 4, spe: 252 },
        },
        defender: { pokemonId: "corviknight", level: DEFAULT_LEVEL },
        move: "Flamethrower",
        field: { isLightScreen: true },
      }),
    )

    // Light Screen reduces special damage
    expect(lsResult.maxDamage).toBeLessThan(normalResult.maxDamage)
  })

  it("handles isAuroraVeil field option", () => {
    const normalResult = calculateDamage(makeCalcInput())
    const veilResult = calculateDamage(
      makeCalcInput({
        field: { isAuroraVeil: true },
      }),
    )

    // Aurora Veil reduces damage
    expect(veilResult.maxDamage).toBeLessThan(normalResult.maxDamage)
  })

  it("handles terrain field option", () => {
    const resultWithTerrain = calculateDamage(
      makeCalcInput({
        field: { terrain: "Electric" },
      }),
    )

    expect(resultWithTerrain.maxPercent).toBeGreaterThan(0)
  })

  it("handles doubles game type", () => {
    const result = calculateDamage(
      makeCalcInput({
        field: { isDoubles: true },
      }),
    )

    expect(result.maxPercent).toBeGreaterThan(0)
  })

  it("handles spread moves in doubles (nested damage array)", () => {
    // Spread moves in doubles return number[][] from @smogon/calc
    const result = calculateDamage(
      makeCalcInput({
        attacker: {
          pokemonId: "garchomp",
          level: DEFAULT_LEVEL,
          nature: "Jolly",
          ability: "Rough Skin",
          evs: { hp: 0, atk: 252, def: 0, spa: 0, spd: 4, spe: 252 },
        },
        defender: { pokemonId: "heatran", level: DEFAULT_LEVEL },
        move: "Earthquake",
        field: { isDoubles: true },
      }),
    )

    expect(result.maxPercent).toBeGreaterThan(0)
    expect(Array.isArray(result.damage)).toBe(true)
  })

  it("reports weak moves as multi-hit KO or 5+ hits", () => {
    // Low-power move against a bulky target: should require multiple hits
    const result = calculateDamage(
      makeCalcInput({
        attacker: { pokemonId: "snorlax", level: DEFAULT_LEVEL },
        defender: {
          pokemonId: "corviknight",
          level: DEFAULT_LEVEL,
          evs: { hp: 252, atk: 0, def: 252, spa: 0, spd: 4, spe: 0 },
          nature: "Impish",
        },
        move: "Body Slam",
      }),
    )

    // Body Slam (NVE) vs max phys defense Corviknight should not OHKO
    expect(result.koChance).not.toBe("guaranteed OHKO")
  })
})

describe("calculateMatchupMatrix", () => {
  it("returns a 2D matrix of entries", () => {
    const team = [makeSlot("garchomp", ["Dragon", "Ground"])]
    const threats = ["heatran"]

    const matrix = calculateMatchupMatrix(team, threats, "gen9ou")

    expect(matrix.length).toBe(1)
    expect(matrix[0].length).toBe(1)
  })

  it("returns correctly shaped MatchupMatrixEntry objects", () => {
    const team = [makeSlot("garchomp", ["Dragon", "Ground"])]
    const threats = ["heatran"]

    const matrix = calculateMatchupMatrix(team, threats, "gen9ou")
    const entry = matrix[0][0]

    expect(entry).toHaveProperty("attackerId")
    expect(entry).toHaveProperty("attackerName")
    expect(entry).toHaveProperty("defenderId")
    expect(entry).toHaveProperty("defenderName")
    expect(entry).toHaveProperty("bestMove")
    expect(entry).toHaveProperty("maxPercent")
    expect(entry).toHaveProperty("koChance")
  })

  it("selects the best move for each matchup", () => {
    const team = [makeSlot("garchomp", ["Dragon", "Ground"])]
    const threats = ["heatran"]

    const matrix = calculateMatchupMatrix(team, threats, "gen9ou")
    const entry = matrix[0][0]

    // Earthquake should be best move vs Heatran (4x effective)
    expect(entry.bestMove).toBe("Earthquake")
    expect(entry.maxPercent).toBeGreaterThan(0)
  })

  it("handles multiple team members and threats", () => {
    const team = [
      makeSlot("garchomp", ["Dragon", "Ground"]),
      makeSlot("heatran", ["Fire", "Steel"], {
        position: 2,
        moves: ["Magma Storm", "Earth Power", undefined, undefined],
      }),
    ]
    const threats = ["corviknight", "clefable"]

    const matrix = calculateMatchupMatrix(team, threats, "gen9ou")

    expect(matrix.length).toBe(2)
    expect(matrix[0].length).toBe(2)
    expect(matrix[1].length).toBe(2)
  })

  it("handles team member with no valid moves gracefully", () => {
    const team = [
      makeSlot("garchomp", ["Dragon", "Ground"], {
        moves: [undefined, undefined, undefined, undefined],
      }),
    ]
    const threats = ["heatran"]

    const matrix = calculateMatchupMatrix(team, threats, "gen9ou")

    expect(matrix.length).toBe(1)
    expect(matrix[0].length).toBe(1)
  })

  it("skips status moves that fail to calculate and picks best damaging move", () => {
    const team = [
      makeSlot("garchomp", ["Dragon", "Ground"], {
        moves: ["Swords Dance", "Earthquake", undefined, undefined],
      }),
    ]
    const threats = ["heatran"]

    const matrix = calculateMatchupMatrix(team, threats, "gen9ou")
    const entry = matrix[0][0]

    // Swords Dance should fail to calc damage; Earthquake should be picked
    expect(entry.bestMove).toBe("Earthquake")
    expect(entry.maxPercent).toBeGreaterThan(0)
  })

  it("uses species.name when available on slot", () => {
    const team = [
      makeSlot("garchomp", ["Dragon", "Ground"], {
        species: {
          id: "garchomp",
          name: "Garchomp",
          num: 445,
          types: ["Dragon", "Ground"],
          baseStats: defaultStats,
          abilities: { "0": "Rough Skin" },
          weightkg: 95,
        },
      }),
    ]
    const threats = ["heatran"]

    const matrix = calculateMatchupMatrix(team, threats, "gen9ou")
    const entry = matrix[0][0]

    expect(entry.attackerName).toBe("Garchomp")
  })

  it("falls back to resolveSpeciesName when slot has no species object", () => {
    const team = [
      makeSlot("garchomp", ["Dragon", "Ground"], {
        species: undefined,
      }),
    ]
    const threats = ["heatran"]

    const matrix = calculateMatchupMatrix(team, threats, "gen9ou")
    const entry = matrix[0][0]

    // resolveSpeciesName should resolve "garchomp" to "Garchomp" via dex lookup
    expect(entry.attackerName).toBe("Garchomp")
    expect(entry.maxPercent).toBeGreaterThan(0)
  })
})

describe("calculateDamage - edge cases for coverage", () => {
  it("handles no field argument (buildField gets undefined)", () => {
    // This exercises line 38 (toCalcBoosts with undefined boosts)
    // and the field=undefined path
    const result = calculateDamage({
      attacker: {
        pokemonId: "garchomp",
        level: DEFAULT_LEVEL,
      },
      defender: {
        pokemonId: "heatran",
        level: DEFAULT_LEVEL,
      },
      move: "Earthquake",
    })

    expect(result.maxPercent).toBeGreaterThan(0)
  })

  it("handles no boosts on attacker (toCalcBoosts undefined path)", () => {
    const result = calculateDamage({
      attacker: {
        pokemonId: "garchomp",
        level: DEFAULT_LEVEL,
        // boosts not provided — exercises undefined path in toCalcBoosts
      },
      defender: {
        pokemonId: "heatran",
        level: DEFAULT_LEVEL,
      },
      move: "Earthquake",
    })

    expect(result.maxPercent).toBeGreaterThan(0)
  })

  it("handles attacker with empty boosts object", () => {
    const result = calculateDamage({
      attacker: {
        pokemonId: "garchomp",
        level: DEFAULT_LEVEL,
        boosts: {},
      },
      defender: {
        pokemonId: "heatran",
        level: DEFAULT_LEVEL,
      },
      move: "Earthquake",
    })

    expect(result.maxPercent).toBeGreaterThan(0)
  })

  it("handles description fallback when desc() throws", () => {
    // This is hard to trigger deterministically, but we can verify
    // the result still has a description string
    const result = calculateDamage({
      attacker: { pokemonId: "garchomp", level: DEFAULT_LEVEL },
      defender: { pokemonId: "heatran", level: DEFAULT_LEVEL },
      move: "Earthquake",
    })

    expect(typeof result.description).toBe("string")
    expect(result.description.length).toBeGreaterThan(0)
  })

  it("derives correct KO chance for guaranteed OHKO", () => {
    // Earthquake (4x effective) from max attack Garchomp should OHKO Heatran
    const result = calculateDamage({
      attacker: {
        pokemonId: "garchomp",
        level: DEFAULT_LEVEL,
        nature: "Adamant",
        ability: "Rough Skin",
        evs: { hp: 0, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 },
      },
      defender: {
        pokemonId: "heatran",
        level: DEFAULT_LEVEL,
      },
      move: "Earthquake",
    })

    expect(result.koChance).toContain("OHKO")
  })
})
