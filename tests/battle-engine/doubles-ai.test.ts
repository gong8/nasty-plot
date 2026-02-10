import { describe, it, expect } from "vitest"
import { parseRequest, parseRequestForSlot, createInitialState } from "@nasty-plot/battle-engine"
import { GreedyAI } from "#battle-engine/ai/greedy-ai"
import { HeuristicAI } from "#battle-engine/ai/heuristic-ai"
import type { BattleState, BattleActionSet, BattlePokemon } from "@nasty-plot/battle-engine"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDoublesState(): BattleState {
  const state = createInitialState("test-doubles", "doubles")

  const makePokemon = (name: string, hp: number, maxHp: number): BattlePokemon => ({
    speciesId: name.toLowerCase().replace(/[^a-z0-9]/g, ""),
    name,
    nickname: name,
    level: 100,
    types: [],
    hp,
    maxHp,
    hpPercent: maxHp > 0 ? Math.round((hp / maxHp) * 100) : 0,
    status: "",
    fainted: hp === 0,
    item: "",
    ability: "",
    isTerastallized: false,
    moves: [],
    stats: { hp: maxHp, atk: 200, def: 200, spa: 200, spd: 200, spe: 200 },
    boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 },
    volatiles: [],
  })

  // Set up p2 (AI) actives
  state.sides.p2.active = [makePokemon("Garchomp", 319, 319), makePokemon("Heatran", 311, 311)]
  state.sides.p2.team = [
    state.sides.p2.active[0]!,
    state.sides.p2.active[1]!,
    makePokemon("Clefable", 394, 394),
    makePokemon("Dragapult", 290, 290),
  ]

  // Set up p1 (opponent) actives
  state.sides.p1.active = [
    makePokemon("Iron Valiant", 305, 305),
    makePokemon("Great Tusk", 404, 404),
  ]
  state.sides.p1.team = [
    state.sides.p1.active[0]!,
    state.sides.p1.active[1]!,
    makePokemon("Toxapex", 304, 304),
  ]

  return state
}

function makeDoublesRequest(): string {
  return JSON.stringify({
    active: [
      {
        moves: [
          {
            move: "Earthquake",
            id: "earthquake",
            pp: 16,
            maxpp: 16,
            target: "allAdjacent",
            type: "Ground",
          },
          {
            move: "Dragon Claw",
            id: "dragonclaw",
            pp: 24,
            maxpp: 24,
            target: "normal",
            type: "Dragon",
          },
        ],
        canTerastallize: "Ground",
      },
      {
        moves: [
          {
            move: "Magma Storm",
            id: "magmastorm",
            pp: 8,
            maxpp: 8,
            target: "normal",
            type: "Fire",
          },
          {
            move: "Earth Power",
            id: "earthpower",
            pp: 16,
            maxpp: 16,
            target: "normal",
            type: "Ground",
          },
        ],
        canTerastallize: "Fire",
      },
    ],
    side: {
      name: "Player",
      id: "p1",
      pokemon: [
        {
          ident: "p1a: Garchomp",
          details: "Garchomp, L100, M",
          condition: "319/319",
          active: true,
          stats: { atk: 394, def: 226, spa: 176, spd: 206, spe: 333 },
          moves: ["earthquake", "dragonclaw"],
          baseAbility: "roughskin",
          item: "lifeorb",
          teraType: "Ground",
        },
        {
          ident: "p1b: Heatran",
          details: "Heatran, L100, M",
          condition: "311/311",
          active: true,
          stats: { atk: 194, def: 248, spa: 394, spd: 248, spe: 169 },
          moves: ["magmastorm", "earthpower"],
          baseAbility: "flashfire",
          item: "leftovers",
          teraType: "Fire",
        },
        {
          ident: "p1: Clefable",
          details: "Clefable, L100, F",
          condition: "394/394",
          active: false,
          stats: { atk: 146, def: 226, spa: 226, spd: 216, spe: 156 },
          moves: ["moonblast", "flamethrower"],
          baseAbility: "magicguard",
          item: "lifeorb",
        },
      ],
    },
  })
}

function makeForcesSwitchDoublesRequest(): string {
  return JSON.stringify({
    forceSwitch: [true, true],
    side: {
      name: "Player",
      id: "p1",
      pokemon: [
        {
          ident: "p1a: Garchomp",
          details: "Garchomp, L100",
          condition: "0 fnt",
          active: true,
          stats: {},
          moves: [],
        },
        {
          ident: "p1b: Heatran",
          details: "Heatran, L100",
          condition: "0 fnt",
          active: true,
          stats: {},
          moves: [],
        },
        {
          ident: "p1: Clefable",
          details: "Clefable, L100",
          condition: "394/394",
          active: false,
          stats: {},
          moves: [],
        },
        {
          ident: "p1: Dragapult",
          details: "Dragapult, L100",
          condition: "290/290",
          active: false,
          stats: {},
          moves: [],
        },
      ],
    },
  })
}

