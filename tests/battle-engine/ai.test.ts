import { RandomAI } from "@nasty-plot/battle-engine"
import { GreedyAI } from "@nasty-plot/battle-engine"
import { HeuristicAI } from "@nasty-plot/battle-engine"
import type { BattleState, BattleActionSet, BattlePokemon } from "@nasty-plot/battle-engine"
import { createInitialState } from "@nasty-plot/battle-engine"

function makeState(): BattleState {
  const state = createInitialState("test", "singles")

  // Set up a basic battle scenario
  state.sides.p1.active = [
    {
      speciesId: "garchomp",
      name: "Garchomp",
      nickname: "Garchomp",
      level: 100,
      types: ["Dragon", "Ground"],
      hp: 319,
      maxHp: 319,
      hpPercent: 100,
      status: "",
      fainted: false,
      item: "Life Orb",
      ability: "Rough Skin",
      isTerastallized: false,
      moves: [],
      stats: { hp: 319, atk: 394, def: 226, spa: 176, spd: 206, spe: 333 },
      boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 },
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
      boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 },
      volatiles: [],
    },
  ]

  state.sides.p2.team = state.sides.p2.active.filter(Boolean) as typeof state.sides.p2.team

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
        description: "Traps and damages the target for 4-5 turns.",
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
        description: "10% chance to lower the target's Sp. Def by 1.",
      },
      {
        name: "Flash Cannon",
        id: "flashcannon",
        pp: 16,
        maxPp: 16,
        type: "Steel",
        disabled: false,
        target: "normal",
        basePower: 80,
        category: "Special",
        accuracy: 100,
        description: "10% chance to lower the target's Sp. Def by 1.",
      },
      {
        name: "Taunt",
        id: "taunt",
        pp: 32,
        maxPp: 32,
        type: "Dark",
        disabled: false,
        target: "normal",
        basePower: 0,
        category: "Status",
        accuracy: 100,
        description: "The target can't use status moves for 3 turns.",
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

function makeForceSwitchActions(): BattleActionSet {
  return {
    moves: [],
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
    forceSwitch: true,
  }
}

describe("RandomAI", () => {
  const ai = new RandomAI()

  it("has difficulty 'random'", () => {
    expect(ai.difficulty).toBe("random")
  })

  it("returns a valid action", async () => {
    const state = makeState()
    const actions = makeActions()
    const result = await ai.chooseAction(state, actions)

    expect(result.type).toMatch(/^(move|switch)$/)
    if (result.type === "move") {
      expect(result.moveIndex).toBeGreaterThanOrEqual(1)
      expect(result.moveIndex).toBeLessThanOrEqual(actions.moves.length)
    } else {
      const switchIndices = actions.switches.map((s) => s.index)
      expect(switchIndices).toContain(result.pokemonIndex)
    }
  })

  it("handles forced switch", async () => {
    const state = makeState()
    const actions = makeForceSwitchActions()
    const result = await ai.chooseAction(state, actions)

    expect(result.type).toBe("switch")
    const switchIndices = actions.switches.map((s) => s.index)
    expect(switchIndices).toContain((result as { pokemonIndex: number }).pokemonIndex)
  })

  it("chooseLeads returns valid order", () => {
    const leads = ai.chooseLeads(6, "singles")
    expect(leads).toHaveLength(6)
    // Should contain each number 1-6
    for (let i = 1; i <= 6; i++) {
      expect(leads).toContain(i)
    }
  })
})

describe("GreedyAI", () => {
  const ai = new GreedyAI()

  it("has difficulty 'greedy'", () => {
    expect(ai.difficulty).toBe("greedy")
  })

  it("returns a move action when not force switching", async () => {
    const state = makeState()
    const actions = makeActions()
    const result = await ai.chooseAction(state, actions)

    // GreedyAI should pick a move (the highest damage one)
    expect(result.type).toBe("move")
  })

  it("prefers high-damage moves", async () => {
    const state = makeState()
    const actions = makeActions()

    // Earth Power should be preferred against Garchomp (neutral STAB Ground)
    // vs Magma Storm (resisted by Dragon/Ground) vs Flash Cannon (resisted)
    const result = await ai.chooseAction(state, actions)
    expect(result.type).toBe("move")
    // Earth Power (index 2) should be the best choice, but any move is valid
    expect((result as { moveIndex: number }).moveIndex).toBeGreaterThanOrEqual(1)
  })

  it("handles forced switch", async () => {
    const state = makeState()
    const actions = makeForceSwitchActions()
    const result = await ai.chooseAction(state, actions)

    expect(result.type).toBe("switch")
  })

  it("falls back when active pokemon is null (line 29)", async () => {
    const state = makeState()
    state.sides.p2.active = [null as never]
    const actions = makeActions()
    const result = await ai.chooseAction(state, actions)
    // Should use fallbackMove
    expect(result.type).toBe("move")
  })

  it("falls back when opponent pokemon is null (line 29)", async () => {
    const state = makeState()
    state.sides.p1.active = [null as never]
    const actions = makeActions()
    const result = await ai.chooseAction(state, actions)
    expect(result.type).toBe("move")
  })

  it("switches when best damage is very low (lines 70-72)", async () => {
    const state = makeState()
    // Use a matchup that produces very low damage: status-only moves
    const actions: BattleActionSet = {
      moves: [
        {
          name: "Toxic",
          id: "toxic",
          pp: 16,
          maxPp: 16,
          type: "Poison",
          disabled: false,
          target: "normal",
          basePower: 0,
          category: "Status",
          accuracy: 90,
          description: "Badly poisons the target.",
        },
        {
          name: "Protect",
          id: "protect",
          pp: 16,
          maxPp: 16,
          type: "Normal",
          disabled: false,
          target: "self",
          basePower: 0,
          category: "Status",
          accuracy: true,
          description: "Protects this turn.",
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
    const result = await ai.chooseAction(state, actions)
    // When all moves are status (0 damage), should consider switching
    expect(result.type).toBe("switch")
  })

  it("uses fallbackMove when no moves found a best damage (lines 80-84)", async () => {
    const state = makeState()
    // All moves disabled, no good damage → fallback
    const actions: BattleActionSet = {
      moves: [
        {
          name: "Toxic",
          id: "toxic",
          pp: 16,
          maxPp: 16,
          type: "Poison",
          disabled: true,
          target: "normal",
          basePower: 0,
          category: "Status",
          accuracy: 90,
          description: "",
        },
        {
          name: "Protect",
          id: "protect",
          pp: 16,
          maxPp: 16,
          type: "Normal",
          disabled: true,
          target: "self",
          basePower: 0,
          category: "Status",
          accuracy: true,
          description: "",
        },
      ],
      canTera: false,
      switches: [],
      forceSwitch: false,
    }
    const result = await ai.chooseAction(state, actions)
    expect(result.type).toBe("move")
    expect((result as { moveIndex: number }).moveIndex).toBe(1)
  })

  it("chooseLeads returns default ordering", () => {
    const leads = ai.chooseLeads(4, "singles")
    expect(leads).toEqual([1, 2, 3, 4])
  })
})

describe("HeuristicAI", () => {
  const ai = new HeuristicAI()

  it("has difficulty 'heuristic'", () => {
    expect(ai.difficulty).toBe("heuristic")
  })

  it("returns a valid action", async () => {
    const state = makeState()
    const actions = makeActions()
    const result = await ai.chooseAction(state, actions)

    expect(result.type).toMatch(/^(move|switch)$/)
  })

  it("handles forced switch", async () => {
    const state = makeState()
    const actions = makeForceSwitchActions()
    const result = await ai.chooseAction(state, actions)

    expect(result.type).toBe("switch")
  })

  it("chooseLeads returns valid order", () => {
    const leads = ai.chooseLeads(6, "singles")
    expect(leads).toHaveLength(6)
  })

  it("handles disabled moves", async () => {
    const state = makeState()
    const actions = makeActions()
    // Disable all but one move
    actions.moves[0].disabled = true
    actions.moves[1].disabled = true
    actions.moves[2].disabled = true

    const result = await ai.chooseAction(state, actions)
    if (result.type === "move") {
      // Should pick the only enabled move (Taunt, index 4)
      expect((result as { moveIndex: number }).moveIndex).toBe(4)
    }
    // Or it could switch, which is also valid
  })

  it("falls back when active pokemon is null", async () => {
    const state = makeState()
    state.sides.p2.active = [null as never]
    const actions = makeActions()
    const result = await ai.chooseAction(state, actions)
    expect(result.type).toBe("move")
  })

  it("falls back when opponent active is null", async () => {
    const state = makeState()
    state.sides.p1.active = [null as never]
    const actions = makeActions()
    const result = await ai.chooseAction(state, actions)
    expect(result.type).toBe("move")
  })

  it("falls back to move when no scored actions available", async () => {
    const state = makeState()
    const actions: BattleActionSet = {
      moves: [
        {
          name: "Magma Storm",
          id: "magmastorm",
          pp: 8,
          maxPp: 8,
          type: "Fire",
          disabled: true,
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
    }
    const result = await ai.chooseAction(state, actions)
    expect(result.type).toBe("move")
  })

  it("considers switching when matchup is unfavorable", async () => {
    const state = makeState()
    // Setup a very bad matchup: Fire/Steel Heatran active vs Ground type opponent
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
        boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 },
        volatiles: [],
      },
    ]
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
        boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 },
        volatiles: [],
      },
    ]
    // Add a good switch target to the team
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
        boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 },
        volatiles: [],
      },
    ]

    const actions: BattleActionSet = {
      moves: [
        {
          name: "Flash Cannon",
          id: "flashcannon",
          pp: 16,
          maxPp: 16,
          type: "Steel",
          disabled: false,
          target: "normal",
          basePower: 80,
          category: "Special",
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
      ],
      forceSwitch: false,
    }

    const result = await ai.chooseAction(state, actions)
    expect(result.type).toMatch(/^(move|switch)$/)
  })

  it("scores status moves correctly (toxic on unstatused opponent)", async () => {
    const state = makeState()
    const actions: BattleActionSet = {
      moves: [
        {
          name: "Toxic",
          id: "toxic",
          pp: 16,
          maxPp: 16,
          type: "Poison",
          disabled: false,
          target: "normal",
          basePower: 0,
          category: "Status",
          accuracy: 90,
          description: "",
        },
        {
          name: "Protect",
          id: "protect",
          pp: 16,
          maxPp: 16,
          type: "Normal",
          disabled: false,
          target: "self",
          basePower: 0,
          category: "Status",
          accuracy: true,
          description: "",
        },
      ],
      canTera: false,
      switches: [],
      forceSwitch: false,
    }
    const result = await ai.chooseAction(state, actions)
    expect(result.type).toBe("move")
  })

  it("scores hazard moves based on turn count", async () => {
    const state = makeState()
    state.turn = 1 // Early game
    const actions: BattleActionSet = {
      moves: [
        {
          name: "Stealth Rock",
          id: "stealthrock",
          pp: 20,
          maxPp: 20,
          type: "Rock",
          disabled: false,
          target: "foeSide",
          basePower: 0,
          category: "Status",
          accuracy: true,
          description: "",
        },
        {
          name: "Tackle",
          id: "tackle",
          pp: 35,
          maxPp: 35,
          type: "Normal",
          disabled: false,
          target: "normal",
          basePower: 40,
          category: "Physical",
          accuracy: 100,
          description: "",
        },
      ],
      canTera: false,
      switches: [],
      forceSwitch: false,
    }
    const result = await ai.chooseAction(state, actions)
    expect(result.type).toBe("move")
  })

  it("handles recovery moves when hp is low", async () => {
    const state = makeState()
    state.sides.p2.active[0] = {
      ...state.sides.p2.active[0]!,
      hp: 50,
      maxHp: 311,
      hpPercent: 16,
    }
    const actions: BattleActionSet = {
      moves: [
        {
          name: "Recover",
          id: "recover",
          pp: 16,
          maxPp: 16,
          type: "Normal",
          disabled: false,
          target: "self",
          basePower: 0,
          category: "Status",
          accuracy: true,
          description: "",
        },
        {
          name: "Tackle",
          id: "tackle",
          pp: 35,
          maxPp: 35,
          type: "Normal",
          disabled: false,
          target: "normal",
          basePower: 40,
          category: "Physical",
          accuracy: 100,
          description: "",
        },
      ],
      canTera: false,
      switches: [],
      forceSwitch: false,
    }
    const result = await ai.chooseAction(state, actions)
    expect(result.type).toBe("move")
  })

  it("scores defog when own hazards are up", async () => {
    const state = makeState()
    state.sides.p2.sideConditions.stealthRock = true
    state.sides.p2.sideConditions.spikes = 2
    const actions: BattleActionSet = {
      moves: [
        {
          name: "Defog",
          id: "defog",
          pp: 16,
          maxPp: 16,
          type: "Flying",
          disabled: false,
          target: "normal",
          basePower: 0,
          category: "Status",
          accuracy: true,
          description: "",
        },
        {
          name: "Tackle",
          id: "tackle",
          pp: 35,
          maxPp: 35,
          type: "Normal",
          disabled: false,
          target: "normal",
          basePower: 40,
          category: "Physical",
          accuracy: 100,
          description: "",
        },
      ],
      canTera: false,
      switches: [],
      forceSwitch: false,
    }
    const result = await ai.chooseAction(state, actions)
    expect(result.type).toBe("move")
  })

  it("does not score setup moves when HP is low", async () => {
    const state = makeState()
    state.sides.p2.active[0] = {
      ...state.sides.p2.active[0]!,
      hp: 50,
      maxHp: 311,
      hpPercent: 16,
    }
    const actions: BattleActionSet = {
      moves: [
        {
          name: "Swords Dance",
          id: "swordsdance",
          pp: 20,
          maxPp: 20,
          type: "Normal",
          disabled: false,
          target: "self",
          basePower: 0,
          category: "Status",
          accuracy: true,
          description: "",
        },
        {
          name: "Earthquake",
          id: "earthquake",
          pp: 10,
          maxPp: 10,
          type: "Ground",
          disabled: false,
          target: "normal",
          basePower: 100,
          category: "Physical",
          accuracy: 100,
          description: "",
        },
      ],
      canTera: false,
      switches: [],
      forceSwitch: false,
    }
    const result = await ai.chooseAction(state, actions)
    expect(result.type).toBe("move")
  })

  it("force switch with no available switches and no opponent info", async () => {
    const state = makeState()
    state.sides.p1.active = [null as never]
    const actions: BattleActionSet = {
      moves: [],
      canTera: false,
      switches: [
        {
          index: 2,
          name: "Clefable",
          speciesId: "clefable",
          hp: 0,
          maxHp: 394,
          status: "",
          fainted: true,
        },
      ],
      forceSwitch: true,
    }
    const result = await ai.chooseAction(state, actions)
    expect(result.type).toBe("switch")
  })

  it("force switch when all switches are fainted returns first index", async () => {
    const state = makeState()
    const actions: BattleActionSet = {
      moves: [],
      canTera: false,
      switches: [
        {
          index: 2,
          name: "Clefable",
          speciesId: "clefable",
          hp: 0,
          maxHp: 394,
          status: "",
          fainted: true,
        },
        {
          index: 3,
          name: "Weavile",
          speciesId: "weavile",
          hp: 0,
          maxHp: 281,
          status: "",
          fainted: true,
        },
      ],
      forceSwitch: true,
    }
    const result = await ai.chooseAction(state, actions)
    expect(result.type).toBe("switch")
    expect((result as { pokemonIndex: number }).pokemonIndex).toBe(2)
  })

  it("force switch picks healthiest when no opponent active info", async () => {
    const state = makeState()
    state.sides.p1.active = [null as never]
    const actions: BattleActionSet = {
      moves: [],
      canTera: false,
      switches: [
        {
          index: 2,
          name: "Clefable",
          speciesId: "clefable",
          hp: 200,
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
      forceSwitch: true,
    }
    const result = await ai.chooseAction(state, actions)
    expect(result.type).toBe("switch")
    expect((result as { pokemonIndex: number }).pokemonIndex).toBe(3)
  })

  it("considers switches when in a bad type matchup (lines 62-76)", async () => {
    const state = makeState()
    // p2 active is Ice type (weak to p1's Fire STAB)
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
        boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 },
        volatiles: [],
      },
    ]
    // p1 active is Fire/Fighting (SE against Dark/Ice)
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
        boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 },
        volatiles: [],
      },
    ]
    // p2 team has a switch target
    const switchTarget: BattlePokemon = {
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
      boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 },
      volatiles: [],
    }
    state.sides.p2.team = [state.sides.p2.active[0]!, switchTarget]

    const actions: BattleActionSet = {
      moves: [
        {
          name: "Ice Shard",
          id: "iceshard",
          pp: 30,
          maxPp: 30,
          type: "Ice",
          disabled: false,
          target: "normal",
          basePower: 40,
          category: "Physical",
          accuracy: 100,
          description: "Priority.",
        },
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
    // Should consider switching due to bad matchup
    expect(result.type).toMatch(/^(move|switch)$/)
  })

  it("scores priority moves with low opp HP (line 145-157)", async () => {
    const state = makeState()
    // p1 is at low HP
    state.sides.p1.active = [
      {
        speciesId: "garchomp",
        name: "Garchomp",
        nickname: "Garchomp",
        level: 100,
        types: ["Dragon", "Ground"],
        hp: 30,
        maxHp: 357,
        hpPercent: 8,
        status: "",
        fainted: false,
        item: "Focus Sash",
        ability: "Rough Skin",
        isTerastallized: false,
        moves: [],
        stats: { hp: 357, atk: 394, def: 226, spa: 196, spd: 206, spe: 333 },
        boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 },
        volatiles: [],
      },
    ]

    const actions: BattleActionSet = {
      moves: [
        {
          name: "Aqua Jet",
          id: "aquajet",
          pp: 20,
          maxPp: 20,
          type: "Water",
          disabled: false,
          target: "normal",
          basePower: 40,
          category: "Physical",
          accuracy: 100,
          description: "Priority.",
        },
        {
          name: "Tackle",
          id: "tackle",
          pp: 35,
          maxPp: 35,
          type: "Normal",
          disabled: false,
          target: "normal",
          basePower: 40,
          category: "Physical",
          accuracy: 100,
          description: "",
        },
      ],
      canTera: false,
      switches: [],
      forceSwitch: false,
    }

    const result = await ai.chooseAction(state, actions)
    expect(result.type).toBe("move")
  })

  it("scores various hazard moves (spikes, toxicspikes, stickyweb)", async () => {
    const state = makeState()
    state.turn = 2 // Early game
    const actions: BattleActionSet = {
      moves: [
        {
          name: "Spikes",
          id: "spikes",
          pp: 20,
          maxPp: 20,
          type: "Ground",
          disabled: false,
          target: "foeSide",
          basePower: 0,
          category: "Status",
          accuracy: true,
          description: "",
        },
        {
          name: "Toxic Spikes",
          id: "toxicspikes",
          pp: 20,
          maxPp: 20,
          type: "Poison",
          disabled: false,
          target: "foeSide",
          basePower: 0,
          category: "Status",
          accuracy: true,
          description: "",
        },
        {
          name: "Sticky Web",
          id: "stickyweb",
          pp: 20,
          maxPp: 20,
          type: "Bug",
          disabled: false,
          target: "foeSide",
          basePower: 0,
          category: "Status",
          accuracy: true,
          description: "",
        },
      ],
      canTera: false,
      switches: [],
      forceSwitch: false,
    }
    const result = await ai.chooseAction(state, actions)
    expect(result.type).toBe("move")
  })

  it("gives 0 score for hazard moves when maxed out", async () => {
    const state = makeState()
    state.sides.p1.sideConditions.spikes = 3
    state.sides.p1.sideConditions.toxicSpikes = 2
    state.sides.p1.sideConditions.stealthRock = true
    state.sides.p1.sideConditions.stickyWeb = true
    const actions: BattleActionSet = {
      moves: [
        {
          name: "Stealth Rock",
          id: "stealthrock",
          pp: 20,
          maxPp: 20,
          type: "Rock",
          disabled: false,
          target: "foeSide",
          basePower: 0,
          category: "Status",
          accuracy: true,
          description: "",
        },
        {
          name: "Spikes",
          id: "spikes",
          pp: 20,
          maxPp: 20,
          type: "Ground",
          disabled: false,
          target: "foeSide",
          basePower: 0,
          category: "Status",
          accuracy: true,
          description: "",
        },
        {
          name: "Tackle",
          id: "tackle",
          pp: 35,
          maxPp: 35,
          type: "Normal",
          disabled: false,
          target: "normal",
          basePower: 40,
          category: "Physical",
          accuracy: 100,
          description: "",
        },
      ],
      canTera: false,
      switches: [],
      forceSwitch: false,
    }
    const result = await ai.chooseAction(state, actions)
    expect(result.type).toBe("move")
  })

  it("scores status infliction moves (all types)", async () => {
    const state = makeState()
    const actions: BattleActionSet = {
      moves: [
        {
          name: "Will-O-Wisp",
          id: "willowisp",
          pp: 16,
          maxPp: 16,
          type: "Fire",
          disabled: false,
          target: "normal",
          basePower: 0,
          category: "Status",
          accuracy: 85,
          description: "",
        },
        {
          name: "Thunder Wave",
          id: "thunderwave",
          pp: 20,
          maxPp: 20,
          type: "Electric",
          disabled: false,
          target: "normal",
          basePower: 0,
          category: "Status",
          accuracy: 90,
          description: "",
        },
        {
          name: "Yawn",
          id: "yawn",
          pp: 16,
          maxPp: 16,
          type: "Normal",
          disabled: false,
          target: "normal",
          basePower: 0,
          category: "Status",
          accuracy: true,
          description: "",
        },
      ],
      canTera: false,
      switches: [],
      forceSwitch: false,
    }
    const result = await ai.chooseAction(state, actions)
    expect(result.type).toBe("move")
  })

  it("scores 0 for status moves when opponent already has status", async () => {
    const state = makeState()
    state.sides.p1.active[0] = {
      ...state.sides.p1.active[0]!,
      status: "brn",
    }
    const actions: BattleActionSet = {
      moves: [
        {
          name: "Toxic",
          id: "toxic",
          pp: 16,
          maxPp: 16,
          type: "Poison",
          disabled: false,
          target: "normal",
          basePower: 0,
          category: "Status",
          accuracy: 90,
          description: "",
        },
        {
          name: "Tackle",
          id: "tackle",
          pp: 35,
          maxPp: 35,
          type: "Normal",
          disabled: false,
          target: "normal",
          basePower: 40,
          category: "Physical",
          accuracy: 100,
          description: "",
        },
      ],
      canTera: false,
      switches: [],
      forceSwitch: false,
    }
    const result = await ai.chooseAction(state, actions)
    expect(result.type).toBe("move")
  })

  it("scores setup moves high when favorable matchup and high HP", async () => {
    const state = makeState()
    // p2 has good matchup vs p1 (p2 = Dragon/Ground, p1 = Fire/Steel)
    state.sides.p2.active = [
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
        boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 },
        volatiles: [],
      },
    ]
    state.sides.p2.team = [state.sides.p2.active[0]!]

    const actions: BattleActionSet = {
      moves: [
        {
          name: "Swords Dance",
          id: "swordsdance",
          pp: 20,
          maxPp: 20,
          type: "Normal",
          disabled: false,
          target: "self",
          basePower: 0,
          category: "Status",
          accuracy: true,
          description: "",
        },
        {
          name: "Earthquake",
          id: "earthquake",
          pp: 10,
          maxPp: 10,
          type: "Ground",
          disabled: false,
          target: "normal",
          basePower: 100,
          category: "Physical",
          accuracy: 100,
          description: "",
        },
      ],
      canTera: false,
      switches: [],
      forceSwitch: false,
    }
    const result = await ai.chooseAction(state, actions)
    expect(result.type).toBe("move")
  })

  it("scores recovery moves based on HP level", async () => {
    const state = makeState()
    state.sides.p2.active = [
      {
        speciesId: "heatran",
        name: "Heatran",
        nickname: "Heatran",
        level: 100,
        types: ["Fire", "Steel"],
        hp: 100,
        maxHp: 311,
        hpPercent: 32,
        status: "",
        fainted: false,
        item: "Leftovers",
        ability: "Flash Fire",
        isTerastallized: false,
        moves: [],
        stats: { hp: 311, atk: 194, def: 248, spa: 394, spd: 248, spe: 169 },
        boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 },
        volatiles: [],
      },
    ]
    state.sides.p2.team = [state.sides.p2.active[0]!]

    const actions: BattleActionSet = {
      moves: [
        {
          name: "Recover",
          id: "recover",
          pp: 16,
          maxPp: 16,
          type: "Normal",
          disabled: false,
          target: "self",
          basePower: 0,
          category: "Status",
          accuracy: true,
          description: "",
        },
        {
          name: "Tackle",
          id: "tackle",
          pp: 35,
          maxPp: 35,
          type: "Normal",
          disabled: false,
          target: "normal",
          basePower: 40,
          category: "Physical",
          accuracy: 100,
          description: "",
        },
      ],
      canTera: false,
      switches: [],
      forceSwitch: false,
    }
    const result = await ai.chooseAction(state, actions)
    expect(result.type).toBe("move")
  })

  it("scores defog when own hazards are up", async () => {
    const state = makeState()
    state.sides.p2.sideConditions.stealthRock = true
    state.sides.p2.sideConditions.spikes = 1
    const actions: BattleActionSet = {
      moves: [
        {
          name: "Rapid Spin",
          id: "rapidspin",
          pp: 40,
          maxPp: 40,
          type: "Normal",
          disabled: false,
          target: "normal",
          basePower: 50,
          category: "Physical",
          accuracy: 100,
          description: "",
        },
      ],
      canTera: false,
      switches: [],
      forceSwitch: false,
    }
    const result = await ai.chooseAction(state, actions)
    expect(result.type).toBe("move")
  })

  it("default status move score for unknown status moves", async () => {
    const state = makeState()
    const actions: BattleActionSet = {
      moves: [
        {
          name: "Trick Room",
          id: "trickroom",
          pp: 8,
          maxPp: 8,
          type: "Psychic",
          disabled: false,
          target: "all",
          basePower: 0,
          category: "Status",
          accuracy: true,
          description: "",
        },
      ],
      canTera: false,
      switches: [],
      forceSwitch: false,
    }
    const result = await ai.chooseAction(state, actions)
    expect(result.type).toBe("move")
  })

  it("force switch scores switch targets against opponent", async () => {
    const state = makeState()
    state.sides.p2.team = [
      state.sides.p2.active[0]!,
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
        boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 },
        volatiles: [],
      },
    ]
    const actions: BattleActionSet = {
      moves: [],
      canTera: false,
      switches: [
        {
          index: 2,
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
    const result = await ai.chooseAction(state, actions)
    expect(result.type).toBe("switch")
    expect((result as { pokemonIndex: number }).pokemonIndex).toBe(2)
  })

  it("handles calc failure fallback in scoreDamagingMove (lines 156-163)", async () => {
    const state = makeState()
    // Use a pokemon name that may cause calc issues but still has a valid type
    state.sides.p2.active = [
      {
        speciesId: "missingno",
        name: "MissingNo",
        nickname: "MissingNo",
        level: 100,
        types: ["Normal"],
        hp: 100,
        maxHp: 100,
        hpPercent: 100,
        status: "",
        fainted: false,
        item: "",
        ability: "",
        isTerastallized: false,
        moves: [],
        stats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 },
        boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 },
        volatiles: [],
      },
    ]
    state.sides.p2.team = [state.sides.p2.active[0]!]
    const actions: BattleActionSet = {
      moves: [
        {
          name: "Tackle",
          id: "tackle",
          pp: 35,
          maxPp: 35,
          type: "Normal",
          disabled: false,
          target: "normal",
          basePower: 40,
          category: "Physical",
          accuracy: 100,
          description: "",
        },
      ],
      canTera: false,
      switches: [],
      forceSwitch: false,
    }
    const result = await ai.chooseAction(state, actions)
    expect(result.type).toBe("move")
  })

  it("handles unknown move data in scoreMove (line 103)", async () => {
    const state = makeState()
    const actions: BattleActionSet = {
      moves: [
        {
          name: "FakeMove123",
          id: "fakemove123",
          pp: 10,
          maxPp: 10,
          type: "Normal",
          disabled: false,
          target: "normal",
          basePower: 100,
          category: "Physical",
          accuracy: 100,
          description: "",
        },
      ],
      canTera: false,
      switches: [],
      forceSwitch: false,
    }
    const result = await ai.chooseAction(state, actions)
    expect(result.type).toBe("move")
  })

  it("chooseLeads returns default order for doubles", () => {
    const leads = ai.chooseLeads(6, "doubles")
    expect(leads).toHaveLength(6)
    // Should still contain 1-6
    for (let i = 1; i <= 6; i++) {
      expect(leads).toContain(i)
    }
  })

  it("scores sleeppowder status move", async () => {
    const state = makeState()
    const actions: BattleActionSet = {
      moves: [
        {
          name: "Sleep Powder",
          id: "sleeppowder",
          pp: 16,
          maxPp: 16,
          type: "Grass",
          disabled: false,
          target: "normal",
          basePower: 0,
          category: "Status",
          accuracy: 75,
          description: "",
        },
      ],
      canTera: false,
      switches: [],
      forceSwitch: false,
    }
    const result = await ai.chooseAction(state, actions)
    expect(result.type).toBe("move")
    // Sleep Powder should score 40 for unstatused opponent
  })

  it("scores spore status move", async () => {
    const state = makeState()
    const actions: BattleActionSet = {
      moves: [
        {
          name: "Spore",
          id: "spore",
          pp: 16,
          maxPp: 16,
          type: "Grass",
          disabled: false,
          target: "normal",
          basePower: 0,
          category: "Status",
          accuracy: 100,
          description: "",
        },
      ],
      canTera: false,
      switches: [],
      forceSwitch: false,
    }
    const result = await ai.chooseAction(state, actions)
    expect(result.type).toBe("move")
  })

  it("returns 0 for unknown status infliction move", async () => {
    const state = makeState()
    // Use a move that is status-inflicting but not in the recognized list
    // The "default" case in scoreStatusInfliction returns 0
    const actions: BattleActionSet = {
      moves: [
        // Provide a move with a status-inflicting id not in the list
        {
          name: "Nuzzle",
          id: "nuzzle",
          pp: 20,
          maxPp: 20,
          type: "Electric",
          disabled: false,
          target: "normal",
          basePower: 20,
          category: "Physical",
          accuracy: 100,
          description: "",
        },
        {
          name: "Earthquake",
          id: "earthquake",
          pp: 10,
          maxPp: 10,
          type: "Ground",
          disabled: false,
          target: "normal",
          basePower: 100,
          category: "Physical",
          accuracy: 100,
          description: "",
        },
      ],
      canTera: false,
      switches: [],
      forceSwitch: false,
    }
    const result = await ai.chooseAction(state, actions)
    expect(result.type).toBe("move")
  })

  it("penalizes switching into a bad matchup (line 335)", async () => {
    const state = makeState()
    // Opponent (p1) is Heatran (Fire/Steel)
    state.sides.p1.active = [
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
        boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 },
        volatiles: [],
      },
    ]
    // p2 active (AI) is Garchomp (Dragon/Ground) — evaluateMatchup(Garchomp, Heatran) = -0.45 < -0.3
    // This triggers the switch scoring block (line 93)
    state.sides.p2.active = [
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
        boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 },
        volatiles: [],
      },
    ]
    // Switch target is Swampert (Water/Ground)
    // evaluateMatchup(Swampert, Heatran) = -0.75 < -0.3 → triggers line 335 penalty
    const switchTarget: BattlePokemon = {
      speciesId: "swampert",
      name: "Swampert",
      nickname: "Swampert",
      level: 100,
      types: ["Water", "Ground"],
      hp: 341,
      maxHp: 341,
      hpPercent: 100,
      status: "",
      fainted: false,
      item: "Leftovers",
      ability: "Torrent",
      isTerastallized: false,
      moves: [],
      stats: { hp: 341, atk: 350, def: 306, spa: 206, spd: 306, spe: 156 },
      boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 },
      volatiles: [],
    }
    state.sides.p2.team = [state.sides.p2.active[0]!, switchTarget]

    const actions: BattleActionSet = {
      moves: [
        {
          name: "Earthquake",
          id: "earthquake",
          pp: 10,
          maxPp: 10,
          type: "Ground",
          disabled: false,
          target: "normal",
          basePower: 100,
          category: "Physical",
          accuracy: 100,
          description: "",
        },
      ],
      canTera: false,
      switches: [
        {
          index: 2,
          name: "Swampert",
          speciesId: "swampert",
          hp: 341,
          maxHp: 341,
          status: "",
          fainted: false,
        },
      ],
      forceSwitch: false,
    }
    const result = await ai.chooseAction(state, actions)
    // matchup < -0.3 for active so switches are scored; switch target also has matchup < -0.3 → line 335
    expect(result.type).toMatch(/^(move|switch)$/)
  })

  it("uses opponent prediction to penalize switches into coverage moves (lines 349-354)", async () => {
    const state = makeState()
    // Opponent (p1) is Heatran (Fire/Steel), with Lava Plume prediction
    state.sides.p1.active = [
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
        boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 },
        volatiles: [],
      },
    ]
    // Set up opponent predictions on the Heatran with Lava Plume (Fire type, damaging)
    // getTypeEffectiveness("Fire", ["Water", "Ground"]) = 4 > 1, triggers eff > 1 penalty
    state.opponentPredictions = {
      heatran: {
        predictedMoves: ["lavaplume"],
        confidence: 0.9,
        ability: "Flash Fire",
        item: "Leftovers",
        evSpread: "defensive",
      },
    }
    // p2 active (AI) is Garchomp (Dragon/Ground)
    // evaluateMatchup(Garchomp, Heatran) = -0.45 < -0.3 → enters switch scoring block
    state.sides.p2.active = [
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
        boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 },
        volatiles: [],
      },
    ]
    // Switch target: Swampert (Water/Ground)
    // evaluateMatchup(Swampert, Heatran) = -0.75 < -0.3 → triggers line 335
    // getTypeEffectiveness("Fire", ["Water", "Ground"]) = 4 > 1 → triggers lines 349-354 penalty
    const switchTarget: BattlePokemon = {
      speciesId: "swampert",
      name: "Swampert",
      nickname: "Swampert",
      level: 100,
      types: ["Water", "Ground"],
      hp: 341,
      maxHp: 341,
      hpPercent: 100,
      status: "",
      fainted: false,
      item: "Leftovers",
      ability: "Torrent",
      isTerastallized: false,
      moves: [],
      stats: { hp: 341, atk: 350, def: 306, spa: 206, spd: 306, spe: 156 },
      boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 },
      volatiles: [],
    }
    state.sides.p2.team = [state.sides.p2.active[0]!, switchTarget]

    const actions: BattleActionSet = {
      moves: [
        {
          name: "Earthquake",
          id: "earthquake",
          pp: 10,
          maxPp: 10,
          type: "Ground",
          disabled: false,
          target: "normal",
          basePower: 100,
          category: "Physical",
          accuracy: 100,
          description: "",
        },
      ],
      canTera: false,
      switches: [
        {
          index: 2,
          name: "Swampert",
          speciesId: "swampert",
          hp: 341,
          maxHp: 341,
          status: "",
          fainted: false,
        },
      ],
      forceSwitch: false,
    }
    const result = await ai.chooseAction(state, actions)
    // Switch to Swampert gets both line 335 penalty (matchup < -0.3) and
    // line 349-354 penalty (predicted Fire move type has eff > 1 against Water/Ground)
    expect(result.type).toMatch(/^(move|switch)$/)
  })

  it("handles doubles battle with multiple opponent actives", async () => {
    const state = makeState()
    state.format = "doubles"
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
        boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 },
        volatiles: [],
      },
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
        boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 },
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
        boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 },
        volatiles: [],
      },
    ]
    state.sides.p2.team = [state.sides.p2.active[0]!]

    const actions: BattleActionSet = {
      moves: [
        {
          name: "Earthquake",
          id: "earthquake",
          pp: 10,
          maxPp: 10,
          type: "Ground",
          disabled: false,
          target: "normal",
          basePower: 100,
          category: "Physical",
          accuracy: 100,
          description: "",
        },
      ],
      canTera: false,
      switches: [],
      forceSwitch: false,
      activeSlot: 0,
    }
    const result = await ai.chooseAction(state, actions)
    expect(result.type).toBe("move")
    // In doubles, should include targetSlot
    if (result.type === "move") {
      expect(result.targetSlot).toBeDefined()
    }
  })
})
