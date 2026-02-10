import {
  buildTurnCommentaryContext,
  buildPostBattleContext,
  buildTurnAnalysisContext,
} from "@nasty-plot/llm"
import type {
  BattleState,
  BattlePokemon,
  BattleLogEntry,
  FieldState,
  SideConditions,
  BattleSide,
  BoostTable,
} from "@nasty-plot/battle-engine"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBoosts(overrides?: Partial<BoostTable>): BoostTable {
  return {
    atk: 0,
    def: 0,
    spa: 0,
    spd: 0,
    spe: 0,
    accuracy: 0,
    evasion: 0,
    ...overrides,
  }
}

function makePokemon(overrides?: Partial<BattlePokemon>): BattlePokemon {
  return {
    speciesId: "garchomp",
    name: "Garchomp",
    nickname: "Garchomp",
    level: 100,
    types: ["Dragon", "Ground"],
    hp: 357,
    maxHp: 357,
    hpPercent: 100,
    status: "",
    fainted: false,
    item: "Choice Scarf",
    ability: "Rough Skin",
    isTerastallized: false,
    moves: [],
    stats: { hp: 357, atk: 359, def: 226, spa: 176, spd: 206, spe: 333 },
    boosts: makeBoosts(),
    volatiles: [],
    ...overrides,
  }
}