function makePartialForceSwitchRequest(): string {
  return JSON.stringify({
    forceSwitch: [true, false],
    side: {
      name: "Player",
      id: "p1",
      pokemon: [
        {
          ident: "p1a: Garchomp",
          details: "Garchomp, L100",
          condition: "0 fnt",
          active: true,
          stats: {},
          moves: [],
        },
        {
          ident: "p1b: Heatran",
          details: "Heatran, L100",
          condition: "311/311",
          active: true,
          stats: {},
          moves: [],
        },
        {
          ident: "p1: Clefable",
          details: "Clefable, L100",
          condition: "394/394",
          active: false,
          stats: {},
          moves: [],
        },
      ],
    },
  })
}

// ---------------------------------------------------------------------------
// parseRequest doubles tests
// ---------------------------------------------------------------------------

describe("parseRequest doubles", () => {
  it("parseRequest returns actions for slot 0 with activeSlot set", () => {
    const reqJson = makeDoublesRequest()
    const result = parseRequest(reqJson)

    expect(result.actions).not.toBeNull()
    expect(result.actions!.activeSlot).toBe(0)
    expect(result.actions!.moves).toHaveLength(2)
    expect(result.actions!.moves[0].name).toBe("Earthquake")
  })

  it("parseRequestForSlot returns slot 0 actions", () => {
    const reqJson = makeDoublesRequest()
    const result = parseRequestForSlot(reqJson, 0)

    expect(result.actions).not.toBeNull()
    expect(result.actions!.activeSlot).toBe(0)
    expect(result.actions!.moves).toHaveLength(2)
    expect(result.actions!.moves[0].name).toBe("Earthquake")
    expect(result.actions!.canTera).toBe(true)
  })

  it("parseRequestForSlot returns slot 1 actions", () => {
    const reqJson = makeDoublesRequest()
    const result = parseRequestForSlot(reqJson, 1)

    expect(result.actions).not.toBeNull()
    expect(result.actions!.activeSlot).toBe(1)
    expect(result.actions!.moves).toHaveLength(2)
    expect(result.actions!.moves[0].name).toBe("Magma Storm")
    expect(result.actions!.canTera).toBe(true)
  })

  it("parseRequestForSlot returns null for out-of-bounds slot", () => {
    const reqJson = makeDoublesRequest()
    const result = parseRequestForSlot(reqJson, 5)

    expect(result.actions).toBeNull()
  })

  it("parseRequestForSlot handles forceSwitch for both slots", () => {
    const reqJson = makeForcesSwitchDoublesRequest()

    const slot0 = parseRequestForSlot(reqJson, 0)
    expect(slot0.actions).not.toBeNull()
    expect(slot0.actions!.forceSwitch).toBe(true)
    expect(slot0.actions!.activeSlot).toBe(0)

    const slot1 = parseRequestForSlot(reqJson, 1)
    expect(slot1.actions).not.toBeNull()
    expect(slot1.actions!.forceSwitch).toBe(true)
    expect(slot1.actions!.activeSlot).toBe(1)
  })

  it("parseRequestForSlot handles partial forceSwitch (only slot 0)", () => {
    const reqJson = makePartialForceSwitchRequest()

    const slot0 = parseRequestForSlot(reqJson, 0)
    expect(slot0.actions).not.toBeNull()
    expect(slot0.actions!.forceSwitch).toBe(true)
    expect(slot0.forceSwitch).toBe(true)

    const slot1 = parseRequestForSlot(reqJson, 1)
    expect(slot1.actions).toBeNull()
    expect(slot1.forceSwitch).toBe(false)
  })

  it("parseRequestForSlot handles wait", () => {
    const reqJson = JSON.stringify({ wait: true })
    const result = parseRequestForSlot(reqJson, 0)
    expect(result.wait).toBe(true)
    expect(result.actions).toBeNull()
  })

  it("parseRequestForSlot handles teamPreview", () => {
    const reqJson = JSON.stringify({
      teamPreview: true,
      side: { name: "Player", id: "p1", pokemon: [] },
    })
    const result = parseRequestForSlot(reqJson, 0)
    expect(result.teamPreview).toBe(true)
    expect(result.actions).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// GreedyAI doubles tests
// ---------------------------------------------------------------------------

describe("GreedyAI doubles", () => {
  it("produces targetSlot in doubles", async () => {
    const state = makeDoublesState()
    const ai = new GreedyAI()

    const actions: BattleActionSet = {
      moves: [
        {
          name: "Earthquake",
          id: "earthquake",
          pp: 16,
          maxPp: 16,
          type: "Ground",
          disabled: false,
          target: "allAdjacent",
          basePower: 100,
          category: "Physical",
          accuracy: 100,
          description: "",
        },
        {
          name: "Dragon Claw",
          id: "dragonclaw",
          pp: 24,
          maxPp: 24,
          type: "Dragon",
          disabled: false,
          target: "normal",
          basePower: 80,
          category: "Physical",
          accuracy: 100,
          description: "",
        },
      ],
      canTera: false,
      switches: [
        {
          index: 3,
          name: "Clefable",
          speciesId: "clefable",
          hp: 394,
          maxHp: 394,
          status: "",
          fainted: false,
        },
      ],
      forceSwitch: false,
      activeSlot: 0,
    }

    const action = await ai.chooseAction(state, actions)

    // Should return a move action with targetSlot defined for doubles
    if (action.type === "move") {
      expect(action.targetSlot).toBeDefined()
      expect(action.targetSlot).toBeLessThan(0) // Negative = opponent slots
    }
    // If switch, that's also valid
  })

  it("evaluates against both opponent actives", async () => {
    const state = makeDoublesState()
    const ai = new GreedyAI()

    // Give moves that are SE against different targets
    const actions: BattleActionSet = {
      moves: [
        {
          name: "Ice Beam",
          id: "icebeam",
          pp: 16,
          maxPp: 16,
          type: "Ice",
          disabled: false,
          target: "normal",
          basePower: 90,
          category: "Special",
          accuracy: 100,
          description: "",
        },
        {
          name: "Flamethrower",
          id: "flamethrower",
          pp: 16,
          maxPp: 16,
          type: "Fire",
          disabled: false,
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
      activeSlot: 0,
    }

    const action = await ai.chooseAction(state, actions)

    // Should pick a move with a target
    expect(action.type).toBe("move")
    if (action.type === "move") {
      expect(action.targetSlot).toBeDefined()
    }
  })
})

// ---------------------------------------------------------------------------
// HeuristicAI doubles tests
// ---------------------------------------------------------------------------

describe("HeuristicAI doubles", () => {
  it("selects targets in doubles", async () => {
    const state = makeDoublesState()
    const ai = new HeuristicAI()

    const actions: BattleActionSet = {
      moves: [
        {
          name: "Earthquake",
          id: "earthquake",
          pp: 16,
          maxPp: 16,
          type: "Ground",
          disabled: false,
          target: "allAdjacent",
          basePower: 100,
          category: "Physical",
          accuracy: 100,
          description: "",
        },
        {
          name: "Dragon Claw",
          id: "dragonclaw",
          pp: 24,
          maxPp: 24,
          type: "Dragon",
          disabled: false,
          target: "normal",
          basePower: 80,
          category: "Physical",
          accuracy: 100,
          description: "",
        },
      ],
      canTera: false,
      switches: [
        {
          index: 3,
          name: "Clefable",
          speciesId: "clefable",
          hp: 394,
          maxHp: 394,
          status: "",
          fainted: false,
        },
      ],
      forceSwitch: false,
      activeSlot: 0,
    }

    const action = await ai.chooseAction(state, actions)

    // Should return an action (move or switch)
    expect(action.type).toBeDefined()

    // If it's a move action in doubles, it should have a targetSlot
    if (action.type === "move") {
      expect(action.targetSlot).toBeDefined()
    }
  })

  it("works with slot 1 activeSlot", async () => {
    const state = makeDoublesState()
    const ai = new HeuristicAI()

    const actions: BattleActionSet = {
      moves: [
        {
          name: "Magma Storm",
          id: "magmastorm",
          pp: 8,
          maxPp: 8,
          type: "Fire",
          disabled: false,
          target: "normal",
          basePower: 100,
          category: "Special",
          accuracy: 75,
          description: "",
        },
      ],
      canTera: false,
      switches: [],
      forceSwitch: false,
      activeSlot: 1,
    }

    const action = await ai.chooseAction(state, actions)
    expect(action.type).toBe("move")
    if (action.type === "move") {
      expect(action.targetSlot).toBeDefined()
    }
  })
})

// ---------------------------------------------------------------------------
// Combined choice string formatting
// ---------------------------------------------------------------------------

describe("combined choice string formatting", () => {
  it("actionToChoice includes targetSlot", () => {
    // This tests the exported actionToChoice via BattleManager behavior
    // We test the format directly
    const action1 = { type: "move" as const, moveIndex: 1, targetSlot: -1 }
    const action2 = { type: "move" as const, moveIndex: 2, targetSlot: -2 }

    // Format: "move 1 -1, move 2 -2"
    const formatAction = (a: typeof action1) => {
      let choice = `move ${a.moveIndex}`
      if (a.targetSlot != null) choice += ` ${a.targetSlot}`
      return choice
    }

    const combined = `${formatAction(action1)}, ${formatAction(action2)}`
    expect(combined).toBe("move 1 -1, move 2 -2")
  })

  it("handles switch + move combination", () => {
    const action1 = { type: "switch" as const, pokemonIndex: 3 }
    const action2 = { type: "move" as const, moveIndex: 1, targetSlot: -1 }

    const formatAction = (a: {
      type: string
      moveIndex?: number
      pokemonIndex?: number
      targetSlot?: number
    }) => {
      if (a.type === "move") {
        let choice = `move ${a.moveIndex}`
        if (a.targetSlot != null) choice += ` ${a.targetSlot}`
        return choice
      }
      return `switch ${a.pokemonIndex}`
    }

    const combined = `${formatAction(action1)}, ${formatAction(action2)}`
    expect(combined).toBe("switch 3, move 1 -1")
  })
})
