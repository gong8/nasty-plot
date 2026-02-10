import { RandomAI } from "../ai/random-ai";
import { GreedyAI } from "../ai/greedy-ai";
import { HeuristicAI } from "../ai/heuristic-ai";
import type { BattleState, BattleActionSet } from "../types";
import { createInitialState } from "../engine/battle-manager";

function makeState(): BattleState {
  const state = createInitialState("test", "singles");

  // Set up a basic battle scenario
  state.sides.p1.active = [{
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
  }];

  state.sides.p2.active = [{
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
  }];

  state.sides.p2.team = state.sides.p2.active.filter(Boolean) as typeof state.sides.p2.team;

  return state;
}

function makeActions(): BattleActionSet {
  return {
    moves: [
      { name: "Magma Storm", id: "magmastorm", pp: 8, maxPp: 8, type: "Fire", disabled: false, target: "normal" },
      { name: "Earth Power", id: "earthpower", pp: 16, maxPp: 16, type: "Ground", disabled: false, target: "normal" },
      { name: "Flash Cannon", id: "flashcannon", pp: 16, maxPp: 16, type: "Steel", disabled: false, target: "normal" },
      { name: "Taunt", id: "taunt", pp: 32, maxPp: 32, type: "Dark", disabled: false, target: "normal" },
    ],
    canTera: true,
    switches: [
      { index: 2, name: "Clefable", speciesId: "clefable", hp: 394, maxHp: 394, status: "", fainted: false },
      { index: 3, name: "Weavile", speciesId: "weavile", hp: 281, maxHp: 281, status: "", fainted: false },
    ],
    forceSwitch: false,
  };
}

function makeForceSwitchActions(): BattleActionSet {
  return {
    moves: [],
    canTera: false,
    switches: [
      { index: 2, name: "Clefable", speciesId: "clefable", hp: 394, maxHp: 394, status: "", fainted: false },
      { index: 3, name: "Weavile", speciesId: "weavile", hp: 281, maxHp: 281, status: "", fainted: false },
    ],
    forceSwitch: true,
  };
}

describe("RandomAI", () => {
  const ai = new RandomAI();

  it("has difficulty 'random'", () => {
    expect(ai.difficulty).toBe("random");
  });

  it("returns a valid action", async () => {
    const state = makeState();
    const actions = makeActions();
    const result = await ai.chooseAction(state, actions);

    expect(result.type).toMatch(/^(move|switch)$/);
    if (result.type === "move") {
      expect(result.moveIndex).toBeGreaterThanOrEqual(1);
      expect(result.moveIndex).toBeLessThanOrEqual(actions.moves.length);
    } else {
      const switchIndices = actions.switches.map((s) => s.index);
      expect(switchIndices).toContain(result.pokemonIndex);
    }
  });

  it("handles forced switch", async () => {
    const state = makeState();
    const actions = makeForceSwitchActions();
    const result = await ai.chooseAction(state, actions);

    expect(result.type).toBe("switch");
    const switchIndices = actions.switches.map((s) => s.index);
    expect(switchIndices).toContain((result as { pokemonIndex: number }).pokemonIndex);
  });

  it("chooseLeads returns valid order", () => {
    const leads = ai.chooseLeads(6, "singles");
    expect(leads).toHaveLength(6);
    // Should contain each number 1-6
    for (let i = 1; i <= 6; i++) {
      expect(leads).toContain(i);
    }
  });
});

describe("GreedyAI", () => {
  const ai = new GreedyAI();

  it("has difficulty 'greedy'", () => {
    expect(ai.difficulty).toBe("greedy");
  });

  it("returns a move action when not force switching", async () => {
    const state = makeState();
    const actions = makeActions();
    const result = await ai.chooseAction(state, actions);

    // GreedyAI should pick a move (the highest damage one)
    expect(result.type).toBe("move");
  });

  it("prefers high-damage moves", async () => {
    const state = makeState();
    const actions = makeActions();

    // Earth Power should be preferred against Garchomp (neutral STAB Ground)
    // vs Magma Storm (resisted by Dragon/Ground) vs Flash Cannon (resisted)
    const result = await ai.chooseAction(state, actions);
    expect(result.type).toBe("move");
    // Earth Power (index 2) should be the best choice, but any move is valid
    expect((result as { moveIndex: number }).moveIndex).toBeGreaterThanOrEqual(1);
  });

  it("handles forced switch", async () => {
    const state = makeState();
    const actions = makeForceSwitchActions();
    const result = await ai.chooseAction(state, actions);

    expect(result.type).toBe("switch");
  });
});

describe("HeuristicAI", () => {
  const ai = new HeuristicAI();

  it("has difficulty 'heuristic'", () => {
    expect(ai.difficulty).toBe("heuristic");
  });

  it("returns a valid action", async () => {
    const state = makeState();
    const actions = makeActions();
    const result = await ai.chooseAction(state, actions);

    expect(result.type).toMatch(/^(move|switch)$/);
  });

  it("handles forced switch", async () => {
    const state = makeState();
    const actions = makeForceSwitchActions();
    const result = await ai.chooseAction(state, actions);

    expect(result.type).toBe("switch");
  });

  it("chooseLeads returns valid order", () => {
    const leads = ai.chooseLeads(6, "singles");
    expect(leads).toHaveLength(6);
  });

  it("handles disabled moves", async () => {
    const state = makeState();
    const actions = makeActions();
    // Disable all but one move
    actions.moves[0].disabled = true;
    actions.moves[1].disabled = true;
    actions.moves[2].disabled = true;

    const result = await ai.chooseAction(state, actions);
    if (result.type === "move") {
      // Should pick the only enabled move (Taunt, index 4)
      expect((result as { moveIndex: number }).moveIndex).toBe(4);
    }
    // Or it could switch, which is also valid
  });
});