function makeSideConditions(overrides?: Partial<SideConditions>): SideConditions {
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

function makeField(overrides?: Partial<FieldState>): FieldState {
  return {
    weather: "",
    weatherTurns: 0,
    terrain: "",
    terrainTurns: 0,
    trickRoom: 0,
    ...overrides,
  }
}

function makeSide(overrides?: Partial<BattleSide>): BattleSide {
  const pokemon = makePokemon()
  return {
    active: [pokemon],
    team: [pokemon],
    name: "Player",
    sideConditions: makeSideConditions(),
    canTera: true,
    ...overrides,
  }
}

function makeState(overrides?: Partial<BattleState>): BattleState {
  return {
    phase: "battle",
    format: "singles",
    turn: 1,
    sides: {
      p1: makeSide({ name: "Player" }),
      p2: makeSide({ name: "Opponent" }),
    },
    field: makeField(),
    winner: null,
    log: [],
    fullLog: [],
    waitingForChoice: false,
    availableActions: null,
    id: "test-battle-1",
    ...overrides,
  }
}

function makeLogEntry(overrides?: Partial<BattleLogEntry>): BattleLogEntry {
  return {
    type: "move",
    message: "Garchomp used Earthquake!",
    turn: 1,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests: buildTurnCommentaryContext
// ---------------------------------------------------------------------------

describe("buildTurnCommentaryContext", () => {
  it("returns systemPrompt and turnContext", () => {
    const state = makeState()
    const result = buildTurnCommentaryContext(state, [], "Team A", "Team B")

    expect(result.systemPrompt).toContain("Pokemon competitive battle commentator")
    expect(result.turnContext).toContain("Turn 1")
    expect(result.turnContext).toContain("Team A")
    expect(result.turnContext).toContain("Team B")
  })

  it("includes side descriptions in turnContext", () => {
    const state = makeState()
    const result = buildTurnCommentaryContext(state, [], "T1", "T2")

    expect(result.turnContext).toContain("Player")
    expect(result.turnContext).toContain("Opponent")
    expect(result.turnContext).toContain("Garchomp")
  })

  it("includes battle log entries in turnContext", () => {
    const state = makeState()
    const entries = [
      makeLogEntry({ type: "move", message: "Garchomp used Earthquake!" }),
      makeLogEntry({ type: "damage", message: "Iron Valiant lost 65% HP!" }),
    ]
    const result = buildTurnCommentaryContext(state, entries, "T1", "T2")

    expect(result.turnContext).toContain("Garchomp used Earthquake!")
    expect(result.turnContext).toContain("Iron Valiant lost 65% HP!")
  })

  it("shows 'No events yet' when no entries", () => {
    const state = makeState()
    const result = buildTurnCommentaryContext(state, [], "T1", "T2")
    expect(result.turnContext).toContain("No events yet")
  })

  it("shows field effects", () => {
    const state = makeState({
      field: makeField({ weather: "Sun", weatherTurns: 3 }),
    })
    const result = buildTurnCommentaryContext(state, [], "T1", "T2")
    expect(result.turnContext).toContain("Weather: Sun (3 turns)")
  })

  it("shows terrain", () => {
    const state = makeState({
      field: makeField({ terrain: "Electric", terrainTurns: 2 }),
    })
    const result = buildTurnCommentaryContext(state, [], "T1", "T2")
    expect(result.turnContext).toContain("Terrain: Electric (2 turns)")
  })

  it("shows trick room", () => {
    const state = makeState({
      field: makeField({ trickRoom: 4 }),
    })
    const result = buildTurnCommentaryContext(state, [], "T1", "T2")
    expect(result.turnContext).toContain("Trick Room (4 turns)")
  })

  it("shows 'No field effects' when field is empty", () => {
    const state = makeState()
    const result = buildTurnCommentaryContext(state, [], "T1", "T2")
    expect(result.turnContext).toContain("No field effects")
  })

  it("describes Pokemon with low HP", () => {
    const pokemon = makePokemon({ hpPercent: 45 })
    const state = makeState({
      sides: {
        p1: makeSide({ active: [pokemon], team: [pokemon] }),
        p2: makeSide(),
      },
    })
    const result = buildTurnCommentaryContext(state, [], "T1", "T2")
    expect(result.turnContext).toContain("45% HP")
  })

  it("describes Pokemon with status condition", () => {
    const pokemon = makePokemon({ status: "brn" })
    const state = makeState({
      sides: {
        p1: makeSide({ active: [pokemon], team: [pokemon] }),
        p2: makeSide(),
      },
    })
    const result = buildTurnCommentaryContext(state, [], "T1", "T2")
    expect(result.turnContext).toContain("brn")
  })

  it("describes terastallized Pokemon", () => {
    const pokemon = makePokemon({
      isTerastallized: true,
      teraType: "Fire",
    })
    const state = makeState({
      sides: {
        p1: makeSide({ active: [pokemon], team: [pokemon] }),
        p2: makeSide(),
      },
    })
    const result = buildTurnCommentaryContext(state, [], "T1", "T2")
    expect(result.turnContext).toContain("Tera Fire")
  })

  it("describes Pokemon with stat boosts", () => {
    const pokemon = makePokemon({
      boosts: makeBoosts({ atk: 2, spe: -1 }),
    })
    const state = makeState({
      sides: {
        p1: makeSide({ active: [pokemon], team: [pokemon] }),
        p2: makeSide(),
      },
    })
    const result = buildTurnCommentaryContext(state, [], "T1", "T2")
    expect(result.turnContext).toContain("+2 atk")
    expect(result.turnContext).toContain("-1 spe")
  })

  it("describes empty active slot", () => {
    const state = makeState({
      sides: {
        p1: makeSide({ active: [null] }),
        p2: makeSide(),
      },
    })
    const result = buildTurnCommentaryContext(state, [], "T1", "T2")
    expect(result.turnContext).toContain("empty slot")
  })

  it("shows side conditions", () => {
    const state = makeState({
      sides: {
        p1: makeSide({
          sideConditions: makeSideConditions({
            stealthRock: true,
            spikes: 2,
            reflect: 3,
          }),
        }),
        p2: makeSide(),
      },
    })
    const result = buildTurnCommentaryContext(state, [], "T1", "T2")
    expect(result.turnContext).toContain("Stealth Rock")
    expect(result.turnContext).toContain("Spikes x2")
    expect(result.turnContext).toContain("Reflect (3t)")
  })

  it("shows toxic spikes, sticky web, light screen, aurora veil, tailwind", () => {
    const state = makeState({
      sides: {
        p1: makeSide({
          sideConditions: makeSideConditions({
            toxicSpikes: 1,
            stickyWeb: true,
            lightScreen: 5,
            auroraVeil: 2,
            tailwind: 3,
          }),
        }),
        p2: makeSide(),
      },
    })
    const result = buildTurnCommentaryContext(state, [], "T1", "T2")
    expect(result.turnContext).toContain("Toxic Spikes x1")
    expect(result.turnContext).toContain("Sticky Web")
    expect(result.turnContext).toContain("Light Screen (5t)")
    expect(result.turnContext).toContain("Aurora Veil (2t)")
    expect(result.turnContext).toContain("Tailwind (3t)")
  })

  it("shows 'none' for empty side conditions", () => {
    const state = makeState()
    const result = buildTurnCommentaryContext(state, [], "T1", "T2")
    expect(result.turnContext).toContain("Side: none")
  })

  it("shows alive count from team", () => {
    const alive = makePokemon()
    const fainted = makePokemon({ fainted: true })
    const state = makeState({
      sides: {
        p1: makeSide({
          active: [alive],
          team: [alive, fainted, makePokemon()],
        }),
        p2: makeSide(),
      },
    })
    const result = buildTurnCommentaryContext(state, [], "T1", "T2")
    expect(result.turnContext).toContain("2/3 alive")
  })

  it("filters log entries to relevant types", () => {
    const entries: BattleLogEntry[] = [
      makeLogEntry({ type: "move", message: "Used move" }),
      makeLogEntry({ type: "info", message: "Some info" }), // filtered out
      makeLogEntry({ type: "faint", message: "Pokemon fainted" }),
      makeLogEntry({ type: "turn", message: "Turn 2" }), // filtered out
    ]
    const state = makeState()
    const result = buildTurnCommentaryContext(state, entries, "T1", "T2")
    expect(result.turnContext).toContain("Used move")
    expect(result.turnContext).toContain("Pokemon fainted")
    expect(result.turnContext).not.toContain("Some info")
  })
})

// ---------------------------------------------------------------------------
// Tests: buildPostBattleContext
// ---------------------------------------------------------------------------

describe("buildPostBattleContext", () => {
  it("includes winner name for p1", () => {
    const result = buildPostBattleContext([], "Team A", "Team B", "p1", 10)
    expect(result).toContain("Winner: Team A")
  })

  it("includes winner name for p2", () => {
    const result = buildPostBattleContext([], "Team A", "Team B", "p2", 10)
    expect(result).toContain("Winner: Team B")
  })

  it("includes 'tie' when no winner", () => {
    const result = buildPostBattleContext([], "Team A", "Team B", null, 10)
    expect(result).toContain("Winner: tie")
  })

  it("includes total turns", () => {
    const result = buildPostBattleContext([], "Team A", "Team B", "p1", 15)
    expect(result).toContain("15-turn battle")
  })

  it("includes team names", () => {
    const result = buildPostBattleContext([], "Stall Squad", "Hyper Offense", "p1", 5)
    expect(result).toContain("Stall Squad")
    expect(result).toContain("Hyper Offense")
  })

  it("counts total KOs from faint entries", () => {
    const entries: BattleLogEntry[] = [
      makeLogEntry({ type: "faint", message: "Garchomp fainted" }),
      makeLogEntry({ type: "move", message: "Used a move" }),
      makeLogEntry({ type: "faint", message: "Iron Valiant fainted" }),
    ]
    const result = buildPostBattleContext(entries, "A", "B", "p1", 5)
    expect(result).toContain("Total KOs: 2")
  })

  it("includes key moments (faints, crits, supereffective, tera)", () => {
    const entries: BattleLogEntry[] = [
      makeLogEntry({
        type: "supereffective",
        message: "It's super effective!",
        turn: 2,
      }),
      makeLogEntry({
        type: "crit",
        message: "Critical hit!",
        turn: 3,
      }),
      makeLogEntry({
        type: "tera",
        message: "Garchomp terastallized to Fire!",
        turn: 4,
      }),
      makeLogEntry({
        type: "faint",
        message: "Iron Valiant fainted",
        turn: 5,
      }),
      makeLogEntry({
        type: "move",
        message: "Normal move",
        turn: 1,
      }),
    ]
    const result = buildPostBattleContext(entries, "A", "B", "p1", 5)
    expect(result).toContain("Turn 2: It's super effective!")
    expect(result).toContain("Turn 3: Critical hit!")
    expect(result).toContain("Turn 4: Garchomp terastallized to Fire!")
    expect(result).toContain("Turn 5: Iron Valiant fainted")
    // "Normal move" is type "move", not a key moment
    expect(result).not.toContain("Normal move")
  })
})

// ---------------------------------------------------------------------------
// Tests: buildTurnAnalysisContext
// ---------------------------------------------------------------------------

describe("buildTurnAnalysisContext", () => {
  it("includes battle state description", () => {
    const state = makeState()
    const result = buildTurnAnalysisContext(state, [])
    expect(result).toContain("Player")
    expect(result).toContain("Opponent")
    expect(result).toContain("Garchomp")
  })

  it("includes turn events", () => {
    const state = makeState()
    const entries = [makeLogEntry({ type: "move", message: "Garchomp used Earthquake!" })]
    const result = buildTurnAnalysisContext(state, entries)
    expect(result).toContain("Garchomp used Earthquake!")
  })

  it("includes previous turn events when provided", () => {
    const state = makeState()
    const turnEntries = [makeLogEntry({ type: "move", message: "This turn move" })]
    const prevEntries = [makeLogEntry({ type: "move", message: "Previous turn move" })]
    const result = buildTurnAnalysisContext(state, turnEntries, prevEntries)
    expect(result).toContain("Previous Turn")
    expect(result).toContain("Previous turn move")
  })

  it("does not include previous turn section when not provided", () => {
    const state = makeState()
    const result = buildTurnAnalysisContext(state, [])
    expect(result).not.toContain("Previous Turn")
  })

  it("includes field effects in analysis", () => {
    const state = makeState({
      field: makeField({ weather: "Rain", weatherTurns: 2, terrain: "Grassy", terrainTurns: 1 }),
    })
    const result = buildTurnAnalysisContext(state, [])
    expect(result).toContain("Weather: Rain (2 turns)")
    expect(result).toContain("Terrain: Grassy (1 turns)")
  })

  it("asks for analysis of decisions", () => {
    const state = makeState()
    const result = buildTurnAnalysisContext(state, [])
    expect(result).toContain("detailed analysis")
    expect(result).toContain("optimal")
    expect(result).toContain("alternatives")
  })
})
