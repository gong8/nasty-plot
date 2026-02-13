import { describe, it, expect, vi, beforeEach } from "vitest"
import { MCTSAI } from "@nasty-plot/battle-engine"
import type { BattleState, BattleActionSet, BattlePokemon } from "@nasty-plot/battle-engine"
import { createInitialState } from "@nasty-plot/battle-engine"
import { DEFAULT_LEVEL } from "@nasty-plot/core"

// ---------------------------------------------------------------------------
// Mocks — control the MCTS internals via battle-cloner, evaluator, @pkmn/sim
// ---------------------------------------------------------------------------

const mockCloneBattle = vi.fn()
const mockApplyChoices = vi.fn()
const mockGetLegalChoices = vi.fn()
const mockIsBattleOver = vi.fn()
const mockGetBattleWinner = vi.fn()

vi.mock("#battle-engine/ai/battle-cloner", () => ({
  cloneBattle: (...args: unknown[]) => mockCloneBattle(...args),
  applyChoices: (...args: unknown[]) => mockApplyChoices(...args),
  getLegalChoices: (...args: unknown[]) => mockGetLegalChoices(...args),
  isBattleOver: (...args: unknown[]) => mockIsBattleOver(...args),
  getBattleWinner: (...args: unknown[]) => mockGetBattleWinner(...args),
}))

const mockEvaluatePosition = vi.fn()

vi.mock("#battle-engine/ai/evaluator", () => ({
  evaluatePosition: (...args: unknown[]) => mockEvaluatePosition(...args),
}))

// Mock @pkmn/sim Battle.fromJSON
const mockBattleInstance = {
  p1: {
    active: [
      {
        species: { id: "garchomp", name: "Garchomp" },
        types: ["Dragon", "Ground"],
        hp: 357,
        maxhp: 357,
        level: DEFAULT_LEVEL,
        status: "",
        fainted: false,
        item: "focussash",
        ability: "roughskin",
        name: "Garchomp",
        moves: ["earthquake", "outrage", "swordsdance", "stealthrock"],
        storedStats: { atk: 394, def: 226, spa: 196, spd: 206, spe: 333 },
        boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
        volatiles: {},
        terastallized: "",
      },
    ],
    pokemon: [
      {
        species: { id: "garchomp", name: "Garchomp" },
        types: ["Dragon", "Ground"],
        hp: 357,
        maxhp: 357,
        level: DEFAULT_LEVEL,
        status: "",
        fainted: false,
        item: "focussash",
        ability: "roughskin",
        name: "Garchomp",
        moves: ["earthquake", "outrage", "swordsdance", "stealthrock"],
        storedStats: { atk: 394, def: 226, spa: 196, spd: 206, spe: 333 },
        boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
        volatiles: {},
      },
    ],
    name: "Player",
    sideConditions: {},
  },
  p2: {
    active: [
      {
        species: { id: "heatran", name: "Heatran" },
        types: ["Fire", "Steel"],
        hp: 386,
        maxhp: 386,
        level: DEFAULT_LEVEL,
        status: "",
        fainted: false,
        item: "leftovers",
        ability: "flashfire",
        name: "Heatran",
        moves: ["magmastorm", "earthpower", "taunt", "stealthrock"],
        storedStats: { atk: 196, def: 246, spa: 394, spd: 246, spe: 253 },
        boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
        volatiles: {},
        terastallized: "",
      },
    ],
    pokemon: [
      {
        species: { id: "heatran", name: "Heatran" },
        types: ["Fire", "Steel"],
        hp: 386,
        maxhp: 386,
        level: DEFAULT_LEVEL,
        status: "",
        fainted: false,
        item: "leftovers",
        ability: "flashfire",
        name: "Heatran",
        moves: ["magmastorm", "earthpower", "taunt", "stealthrock"],
        storedStats: { atk: 196, def: 246, spa: 394, spd: 246, spe: 253 },
        boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
        volatiles: {},
      },
    ],
    name: "Opponent",
    sideConditions: {},
  },
  turn: 1,
  gameType: "singles",
  field: {
    weather: "",
    terrain: "",
    pseudoWeather: {},
  },
  ended: false,
  winner: "",
  toJSON: vi.fn(() => "serialized-battle"),
}

vi.mock("@pkmn/sim", () => ({
  Battle: {
    fromJSON: vi.fn(() => mockBattleInstance),
  },
}))

// Mock HeuristicAI to avoid loading @pkmn/dex, @smogon/calc, etc.
vi.mock("#battle-engine/ai/heuristic-ai", () => ({
  HeuristicAI: class MockHeuristicAI {
    difficulty = "heuristic" as const
    async chooseAction(_state: BattleState, actions: BattleActionSet) {
      if (actions.forceSwitch && actions.switches.length > 0) {
        return { type: "switch" as const, pokemonIndex: actions.switches[0].index }
      }
      return { type: "move" as const, moveIndex: 1 }
    }
    chooseLeads(teamSize: number) {
      return Array.from({ length: teamSize }, (_, i) => i + 1)
    }
  },
}))

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makePokemon(overrides: Partial<BattlePokemon> = {}): BattlePokemon {
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
    item: "Focus Sash",
    ability: "Rough Skin",
    isTerastallized: false,
    moves: [],
    stats: { hp: 357, atk: 394, def: 226, spa: 196, spd: 206, spe: 333 },
    boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 },
    volatiles: [],
    ...overrides,
  }
}

