import { describe, it, expect, vi, beforeEach } from "vitest"
import { HeuristicAI, MCTSAI, createInitialState } from "@nasty-plot/battle-engine"
import type { BattleState, BattleActionSet, PredictedSet } from "@nasty-plot/battle-engine"

function makeState(): BattleState {
  const state = createInitialState("test-predictor", "singles")

  state.sides.p1.active = [
    {
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
      item: "Life Orb",
      ability: "Rough Skin",
      isTerastallized: false,
      moves: [],
      stats: { hp: 357, atk: 394, def: 226, spa: 196, spd: 206, spe: 333 },
      boosts: {
        atk: 0,
        def: 0,
        spa: 0,
        spd: 0,
        spe: 0,
        accuracy: 0,
        evasion: 0,
      },
      volatiles: [],
    },
  ]

  state.sides.p2.active = [
    {
      speciesId: "heatran",
      name: "Heatran",
      nickname: "Heatran",
      level: 100,
      types: ["Fire", "Steel"],
      hp: 311,
      maxHp: 311,
      hpPercent: 100,
      status: "",
      fainted: false,
      item: "Leftovers",
      ability: "Flash Fire",
      isTerastallized: false,
      moves: [],
      stats: { hp: 311, atk: 194, def: 248, spa: 394, spd: 248, spe: 169 },
      boosts: {
        atk: 0,
        def: 0,
        spa: 0,
        spd: 0,
        spe: 0,
        accuracy: 0,
        evasion: 0,
      },
      volatiles: [],
    },
  ]

  state.sides.p2.team = [state.sides.p2.active[0]!]

  return state
}

function makeActions(): BattleActionSet {
  return {
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
    ],
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
}

// ---------------------------------------------------------------------------
// BattleState.opponentPredictions
// ---------------------------------------------------------------------------

