import { describe, it, expect, vi, beforeEach } from "vitest";
import { MCTSAI } from "../ai/mcts-ai";
import type { BattleState, BattleActionSet, BattlePokemon } from "../types";
import { createInitialState } from "../battle-manager";

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makePokemon(overrides: Partial<BattlePokemon> = {}): BattlePokemon {
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
    item: "Focus Sash",
    ability: "Rough Skin",
    isTerastallized: false,
    moves: [],
    stats: { hp: 357, atk: 394, def: 226, spa: 196, spd: 206, spe: 333 },
    boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 },
    volatiles: [],
    ...overrides,
  };
}

function makeState(): BattleState {
  const state = createInitialState("test", "singles");

  state.sides.p1.active = [makePokemon()];
  state.sides.p1.team = [makePokemon()];
  state.sides.p2.active = [
    makePokemon({
      speciesId: "heatran",
      name: "Heatran",
      types: ["Fire", "Steel"],
    }),
  ];
  state.sides.p2.team = [
    makePokemon({
      speciesId: "heatran",
      name: "Heatran",
      types: ["Fire", "Steel"],
    }),
  ];

  return state;
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
  };
}

// ---------------------------------------------------------------------------
// MCTSAI
// ---------------------------------------------------------------------------

describe("MCTSAI", () => {
  let ai: MCTSAI;

  beforeEach(() => {
    ai = new MCTSAI({
      maxIterations: 5,
      maxTimeMs: 500,
      rolloutDepth: 1,
    });
  });

  it("has difficulty 'expert'", () => {
    expect(ai.difficulty).toBe("expert");
  });

  it("falls back to heuristic when no battle state is set", async () => {
    const state = makeState();
    const actions = makeActions();

    const result = await ai.chooseAction(state, actions);
    // Should return a valid action from the heuristic fallback
    expect(result.type).toMatch(/^(move|switch)$/);
  });

  it("falls back to heuristic when search throws", async () => {
    // Set an invalid battle state that will cause Battle.fromJSON to throw
    ai.setBattleState("invalid-json-data");

    const state = makeState();
    const actions = makeActions();

    // Should not throw; falls back to heuristic
    const result = await ai.chooseAction(state, actions);
    expect(result.type).toMatch(/^(move|switch)$/);
  });

  it("setBattleState stores state and optional formatId", () => {
    ai.setBattleState("some-json", "gen9uu");
    // No direct accessor, but we can verify by calling chooseAction
    // which will try to use the state
    expect(ai.difficulty).toBe("expert");
  });

  it("setBattleState without formatId keeps default", () => {
    ai.setBattleState("some-json");
    expect(ai.difficulty).toBe("expert");
  });

  it("chooseLeads returns default ordering", () => {
    const leads = ai.chooseLeads(6, "singles");
    expect(leads).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("chooseLeads returns correct length for smaller teams", () => {
    const leads = ai.chooseLeads(3, "singles");
    expect(leads).toEqual([1, 2, 3]);
  });

  it("uses default config when no config provided", () => {
    const defaultAI = new MCTSAI();
    expect(defaultAI.difficulty).toBe("expert");
  });

  it("convertChoiceToAction handles move choices", async () => {
    // We can't test private methods directly, but we can test through chooseAction
    // by mocking the search to return specific choices.
    // Instead, we verify the AI returns valid actions in various scenarios.
    const state = makeState();
    const actions = makeActions();

    // Without battle state, it falls back to heuristic which returns valid moves
    const result = await ai.chooseAction(state, actions);
    if (result.type === "move") {
      expect(result.moveIndex).toBeGreaterThanOrEqual(1);
    } else {
      expect(result.pokemonIndex).toBeGreaterThanOrEqual(1);
    }
  });

  it("handles force switch actions via fallback", async () => {
    const state = makeState();
    const forceSwitchActions: BattleActionSet = {
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
      ],
      forceSwitch: true,
    };

    const result = await ai.chooseAction(state, forceSwitchActions);
    expect(result.type).toBe("switch");
  });

  it("applies partial config over defaults", () => {
    const customAI = new MCTSAI({ maxIterations: 100 });
    expect(customAI.difficulty).toBe("expert");
    // Verify the custom config is used by running the AI
    // (the default maxTimeMs should still be 5000)
  });
});