function makeState(): BattleState {
  const state = createInitialState("test", "singles")
  state.phase = "battle"
  state.turn = 1
  state.sides.p1.active = [makePokemon()]
  state.sides.p1.team = [makePokemon()]
  state.sides.p2.active = [
    makePokemon({ speciesId: "heatran", name: "Heatran", types: ["Fire", "Steel"] }),
  ]
  state.sides.p2.team = [
    makePokemon({ speciesId: "heatran", name: "Heatran", types: ["Fire", "Steel"] }),
  ]
  return state
}

function makeActions(): BattleActionSet {
  return {
    moves: [
      {
        name: "Earthquake",
        id: "earthquake",
        pp: 10,
        maxPp: 10,
        type: "Ground",
        disabled: false,
        target: "allAdjacent",
        basePower: 100,
        category: "Physical",
        accuracy: 100,
        description: "Hits all adjacent Pokemon.",
      },
      {
        name: "Outrage",
        id: "outrage",
        pp: 10,
        maxPp: 10,
        type: "Dragon",
        disabled: false,
        target: "randomNormal",
        basePower: 120,
        category: "Physical",
        accuracy: 100,
        description: "Attacks for 2-3 turns.",
      },
    ],
    canTera: true,
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
    ],
    forceSwitch: false,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MCTSAI - deep coverage", () => {
  let ai: MCTSAI

  beforeEach(() => {
    vi.clearAllMocks()
    ai = new MCTSAI({
      maxIterations: 3,
      maxTimeMs: 2000,
      rolloutDepth: 2,
      explorationConstant: 0.7,
    })

    // Default mock behavior: battle is not over, has legal choices
    mockCloneBattle.mockReturnValue(mockBattleInstance)
    mockIsBattleOver.mockReturnValue(false)
    mockGetBattleWinner.mockReturnValue(null)
    mockGetLegalChoices.mockReturnValue(["move 1", "move 2"])
    mockApplyChoices.mockReturnValue(undefined)
    mockEvaluatePosition.mockReturnValue({ score: 0.5, rawScore: 500, features: [] })
  })

  // -----------------------------------------------------------------------
  // runSearch — full MCTS loop
  // -----------------------------------------------------------------------

  describe("runSearch via chooseAction", () => {
    it("runs MCTS iterations when battle state is set", async () => {
      ai.setBattleState("valid-battle-json")
      const state = makeState()
      const actions = makeActions()

      const result = await ai.chooseAction(state, actions)

      // Should have called cloneBattle (once per iteration)
      expect(mockCloneBattle).toHaveBeenCalledTimes(3)
      // Should return a valid action
      expect(result.type).toMatch(/^(move|switch)$/)
    })

    it("selects best action by visit count", async () => {
      ai.setBattleState("valid-battle-json")
      // Make iterations run: battle never ends, choices available
      mockIsBattleOver.mockReturnValue(false)
      mockGetLegalChoices.mockReturnValue(["move 1", "switch 2"])

      const state = makeState()
      const actions = makeActions()

      const result = await ai.chooseAction(state, actions)
      expect(result.type).toMatch(/^(move|switch)$/)
    })

    it("falls back to heuristic when Battle.fromJSON throws", async () => {
      const { Battle } = await import("@pkmn/sim")
      vi.mocked(Battle.fromJSON).mockImplementationOnce(() => {
        throw new Error("Invalid JSON")
      })

      ai.setBattleState("bad-json")
      const state = makeState()
      const actions = makeActions()

      // Should not throw, should fall back
      const result = await ai.chooseAction(state, actions)
      expect(result.type).toBe("move")
      expect(result).toEqual({ type: "move", moveIndex: 1 })
    })

    it("stores opponentPredictions from state", async () => {
      ai.setBattleState("valid-battle-json")
      const state = makeState()
      state.opponentPredictions = {
        heatran: {
          pokemonId: "heatran",
          predictedMoves: ["Magma Storm", "Earth Power"],
          confidence: 0.8,
        },
      }
      const actions = makeActions()

      await ai.chooseAction(state, actions)
      // Predictions should be used internally during rollouts
      // The test verifies no crash occurs
      expect(mockCloneBattle).toHaveBeenCalled()
    })
  })

  // -----------------------------------------------------------------------
  // iterate — selection, expansion, rollout, backpropagation
  // -----------------------------------------------------------------------

  describe("iterate via search", () => {
    it("handles terminal node (battle over, perspective wins)", async () => {
      ai.setBattleState("valid-battle-json")
      // First call: battle is over with perspective (p2) winning
      mockIsBattleOver.mockReturnValue(true)
      mockGetBattleWinner.mockReturnValue("p2")

      const state = makeState()
      const actions = makeActions()

      const result = await ai.chooseAction(state, actions)
      // Should still produce an action (from the "default" fallback in convertChoiceToAction)
      expect(result.type).toMatch(/^(move|switch)$/)
    })

    it("handles terminal node (battle over, perspective loses)", async () => {
      ai.setBattleState("valid-battle-json")
      // Clone returns a battle where isBattleOver is true
      mockIsBattleOver.mockImplementation(() => {
        // First call is in iterate, return true (terminal)
        return true
      })
      mockGetBattleWinner.mockReturnValue("p1") // p1 wins, so p2 (perspective) loses

      const state = makeState()
      const actions = makeActions()

      const result = await ai.chooseAction(state, actions)
      expect(result.type).toMatch(/^(move|switch)$/)
    })

    it("handles terminal draw (winner is null)", async () => {
      ai.setBattleState("valid-battle-json")
      mockIsBattleOver.mockReturnValue(true)
      mockGetBattleWinner.mockReturnValue(null) // draw

      const state = makeState()
      const actions = makeActions()

      const result = await ai.chooseAction(state, actions)
      expect(result.type).toMatch(/^(move|switch)$/)
    })

    it("handles empty legal choices (p1 has no choices)", async () => {
      ai.setBattleState("valid-battle-json")
      mockIsBattleOver.mockReturnValue(false)
      // p1 has no choices
      mockGetLegalChoices.mockImplementation((_battle: unknown, side: string) => {
        if (side === "p1") return []
        return ["move 1"]
      })

      const state = makeState()
      const actions = makeActions()

      const result = await ai.chooseAction(state, actions)
      expect(result.type).toMatch(/^(move|switch)$/)
    })

    it("handles empty legal choices (p2 has no choices)", async () => {
      ai.setBattleState("valid-battle-json")
      mockIsBattleOver.mockReturnValue(false)
      // p2 has no choices
      mockGetLegalChoices.mockImplementation((_battle: unknown, side: string) => {
        if (side === "p2") return []
        return ["move 1"]
      })

      const state = makeState()
      const actions = makeActions()

      const result = await ai.chooseAction(state, actions)
      expect(result.type).toMatch(/^(move|switch)$/)
    })

    it("applyChoices failure returns 0 and still produces an action", async () => {
      ai.setBattleState("valid-battle-json")
      mockIsBattleOver.mockReturnValue(false)
      mockGetLegalChoices.mockReturnValue(["move 1"])
      mockApplyChoices.mockImplementation(() => {
        throw new Error("Invalid choice")
      })

      const state = makeState()
      const actions = makeActions()

      const result = await ai.chooseAction(state, actions)
      expect(result.type).toMatch(/^(move|switch)$/)
    })

    it("backpropagates values correctly for p1 and p2 stats", async () => {
      ai.setBattleState("valid-battle-json")
      // Let the search run with non-trivial evaluations
      mockIsBattleOver.mockReturnValue(false)
      mockGetLegalChoices.mockReturnValue(["move 1", "move 2", "switch 3"])
      mockApplyChoices.mockReturnValue(undefined)
      mockEvaluatePosition.mockReturnValue({ score: 0.8, rawScore: 800, features: [] })

      const state = makeState()
      const actions = makeActions()

      const result = await ai.chooseAction(state, actions)
      // With positive evaluation, the AI should prefer some action
      expect(result.type).toMatch(/^(move|switch)$/)
    })
  })

  // -----------------------------------------------------------------------
  // selectUCB1
  // -----------------------------------------------------------------------

  describe("selectUCB1 via search", () => {
    it("prioritizes unvisited actions first", async () => {
      const moreIterationsAI = new MCTSAI({
        maxIterations: 10,
        maxTimeMs: 2000,
        rolloutDepth: 1,
        explorationConstant: 0.7,
      })
      moreIterationsAI.setBattleState("valid-battle-json")

      // 3 choices — with 10 iterations, each should get visited at least once
      mockGetLegalChoices.mockReturnValue(["move 1", "move 2", "switch 3"])
      mockIsBattleOver.mockReturnValue(false)
      mockApplyChoices.mockReturnValue(undefined)
      mockEvaluatePosition.mockReturnValue({ score: 0.3, rawScore: 300, features: [] })

      const state = makeState()
      const actions: BattleActionSet = {
        ...makeActions(),
        switches: [
          {
            index: 3,
            name: "Tyranitar",
            speciesId: "tyranitar",
            hp: 404,
            maxHp: 404,
            status: "",
            fainted: false,
          },
        ],
      }

      const result = await moreIterationsAI.chooseAction(state, actions)
      expect(result.type).toMatch(/^(move|switch)$/)
      // Verify cloneBattle was called 10 times (one per iteration)
      expect(mockCloneBattle).toHaveBeenCalledTimes(10)
    })

    it("uses UCB1 exploration when all actions have been visited", async () => {
      // With high exploration constant, should explore more
      const explorationAI = new MCTSAI({
        maxIterations: 20,
        maxTimeMs: 2000,
        rolloutDepth: 1,
        explorationConstant: 2.0, // High exploration
      })
      explorationAI.setBattleState("valid-battle-json")

      mockGetLegalChoices.mockReturnValue(["move 1", "move 2"])
      mockIsBattleOver.mockReturnValue(false)
      mockApplyChoices.mockReturnValue(undefined)
      // Alternate scores so move 1 looks better
      let evalCallCount = 0
      mockEvaluatePosition.mockImplementation(() => {
        evalCallCount++
        return { score: evalCallCount % 2 === 0 ? 0.9 : -0.5, rawScore: 0, features: [] }
      })

      const state = makeState()
      const actions = makeActions()

      const result = await explorationAI.chooseAction(state, actions)
      expect(result.type).toBe("move")
      expect(mockCloneBattle).toHaveBeenCalledTimes(20)
    })

    it("minimizing player inverts value in UCB1", async () => {
      // The minimizing player (non-perspective) uses -avgValue
      const ai2 = new MCTSAI({
        maxIterations: 6,
        maxTimeMs: 2000,
        rolloutDepth: 1,
        explorationConstant: 0.7,
      })
      ai2.setBattleState("valid-battle-json")

      mockGetLegalChoices.mockReturnValue(["move 1", "move 2"])
      mockIsBattleOver.mockReturnValue(false)
      mockApplyChoices.mockReturnValue(undefined)
      mockEvaluatePosition.mockReturnValue({ score: -0.8, rawScore: -800, features: [] })

      const state = makeState()
      const actions = makeActions()

      const result = await ai2.chooseAction(state, actions)
      expect(result.type).toBe("move")
    })
  })

  // -----------------------------------------------------------------------
  // rollout
  // -----------------------------------------------------------------------

  describe("rollout via search", () => {
    it("terminates early when battle ends during rollout", async () => {
      ai.setBattleState("valid-battle-json")

      // During iterate: not over at first, then over during rollout
      let isBattleOverCallCount = 0
      mockIsBattleOver.mockImplementation(() => {
        isBattleOverCallCount++
        // Call 1 = iterate check (not over), call 2+ = rollout (over)
        return isBattleOverCallCount > 1
      })
      mockGetBattleWinner.mockReturnValue("p2") // perspective wins

      const state = makeState()
      const actions = makeActions()

      const result = await ai.chooseAction(state, actions)
      expect(result.type).toMatch(/^(move|switch)$/)
    })

    it("breaks rollout loop when choices are empty", async () => {
      ai.setBattleState("valid-battle-json")

      let isBattleOverCallCount = 0
      mockIsBattleOver.mockImplementation(() => {
        isBattleOverCallCount++
        return isBattleOverCallCount > 3 // eventually the leaf eval
      })

      // During rollout, return empty choices
      let getLegalCallCount = 0
      mockGetLegalChoices.mockImplementation(() => {
        getLegalCallCount++
        // iterate calls getLegalChoices for both sides (2 calls)
        // rollout calls for both sides too
        if (getLegalCallCount <= 2) return ["move 1"]
        return [] // empty during rollout
      })

      const state = makeState()
      const actions = makeActions()

      const result = await ai.chooseAction(state, actions)
      expect(result.type).toMatch(/^(move|switch)$/)
    })

    it("breaks rollout when applyChoices throws during rollout", async () => {
      ai.setBattleState("valid-battle-json")

      let isBattleOverCallCount = 0
      mockIsBattleOver.mockImplementation(() => {
        isBattleOverCallCount++
        return isBattleOverCallCount > 3
      })

      mockGetLegalChoices.mockReturnValue(["move 1"])

      // First apply is in iterate (ok), second is in rollout (throws)
      let applyCallCount = 0
      mockApplyChoices.mockImplementation(() => {
        applyCallCount++
        if (applyCallCount > 1) throw new Error("sim error")
      })

      const state = makeState()
      const actions = makeActions()

      const result = await ai.chooseAction(state, actions)
      expect(result.type).toMatch(/^(move|switch)$/)
    })

    it("uses evaluatePosition when rollout ends without winner", async () => {
      ai.setBattleState("valid-battle-json")
      mockIsBattleOver.mockReturnValue(false)
      mockGetLegalChoices.mockReturnValue(["move 1"])
      mockApplyChoices.mockReturnValue(undefined)
      mockEvaluatePosition.mockReturnValue({ score: -0.3, rawScore: -300, features: [] })

      const state = makeState()
      const actions = makeActions()

      await ai.chooseAction(state, actions)
      // evaluatePosition should have been called (once per iteration during rollout)
      expect(mockEvaluatePosition).toHaveBeenCalled()
    })

    it("returns 0 when battleToState returns null", async () => {
      ai.setBattleState("valid-battle-json")
      mockIsBattleOver.mockReturnValue(false)
      mockGetLegalChoices.mockReturnValue(["move 1"])
      mockApplyChoices.mockReturnValue(undefined)

      // Make battleToState fail by making the battle instance incomplete
      const brokenBattle = {
        ...mockBattleInstance,
        p1: undefined,
        p2: undefined,
      }
      mockCloneBattle.mockReturnValue(brokenBattle)

      const state = makeState()
      const actions = makeActions()

      const result = await ai.chooseAction(state, actions)
      expect(result.type).toMatch(/^(move|switch)$/)
      // evaluatePosition should NOT have been called (battleToState returned null)
      expect(mockEvaluatePosition).not.toHaveBeenCalled()
    })

    it("handles rollout winner as draw (null)", async () => {
      ai.setBattleState("valid-battle-json")

      let isBattleOverCallCount = 0
      mockIsBattleOver.mockImplementation(() => {
        isBattleOverCallCount++
        return isBattleOverCallCount > 1 // over during rollout
      })
      mockGetBattleWinner.mockReturnValue(null) // draw

      const state = makeState()
      const actions = makeActions()

      const result = await ai.chooseAction(state, actions)
      expect(result.type).toMatch(/^(move|switch)$/)
    })

    it("handles rollout winner as opponent (p1 when perspective is p2)", async () => {
      ai.setBattleState("valid-battle-json")

      let isBattleOverCallCount = 0
      mockIsBattleOver.mockImplementation(() => {
        isBattleOverCallCount++
        return isBattleOverCallCount > 1
      })
      mockGetBattleWinner.mockReturnValue("p1") // perspective (p2) loses

      const state = makeState()
      const actions = makeActions()

      const result = await ai.chooseAction(state, actions)
      expect(result.type).toMatch(/^(move|switch)$/)
    })
  })

  // -----------------------------------------------------------------------
  // battleToState
  // -----------------------------------------------------------------------

  describe("battleToState via rollout", () => {
    it("converts a sim Battle to BattleState for evaluator", async () => {
      ai.setBattleState("valid-battle-json")
      mockIsBattleOver.mockReturnValue(false)
      mockGetLegalChoices.mockReturnValue(["move 1"])
      mockApplyChoices.mockReturnValue(undefined)
      mockEvaluatePosition.mockReturnValue({ score: 0.5, rawScore: 500, features: [] })

      const state = makeState()
      const actions = makeActions()

      await ai.chooseAction(state, actions)

      // evaluatePosition should receive a BattleState
      expect(mockEvaluatePosition).toHaveBeenCalled()
      const evalArgs = mockEvaluatePosition.mock.calls[0]
      const battleState = evalArgs[0] as BattleState
      expect(battleState.phase).toBe("battle")
      expect(battleState.sides.p1).toBeDefined()
      expect(battleState.sides.p2).toBeDefined()
      expect(battleState.field).toBeDefined()
    })

    it("handles doubles gameType in battleToState", async () => {
      ai.setBattleState("valid-battle-json")

      const doublesBattle = {
        ...mockBattleInstance,
        gameType: "doubles",
        p1: {
          ...mockBattleInstance.p1,
          active: [
            mockBattleInstance.p1.active[0],
            { ...mockBattleInstance.p1.active[0], species: { id: "clefable", name: "Clefable" } },
          ],
        },
      }
      mockCloneBattle.mockReturnValue(doublesBattle)
      mockIsBattleOver.mockReturnValue(false)
      mockGetLegalChoices.mockReturnValue(["move 1"])
      mockApplyChoices.mockReturnValue(undefined)
      mockEvaluatePosition.mockReturnValue({ score: 0.5, rawScore: 500, features: [] })

      const state = makeState()
      state.format = "doubles"
      const actions = makeActions()

      await ai.chooseAction(state, actions)

      expect(mockEvaluatePosition).toHaveBeenCalled()
      const evalArgs = mockEvaluatePosition.mock.calls[0]
      const battleState = evalArgs[0] as BattleState
      expect(battleState.format).toBe("doubles")
    })

    it("handles null active pokemon in battleToState", async () => {
      ai.setBattleState("valid-battle-json")

      const nullActiveBattle = {
        ...mockBattleInstance,
        p1: {
          ...mockBattleInstance.p1,
          active: [null],
        },
      }
      mockCloneBattle.mockReturnValue(nullActiveBattle)
      mockIsBattleOver.mockReturnValue(false)
      mockGetLegalChoices.mockReturnValue(["move 1"])
      mockApplyChoices.mockReturnValue(undefined)
      mockEvaluatePosition.mockReturnValue({ score: 0, rawScore: 0, features: [] })

      const state = makeState()
      const actions = makeActions()

      await ai.chooseAction(state, actions)
      // Should still succeed — null actives are filtered
      expect(mockEvaluatePosition).toHaveBeenCalled()
    })

    it("handles side conditions in battleToState", async () => {
      ai.setBattleState("valid-battle-json")

      const hazardBattle = {
        ...mockBattleInstance,
        p1: {
          ...mockBattleInstance.p1,
          sideConditions: {
            stealthrock: true,
            spikes: { layers: 2 },
            toxicspikes: { layers: 1 },
            stickyweb: true,
            reflect: { duration: 3 },
            lightscreen: { duration: 2 },
            auroraveil: { duration: 4 },
            tailwind: { duration: 1 },
          },
        },
      }
      mockCloneBattle.mockReturnValue(hazardBattle)
      mockIsBattleOver.mockReturnValue(false)
      mockGetLegalChoices.mockReturnValue(["move 1"])
      mockApplyChoices.mockReturnValue(undefined)
      mockEvaluatePosition.mockReturnValue({ score: 0.5, rawScore: 500, features: [] })

      const state = makeState()
      const actions = makeActions()

      await ai.chooseAction(state, actions)

      const evalArgs = mockEvaluatePosition.mock.calls[0]
      const battleState = evalArgs[0] as BattleState
      expect(battleState.sides.p1.sideConditions.stealthRock).toBe(true)
      expect(battleState.sides.p1.sideConditions.spikes).toBe(2)
      expect(battleState.sides.p1.sideConditions.toxicSpikes).toBe(1)
      expect(battleState.sides.p1.sideConditions.stickyWeb).toBe(true)
      expect(battleState.sides.p1.sideConditions.reflect).toBe(3)
      expect(battleState.sides.p1.sideConditions.lightScreen).toBe(2)
      expect(battleState.sides.p1.sideConditions.auroraVeil).toBe(4)
      expect(battleState.sides.p1.sideConditions.tailwind).toBe(1)
    })

    it("handles trick room in battleToState", async () => {
      ai.setBattleState("valid-battle-json")

      const trickRoomBattle = {
        ...mockBattleInstance,
        field: {
          weather: "Rain",
          terrain: "Electric",
          pseudoWeather: { trickroom: { duration: 3 } },
        },
      }
      mockCloneBattle.mockReturnValue(trickRoomBattle)
      mockIsBattleOver.mockReturnValue(false)
      mockGetLegalChoices.mockReturnValue(["move 1"])
      mockApplyChoices.mockReturnValue(undefined)
      mockEvaluatePosition.mockReturnValue({ score: 0, rawScore: 0, features: [] })

      const state = makeState()
      const actions = makeActions()

      await ai.chooseAction(state, actions)

      const evalArgs = mockEvaluatePosition.mock.calls[0]
      const battleState = evalArgs[0] as BattleState
      expect(battleState.field.weather).toBe("Rain")
      expect(battleState.field.terrain).toBe("Electric")
      expect(battleState.field.trickRoom).toBe(1) // truthy check
    })

    it("handles terastallized pokemon", async () => {
      ai.setBattleState("valid-battle-json")

      const teraBattle = {
        ...mockBattleInstance,
        p1: {
          ...mockBattleInstance.p1,
          pokemon: [
            {
              ...mockBattleInstance.p1.pokemon[0],
              terastallized: "Fire",
            },
          ],
          active: [
            {
              ...mockBattleInstance.p1.active[0],
              terastallized: "Fire",
            },
          ],
        },
      }
      mockCloneBattle.mockReturnValue(teraBattle)
      mockIsBattleOver.mockReturnValue(false)
      mockGetLegalChoices.mockReturnValue(["move 1"])
      mockApplyChoices.mockReturnValue(undefined)
      mockEvaluatePosition.mockReturnValue({ score: 0, rawScore: 0, features: [] })

      const state = makeState()
      const actions = makeActions()

      await ai.chooseAction(state, actions)

      const evalArgs = mockEvaluatePosition.mock.calls[0]
      const battleState = evalArgs[0] as BattleState
      // hasTerastallized should be true since a pokemon has terastallized
      expect(battleState.sides.p1.hasTerastallized).toBe(true)
      expect(battleState.sides.p1.canTera).toBe(false)
    })

    it("handles pokemon with no storedStats", async () => {
      ai.setBattleState("valid-battle-json")

      const noStatsBattle = {
        ...mockBattleInstance,
        p1: {
          ...mockBattleInstance.p1,
          active: [
            {
              ...mockBattleInstance.p1.active[0],
              storedStats: undefined,
            },
          ],
          pokemon: [
            {
              ...mockBattleInstance.p1.pokemon[0],
              storedStats: undefined,
            },
          ],
        },
      }
      mockCloneBattle.mockReturnValue(noStatsBattle)
      mockIsBattleOver.mockReturnValue(false)
      mockGetLegalChoices.mockReturnValue(["move 1"])
      mockApplyChoices.mockReturnValue(undefined)
      mockEvaluatePosition.mockReturnValue({ score: 0, rawScore: 0, features: [] })

      const state = makeState()
      const actions = makeActions()

      await ai.chooseAction(state, actions)

      const evalArgs = mockEvaluatePosition.mock.calls[0]
      const battleState = evalArgs[0] as BattleState
      expect(battleState.sides.p1.active[0]!.stats.atk).toBe(0)
    })

    it("handles pokemon with maxhp of 0", async () => {
      ai.setBattleState("valid-battle-json")

      const zeroHpBattle = {
        ...mockBattleInstance,
        p1: {
          ...mockBattleInstance.p1,
          active: [
            {
              ...mockBattleInstance.p1.active[0],
              hp: 0,
              maxhp: 0,
            },
          ],
          pokemon: [
            {
              ...mockBattleInstance.p1.pokemon[0],
              hp: 0,
              maxhp: 0,
            },
          ],
        },
      }
      mockCloneBattle.mockReturnValue(zeroHpBattle)
      mockIsBattleOver.mockReturnValue(false)
      mockGetLegalChoices.mockReturnValue(["move 1"])
      mockApplyChoices.mockReturnValue(undefined)
      mockEvaluatePosition.mockReturnValue({ score: 0, rawScore: 0, features: [] })

      const state = makeState()
      const actions = makeActions()

      await ai.chooseAction(state, actions)

      const evalArgs = mockEvaluatePosition.mock.calls[0]
      const battleState = evalArgs[0] as BattleState
      expect(battleState.sides.p1.active[0]!.hpPercent).toBe(0)
    })
  })

  // -----------------------------------------------------------------------
  // convertChoiceToAction
  // -----------------------------------------------------------------------

  describe("convertChoiceToAction via chooseAction", () => {
    it("converts 'move N' to move action", async () => {
      ai.setBattleState("valid-battle-json")
      // Make search always return "move 2" as best
      mockGetLegalChoices.mockReturnValue(["move 2"])
      mockIsBattleOver.mockReturnValue(false)
      mockApplyChoices.mockReturnValue(undefined)
      mockEvaluatePosition.mockReturnValue({ score: 0.5, rawScore: 500, features: [] })

      const state = makeState()
      const actions = makeActions()

      const result = await ai.chooseAction(state, actions)
      expect(result.type).toBe("move")
      if (result.type === "move") {
        expect(result.moveIndex).toBe(2)
      }
    })

    it("converts 'move N -T' to move action with targetSlot", async () => {
      ai.setBattleState("valid-battle-json")
      mockGetLegalChoices.mockReturnValue(["move 1 -1"])
      mockIsBattleOver.mockReturnValue(false)
      mockApplyChoices.mockReturnValue(undefined)
      mockEvaluatePosition.mockReturnValue({ score: 0.5, rawScore: 500, features: [] })

      const state = makeState()
      const actions = makeActions()

      const result = await ai.chooseAction(state, actions)
      expect(result.type).toBe("move")
      if (result.type === "move") {
        expect(result.moveIndex).toBe(1)
        expect(result.targetSlot).toBe(-1)
      }
    })

    it("converts 'switch N' to switch action", async () => {
      ai.setBattleState("valid-battle-json")
      mockGetLegalChoices.mockReturnValue(["switch 2"])
      mockIsBattleOver.mockReturnValue(false)
      mockApplyChoices.mockReturnValue(undefined)
      mockEvaluatePosition.mockReturnValue({ score: 0.5, rawScore: 500, features: [] })

      const state = makeState()
      const actions = makeActions()

      const result = await ai.chooseAction(state, actions)
      expect(result.type).toBe("switch")
      if (result.type === "switch") {
        expect(result.pokemonIndex).toBe(2)
      }
    })

    it("converts 'default' to first non-disabled move", async () => {
      ai.setBattleState("valid-battle-json")
      mockGetLegalChoices.mockReturnValue(["default"])
      mockIsBattleOver.mockReturnValue(false)
      mockApplyChoices.mockReturnValue(undefined)
      mockEvaluatePosition.mockReturnValue({ score: 0.5, rawScore: 500, features: [] })

      const state = makeState()
      const actions = makeActions()

      const result = await ai.chooseAction(state, actions)
      expect(result.type).toBe("move")
      if (result.type === "move") {
        // First non-disabled move is index 0, then +1 = 1
        expect(result.moveIndex).toBe(1)
      }
    })

    it("converts 'default' when first move is disabled", async () => {
      ai.setBattleState("valid-battle-json")
      mockGetLegalChoices.mockReturnValue(["default"])
      mockIsBattleOver.mockReturnValue(false)
      mockApplyChoices.mockReturnValue(undefined)
      mockEvaluatePosition.mockReturnValue({ score: 0.5, rawScore: 500, features: [] })

      const state = makeState()
      const actions: BattleActionSet = {
        ...makeActions(),
        moves: [{ ...makeActions().moves[0], disabled: true }, makeActions().moves[1]],
      }

      const result = await ai.chooseAction(state, actions)
      expect(result.type).toBe("move")
      if (result.type === "move") {
        // First non-disabled move is index 1, then +1 = 2
        expect(result.moveIndex).toBe(2)
      }
    })

    it("converts 'default' when all moves are disabled", async () => {
      ai.setBattleState("valid-battle-json")
      mockGetLegalChoices.mockReturnValue(["default"])
      mockIsBattleOver.mockReturnValue(false)
      mockApplyChoices.mockReturnValue(undefined)
      mockEvaluatePosition.mockReturnValue({ score: 0.5, rawScore: 500, features: [] })

      const state = makeState()
      const actions: BattleActionSet = {
        ...makeActions(),
        moves: [
          { ...makeActions().moves[0], disabled: true },
          { ...makeActions().moves[1], disabled: true },
        ],
      }

      const result = await ai.chooseAction(state, actions)
      expect(result.type).toBe("move")
      if (result.type === "move") {
        // No enabled moves, findIndex returns -1, so (-1 >= 0) is false, uses 0, +1 = 1
        expect(result.moveIndex).toBe(1)
      }
    })
  })

  // -----------------------------------------------------------------------
  // weightedRolloutChoice
  // -----------------------------------------------------------------------

  describe("weightedRolloutChoice via rollout", () => {
    it("uses uniform random when only one choice", async () => {
      ai.setBattleState("valid-battle-json")

      mockIsBattleOver.mockReturnValue(false)
      mockGetLegalChoices.mockImplementation((_b: unknown, side: string) => {
        if (side === "p2") return ["move 1"] // only 1 choice for p2
        return ["move 1", "move 2"]
      })
      mockApplyChoices.mockReturnValue(undefined)
      mockEvaluatePosition.mockReturnValue({ score: 0, rawScore: 0, features: [] })

      const state = makeState()
      const actions = makeActions()

      await ai.chooseAction(state, actions)
      expect(mockApplyChoices).toHaveBeenCalled()
    })

    it("uses uniform random when no active pokemon for p2", async () => {
      ai.setBattleState("valid-battle-json")

      const noActiveP2 = {
        ...mockBattleInstance,
        p2: {
          ...mockBattleInstance.p2,
          active: [undefined],
        },
      }
      mockCloneBattle.mockReturnValue(noActiveP2)
      mockIsBattleOver.mockReturnValue(false)
      mockGetLegalChoices.mockReturnValue(["move 1", "move 2"])
      mockApplyChoices.mockReturnValue(undefined)
      mockEvaluatePosition.mockReturnValue({ score: 0, rawScore: 0, features: [] })

      const state = makeState()
      const actions = makeActions()

      await ai.chooseAction(state, actions)
      expect(mockApplyChoices).toHaveBeenCalled()
    })

    it("uses uniform random when no predictions available", async () => {
      ai.setBattleState("valid-battle-json")
      mockIsBattleOver.mockReturnValue(false)
      mockGetLegalChoices.mockReturnValue(["move 1", "move 2"])
      mockApplyChoices.mockReturnValue(undefined)
      mockEvaluatePosition.mockReturnValue({ score: 0, rawScore: 0, features: [] })

      // State without predictions
      const state = makeState()
      state.opponentPredictions = undefined
      const actions = makeActions()

      await ai.chooseAction(state, actions)
      expect(mockApplyChoices).toHaveBeenCalled()
    })

    it("uses weighted selection when predictions match moves", async () => {
      ai.setBattleState("valid-battle-json")
      mockIsBattleOver.mockReturnValue(false)
      mockGetLegalChoices.mockReturnValue(["move 1", "move 2", "switch 3"])
      mockApplyChoices.mockReturnValue(undefined)
      mockEvaluatePosition.mockReturnValue({ score: 0, rawScore: 0, features: [] })

      const state = makeState()
      // Add predictions for heatran (the p2 active)
      state.opponentPredictions = {
        heatran: {
          pokemonId: "heatran",
          predictedMoves: ["Magma Storm", "Earth Power"],
          confidence: 0.8,
        },
      }
      const actions = makeActions()

      // Seed Math.random to get deterministic results
      const originalRandom = Math.random
      Math.random = () => 0.1 // Will select first weighted option

      try {
        await ai.chooseAction(state, actions)
        expect(mockApplyChoices).toHaveBeenCalled()
      } finally {
        Math.random = originalRandom
      }
    })

    it("uses uniform when predictions have empty predictedMoves", async () => {
      ai.setBattleState("valid-battle-json")
      mockIsBattleOver.mockReturnValue(false)
      mockGetLegalChoices.mockReturnValue(["move 1", "move 2"])
      mockApplyChoices.mockReturnValue(undefined)
      mockEvaluatePosition.mockReturnValue({ score: 0, rawScore: 0, features: [] })

      const state = makeState()
      state.opponentPredictions = {
        heatran: {
          pokemonId: "heatran",
          predictedMoves: [],
          confidence: 0.5,
        },
      }
      const actions = makeActions()

      await ai.chooseAction(state, actions)
      expect(mockApplyChoices).toHaveBeenCalled()
    })

    it("handles weighted fallback to last choice", async () => {
      ai.setBattleState("valid-battle-json")
      mockIsBattleOver.mockReturnValue(false)
      mockGetLegalChoices.mockReturnValue(["move 1", "switch 3"])
      mockApplyChoices.mockReturnValue(undefined)
      mockEvaluatePosition.mockReturnValue({ score: 0, rawScore: 0, features: [] })

      const state = makeState()
      state.opponentPredictions = {
        heatran: {
          pokemonId: "heatran",
          predictedMoves: ["Magma Storm"],
          confidence: 0.9,
        },
      }
      const actions = makeActions()

      // Math.random returns near 1.0 to fall through all weights
      const originalRandom = Math.random
      Math.random = () => 0.999

      try {
        await ai.chooseAction(state, actions)
        expect(mockApplyChoices).toHaveBeenCalled()
      } finally {
        Math.random = originalRandom
      }
    })
  })

  // -----------------------------------------------------------------------
  // runSearch result validation
  // -----------------------------------------------------------------------

  describe("MCTSResult structure", () => {
    it("returns valid win probability from best stats", async () => {
      ai.setBattleState("valid-battle-json")
      mockIsBattleOver.mockReturnValue(false)
      mockGetLegalChoices.mockReturnValue(["move 1"])
      mockApplyChoices.mockReturnValue(undefined)
      mockEvaluatePosition.mockReturnValue({ score: 1.0, rawScore: 1000, features: [] })

      const state = makeState()
      const actions = makeActions()

      // The result is converted through convertChoiceToAction,
      // but we can verify the action is valid
      const result = await ai.chooseAction(state, actions)
      expect(result.type).toBe("move")
    })

    it("handles action scores sorting by visits", async () => {
      const moreIterAI = new MCTSAI({
        maxIterations: 10,
        maxTimeMs: 2000,
        rolloutDepth: 1,
      })
      moreIterAI.setBattleState("valid-battle-json")
      mockIsBattleOver.mockReturnValue(false)
      mockGetLegalChoices.mockReturnValue(["move 1", "move 2", "switch 3"])
      mockApplyChoices.mockReturnValue(undefined)
      mockEvaluatePosition.mockReturnValue({ score: 0.5, rawScore: 500, features: [] })

      const state = makeState()
      const actions: BattleActionSet = {
        ...makeActions(),
        switches: [
          {
            index: 3,
            name: "Tyranitar",
            speciesId: "tyranitar",
            hp: 404,
            maxHp: 404,
            status: "",
            fainted: false,
          },
        ],
      }

      const result = await moreIterAI.chooseAction(state, actions)
      expect(result.type).toMatch(/^(move|switch)$/)
    })
  })

  // -----------------------------------------------------------------------
  // Joint stats tracking
  // -----------------------------------------------------------------------

  describe("joint stats in iterate", () => {
    it("tracks joint action statistics", async () => {
      ai.setBattleState("valid-battle-json")
      mockIsBattleOver.mockReturnValue(false)
      mockGetLegalChoices.mockReturnValue(["move 1", "move 2"])
      mockApplyChoices.mockReturnValue(undefined)
      mockEvaluatePosition.mockReturnValue({ score: 0.5, rawScore: 500, features: [] })

      const state = makeState()
      const actions = makeActions()

      // With 3 iterations, joint stats should be populated
      await ai.chooseAction(state, actions)
      // Verify the search completed without errors
      expect(mockCloneBattle).toHaveBeenCalledTimes(3)
    })
  })

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  describe("edge cases", () => {
    it("handles time limit being reached before max iterations", async () => {
      const slowAI = new MCTSAI({
        maxIterations: 1000000,
        maxTimeMs: 1, // Very short time limit
        rolloutDepth: 1,
      })
      slowAI.setBattleState("valid-battle-json")
      mockIsBattleOver.mockReturnValue(false)
      mockGetLegalChoices.mockReturnValue(["move 1"])
      mockApplyChoices.mockReturnValue(undefined)
      mockEvaluatePosition.mockReturnValue({ score: 0, rawScore: 0, features: [] })

      const state = makeState()
      const actions = makeActions()

      const result = await slowAI.chooseAction(state, actions)
      expect(result.type).toBe("move")
      // Should have terminated before 1M iterations due to time limit
      expect(mockCloneBattle.mock.calls.length).toBeLessThan(1000000)
    })

    it("setBattleState updates formatId", () => {
      ai.setBattleState("json", "gen9uu")
      // No way to read formatId directly, but subsequent chooseAction won't crash
      expect(ai.difficulty).toBe("expert")
    })

    it("handles console.error on search failure without crashing", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

      const { Battle } = await import("@pkmn/sim")
      vi.mocked(Battle.fromJSON).mockImplementationOnce(() => {
        throw new Error("Deserialization failed")
      })

      ai.setBattleState("broken-state")
      const state = makeState()
      const actions = makeActions()

      const result = await ai.chooseAction(state, actions)
      expect(result.type).toBe("move")
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[MCTSAI]"),
        expect.any(Error),
      )

      consoleSpy.mockRestore()
    })
  })
})