describe("BattleState opponentPredictions", () => {
  it("can store predictions on state", () => {
    const state = makeState()
    expect(state.opponentPredictions).toBeUndefined()

    const predictions: Record<string, PredictedSet> = {
      garchomp: {
        pokemonId: "garchomp",
        predictedMoves: ["Earthquake", "Outrage", "Swords Dance", "Stealth Rock"],
        predictedItem: "Focus Sash",
        predictedAbility: "Rough Skin",
        confidence: 0.8,
      },
    }
    state.opponentPredictions = predictions

    expect(state.opponentPredictions).toBeDefined()
    expect(state.opponentPredictions!["garchomp"].predictedMoves).toHaveLength(4)
    expect(state.opponentPredictions!["garchomp"].confidence).toBe(0.8)
  })

  it("predictions are optional and default to undefined", () => {
    const state = createInitialState("test", "singles")
    expect(state.opponentPredictions).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// HeuristicAI with predictions
// ---------------------------------------------------------------------------

describe("HeuristicAI with opponentPredictions", () => {
  const ai = new HeuristicAI()

  it("factors predicted moves into switch scoring", async () => {
    const state = makeState()

    // Set up a bad matchup so switches are considered
    // p2 active: Weavile (Dark/Ice), p1 active: Blaziken (Fire/Fighting)
    state.sides.p2.active = [
      {
        speciesId: "weavile",
        name: "Weavile",
        nickname: "Weavile",
        level: 100,
        types: ["Dark", "Ice"],
        hp: 281,
        maxHp: 281,
        hpPercent: 100,
        status: "",
        fainted: false,
        item: "Choice Band",
        ability: "Pressure",
        isTerastallized: false,
        moves: [],
        stats: { hp: 281, atk: 372, def: 166, spa: 126, spd: 196, spe: 349 },
        boosts: {
          atk: 0,
          def: 0,
          spa: 0,
          spd: 0,
          spe: 0,
          accuracy: 0,
          evasion: 0,
        },
        volatiles: [],
      },
    ]
    state.sides.p1.active = [
      {
        speciesId: "blaziken",
        name: "Blaziken",
        nickname: "Blaziken",
        level: 100,
        types: ["Fire", "Fighting"],
        hp: 301,
        maxHp: 301,
        hpPercent: 100,
        status: "",
        fainted: false,
        item: "Life Orb",
        ability: "Speed Boost",
        isTerastallized: false,
        moves: [],
        stats: { hp: 301, atk: 372, def: 176, spa: 318, spd: 176, spe: 196 },
        boosts: {
          atk: 0,
          def: 0,
          spa: 0,
          spd: 0,
          spe: 0,
          accuracy: 0,
          evasion: 0,
        },
        volatiles: [],
      },
    ]

    // Predictions for Blaziken (opponent) include Ice Punch which would hurt Dragon types
    state.opponentPredictions = {
      blaziken: {
        pokemonId: "blaziken",
        predictedMoves: ["Close Combat", "Flare Blitz", "Ice Punch", "Swords Dance"],
        predictedItem: "Life Orb",
        predictedAbility: "Speed Boost",
        confidence: 0.9,
      },
    }

    // Switch targets: Dragonite (Dragon/Flying, weak to Ice) and Toxapex (Poison/Water, resists Ice)
    state.sides.p2.team = [
      state.sides.p2.active[0]!,
      {
        speciesId: "dragonite",
        name: "Dragonite",
        nickname: "Dragonite",
        level: 100,
        types: ["Dragon", "Flying"],
        hp: 323,
        maxHp: 323,
        hpPercent: 100,
        status: "",
        fainted: false,
        item: "Heavy-Duty Boots",
        ability: "Multiscale",
        isTerastallized: false,
        moves: [],
        stats: { hp: 323, atk: 403, def: 226, spa: 236, spd: 236, spe: 196 },
        boosts: {
          atk: 0,
          def: 0,
          spa: 0,
          spd: 0,
          spe: 0,
          accuracy: 0,
          evasion: 0,
        },
        volatiles: [],
      },
      {
        speciesId: "toxapex",
        name: "Toxapex",
        nickname: "Toxapex",
        level: 100,
        types: ["Poison", "Water"],
        hp: 304,
        maxHp: 304,
        hpPercent: 100,
        status: "",
        fainted: false,
        item: "Rocky Helmet",
        ability: "Regenerator",
        isTerastallized: false,
        moves: [],
        stats: { hp: 304, atk: 156, def: 383, spa: 150, spd: 352, spe: 116 },
        boosts: {
          atk: 0,
          def: 0,
          spa: 0,
          spd: 0,
          spe: 0,
          accuracy: 0,
          evasion: 0,
        },
        volatiles: [],
      },
    ]

    const actions: BattleActionSet = {
      moves: [
        {
          name: "Knock Off",
          id: "knockoff",
          pp: 32,
          maxPp: 32,
          type: "Dark",
          disabled: false,
          target: "normal",
          basePower: 65,
          category: "Physical",
          accuracy: 100,
          description: "",
        },
      ],
      canTera: false,
      switches: [
        {
          index: 2,
          name: "Dragonite",
          speciesId: "dragonite",
          hp: 323,
          maxHp: 323,
          status: "",
          fainted: false,
        },
        {
          index: 3,
          name: "Toxapex",
          speciesId: "toxapex",
          hp: 304,
          maxHp: 304,
          status: "",
          fainted: false,
        },
      ],
      forceSwitch: false,
    }

    const result = await ai.chooseAction(state, actions)
    // The AI should return a valid action
    expect(result.type).toMatch(/^(move|switch)$/)
  })

  it("works normally without opponentPredictions", async () => {
    const state = makeState()
    // No opponentPredictions set
    expect(state.opponentPredictions).toBeUndefined()

    const actions = makeActions()
    const result = await ai.chooseAction(state, actions)
    expect(result.type).toMatch(/^(move|switch)$/)
  })

  it("handles empty predictions gracefully", async () => {
    const state = makeState()
    state.opponentPredictions = {}

    const actions = makeActions()
    const result = await ai.chooseAction(state, actions)
    expect(result.type).toMatch(/^(move|switch)$/)
  })

  it("penalizes switches into predicted SE coverage moves on force switch", async () => {
    const state = makeState()

    // p1 active: Garchomp with predicted Ice Beam (4x SE vs Dragonite)
    state.opponentPredictions = {
      garchomp: {
        pokemonId: "garchomp",
        predictedMoves: ["Earthquake", "Ice Beam", "Dragon Claw", "Stealth Rock"],
        predictedItem: "Life Orb",
        predictedAbility: "Rough Skin",
        confidence: 0.95,
      },
    }

    state.sides.p2.team = [
      state.sides.p2.active[0]!,
      {
        speciesId: "dragonite",
        name: "Dragonite",
        nickname: "Dragonite",
        level: 100,
        types: ["Dragon", "Flying"],
        hp: 323,
        maxHp: 323,
        hpPercent: 100,
        status: "",
        fainted: false,
        item: "Heavy-Duty Boots",
        ability: "Multiscale",
        isTerastallized: false,
        moves: [],
        stats: { hp: 323, atk: 403, def: 226, spa: 236, spd: 236, spe: 196 },
        boosts: {
          atk: 0,
          def: 0,
          spa: 0,
          spd: 0,
          spe: 0,
          accuracy: 0,
          evasion: 0,
        },
        volatiles: [],
      },
      {
        speciesId: "toxapex",
        name: "Toxapex",
        nickname: "Toxapex",
        level: 100,
        types: ["Poison", "Water"],
        hp: 304,
        maxHp: 304,
        hpPercent: 100,
        status: "",
        fainted: false,
        item: "Rocky Helmet",
        ability: "Regenerator",
        isTerastallized: false,
        moves: [],
        stats: { hp: 304, atk: 156, def: 383, spa: 150, spd: 352, spe: 116 },
        boosts: {
          atk: 0,
          def: 0,
          spa: 0,
          spd: 0,
          spe: 0,
          accuracy: 0,
          evasion: 0,
        },
        volatiles: [],
      },
    ]

    const actions: BattleActionSet = {
      moves: [],
      canTera: false,
      switches: [
        {
          index: 2,
          name: "Dragonite",
          speciesId: "dragonite",
          hp: 323,
          maxHp: 323,
          status: "",
          fainted: false,
        },
        {
          index: 3,
          name: "Toxapex",
          speciesId: "toxapex",
          hp: 304,
          maxHp: 304,
          status: "",
          fainted: false,
        },
      ],
      forceSwitch: true,
    }

    // Run multiple times to check the AI consistently prefers Toxapex
    // (which resists both Earthquake and is not weak to Ice Beam)
    let toxapexCount = 0
    const iterations = 20
    for (let i = 0; i < iterations; i++) {
      const result = await ai.chooseAction(state, actions)
      expect(result.type).toBe("switch")
      if ((result as { pokemonIndex: number }).pokemonIndex === 3) {
        toxapexCount++
      }
    }
    // Toxapex should be chosen most of the time since Dragonite is penalized
    // for being weak to predicted Ice Beam (4x) and Dragon Claw (2x)
    expect(toxapexCount).toBeGreaterThan(iterations / 2)
  })
})

// ---------------------------------------------------------------------------
// MCTS AI with predictions
// ---------------------------------------------------------------------------

describe("MCTSAI with opponentPredictions", () => {
  it("stores predictions from state and falls back to heuristic without battle state", async () => {
    const ai = new MCTSAI()
    const state = makeState()

    state.opponentPredictions = {
      garchomp: {
        pokemonId: "garchomp",
        predictedMoves: ["Earthquake", "Outrage"],
        confidence: 0.7,
      },
    }

    const actions = makeActions()
    // Without setBattleState, MCTS falls back to HeuristicAI
    const result = await ai.chooseAction(state, actions)
    expect(result.type).toMatch(/^(move|switch)$/)
  })

  it("works without predictions", async () => {
    const ai = new MCTSAI()
    const state = makeState()
    // No predictions set

    const actions = makeActions()
    const result = await ai.chooseAction(state, actions)
    expect(result.type).toMatch(/^(move|switch)$/)
  })

  it("handles empty predictions object", async () => {
    const ai = new MCTSAI()
    const state = makeState()
    state.opponentPredictions = {}

    const actions = makeActions()
    const result = await ai.chooseAction(state, actions)
    expect(result.type).toMatch(/^(move|switch)$/)
  })
})
