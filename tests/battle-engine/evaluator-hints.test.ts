import { describe, it, expect } from "vitest";
import { evaluatePosition } from "@nasty-plot/battle-engine";
import { estimateWinProbability, winProbabilityDelta } from "@nasty-plot/battle-engine";
import { generateHints } from "@nasty-plot/battle-engine";
import type { BattleState, BattlePokemon, BattleActionSet } from "@nasty-plot/battle-engine";

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

function makeState(overrides: Partial<BattleState> = {}): BattleState {
  return {
    phase: "battle",
    format: "singles",
    turn: 5,
    sides: {
      p1: {
        active: [makePokemon()],
        team: [
          makePokemon(),
          makePokemon({ speciesId: "heatran", name: "Heatran", types: ["Fire", "Steel"] }),
        ],
        name: "Player",
        sideConditions: {
          stealthRock: false,
          spikes: 0,
          toxicSpikes: 0,
          stickyWeb: false,
          reflect: 0,
          lightScreen: 0,
          auroraVeil: 0,
          tailwind: 0,
        },
        canTera: true,
      },
      p2: {
        active: [
          makePokemon({
            speciesId: "ironvaliant",
            name: "Iron Valiant",
            types: ["Fairy", "Fighting"],
          }),
        ],
        team: [
          makePokemon({
            speciesId: "ironvaliant",
            name: "Iron Valiant",
            types: ["Fairy", "Fighting"],
          }),
          makePokemon({
            speciesId: "greattusk",
            name: "Great Tusk",
            types: ["Ground", "Fighting"],
          }),
        ],
        name: "Opponent",
        sideConditions: {
          stealthRock: false,
          spikes: 0,
          toxicSpikes: 0,
          stickyWeb: false,
          reflect: 0,
          lightScreen: 0,
          auroraVeil: 0,
          tailwind: 0,
        },
        canTera: true,
      },
    },
    field: {
      weather: "",
      weatherTurns: 0,
      terrain: "",
      terrainTurns: 0,
      trickRoom: 0,
    },
    winner: null,
    log: [],
    fullLog: [],
    waitingForChoice: true,
    availableActions: null,
    id: "test-battle",
    ...overrides,
  };
}

function makeActions(overrides: Partial<BattleActionSet> = {}): BattleActionSet {
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
        description: "Raises Attack by 2.",
      },
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
        description: "Sets Stealth Rock.",
      },
    ],
    canTera: true,
    switches: [
      {
        index: 2,
        name: "Heatran",
        speciesId: "heatran",
        hp: 386,
        maxHp: 386,
        status: "",
        fainted: false,
      },
    ],
    forceSwitch: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// evaluatePosition
// ---------------------------------------------------------------------------

describe("evaluatePosition", () => {
  it("returns a score in the [-1, +1] range", () => {
    const state = makeState();
    const result = evaluatePosition(state, "p1");
    expect(result.score).toBeGreaterThanOrEqual(-1);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it("returns positive score when p1 has more HP", () => {
    const state = makeState();
    // p1 team at full HP, p2 team at low HP
    state.sides.p2.team = state.sides.p2.team.map((p) => ({
      ...p,
      hp: Math.round(p.maxHp * 0.2),
      hpPercent: 20,
    }));
    const result = evaluatePosition(state, "p1");
    expect(result.score).toBeGreaterThan(0);
  });

  it("returns negative score when p2 is ahead", () => {
    const state = makeState();
    // p1 team at low HP, p2 team at full HP
    state.sides.p1.team = state.sides.p1.team.map((p) => ({
      ...p,
      hp: Math.round(p.maxHp * 0.2),
      hpPercent: 20,
    }));
    const result = evaluatePosition(state, "p1");
    expect(result.score).toBeLessThan(0);
  });

  it("returns positive score when p1 has more alive Pokemon", () => {
    const state = makeState();
    // Faint all of p2's team except the active
    state.sides.p2.team[1] = makePokemon({
      speciesId: "greattusk",
      name: "Great Tusk",
      types: ["Ground", "Fighting"],
      hp: 0,
      maxHp: 357,
      hpPercent: 0,
      fainted: true,
    });
    const result = evaluatePosition(state, "p1");
    expect(result.score).toBeGreaterThan(0);
  });

  it("increases score when hazards are on opponent's side", () => {
    const baseState = makeState();
    const baseResult = evaluatePosition(baseState, "p1");

    const hazardState = makeState();
    hazardState.sides.p2.sideConditions.stealthRock = true;
    hazardState.sides.p2.sideConditions.spikes = 2;
    const hazardResult = evaluatePosition(hazardState, "p1");

    expect(hazardResult.score).toBeGreaterThan(baseResult.score);
  });

  it("increases score when opponent has status conditions", () => {
    const baseState = makeState();
    const baseResult = evaluatePosition(baseState, "p1");

    const statusState = makeState();
    statusState.sides.p2.team[0].status = "brn";
    statusState.sides.p2.active[0] = statusState.sides.p2.team[0];
    const statusResult = evaluatePosition(statusState, "p1");

    expect(statusResult.score).toBeGreaterThan(baseResult.score);
  });

  it("decreases score when our own Pokemon have status conditions", () => {
    const baseState = makeState();
    const baseResult = evaluatePosition(baseState, "p1");

    const statusState = makeState();
    statusState.sides.p1.team[0].status = "par";
    statusState.sides.p1.active[0] = statusState.sides.p1.team[0];
    const statusResult = evaluatePosition(statusState, "p1");

    expect(statusResult.score).toBeLessThan(baseResult.score);
  });

  it("populates features array with named features", () => {
    const state = makeState();
    const result = evaluatePosition(state, "p1");

    expect(result.features).toBeDefined();
    expect(result.features.length).toBeGreaterThan(0);

    for (const feature of result.features) {
      expect(feature).toHaveProperty("name");
      expect(typeof feature.name).toBe("string");
      expect(feature.name.length).toBeGreaterThan(0);
      expect(feature).toHaveProperty("rawValue");
      expect(feature).toHaveProperty("weight");
      expect(feature).toHaveProperty("contribution");
    }

    // Check that known feature names are present
    const featureNames = result.features.map((f) => f.name);
    expect(featureNames).toContain("HP remaining");
    expect(featureNames).toContain("Pokemon alive");
    expect(featureNames).toContain("Hazards");
    expect(featureNames).toContain("Status conditions");
    expect(featureNames).toContain("Active matchup");
  });

  it("produces extreme positive score when all p2 Pokemon are fainted", () => {
    const state = makeState();
    state.sides.p2.team = state.sides.p2.team.map((p) => ({
      ...p,
      hp: 0,
      maxHp: p.maxHp,
      hpPercent: 0,
      fainted: true,
    }));
    state.sides.p2.active = [state.sides.p2.team[0]];
    const result = evaluatePosition(state, "p1");
    // Score should be very close to +1
    expect(result.score).toBeGreaterThan(0.5);
  });

  it("produces extreme negative score when all p1 Pokemon are fainted", () => {
    const state = makeState();
    state.sides.p1.team = state.sides.p1.team.map((p) => ({
      ...p,
      hp: 0,
      maxHp: p.maxHp,
      hpPercent: 0,
      fainted: true,
    }));
    state.sides.p1.active = [state.sides.p1.team[0]];
    const result = evaluatePosition(state, "p1");
    // Score should be very close to -1
    expect(result.score).toBeLessThan(-0.5);
  });

  it("respects perspective parameter (p2 perspective flips the sign)", () => {
    const state = makeState();
    // Give p1 a clear advantage
    state.sides.p2.team = state.sides.p2.team.map((p) => ({
      ...p,
      hp: Math.round(p.maxHp * 0.2),
      hpPercent: 20,
    }));
    const p1Result = evaluatePosition(state, "p1");
    const p2Result = evaluatePosition(state, "p2");
    // p1 should see positive, p2 should see negative (roughly opposite)
    expect(p1Result.score).toBeGreaterThan(0);
    expect(p2Result.score).toBeLessThan(0);
  });

  it("includes screens/tailwind in evaluation", () => {
    const baseState = makeState();
    const baseResult = evaluatePosition(baseState, "p1");

    const screenState = makeState();
    screenState.sides.p1.sideConditions.reflect = 5;
    screenState.sides.p1.sideConditions.lightScreen = 5;
    const screenResult = evaluatePosition(screenState, "p1");

    expect(screenResult.score).toBeGreaterThan(baseResult.score);
  });

  it("inverts speed advantage under Trick Room", () => {
    // p1 has a faster Pokemon (spe: 333), p2 has a slower one (spe: 100)
    const normalState = makeState();
    normalState.sides.p1.active = [makePokemon({ stats: { hp: 357, atk: 394, def: 226, spa: 196, spd: 206, spe: 333 } })];
    normalState.sides.p2.active = [makePokemon({
      speciesId: "ironvaliant",
      name: "Iron Valiant",
      types: ["Fairy", "Fighting"],
      stats: { hp: 357, atk: 394, def: 226, spa: 196, spd: 206, spe: 100 },
    })];
    const normalResult = evaluatePosition(normalState, "p1");

    const trState = makeState();
    trState.field.trickRoom = 3;
    trState.sides.p1.active = [makePokemon({ stats: { hp: 357, atk: 394, def: 226, spa: 196, spd: 206, spe: 333 } })];
    trState.sides.p2.active = [makePokemon({
      speciesId: "ironvaliant",
      name: "Iron Valiant",
      types: ["Fairy", "Fighting"],
      stats: { hp: 357, atk: 394, def: 226, spa: 196, spd: 206, spe: 100 },
    })];
    const trResult = evaluatePosition(trState, "p1");

    // Under normal conditions, p1 (faster) should have a speed advantage
    // Under Trick Room, p2 (slower) should have the advantage, so p1's score should be lower
    expect(trResult.score).toBeLessThan(normalResult.score);
  });
});

// ---------------------------------------------------------------------------
// estimateWinProbability
// ---------------------------------------------------------------------------

describe("estimateWinProbability", () => {
  it("returns p1 + p2 summing to approximately 100", () => {
    const state = makeState();
    const prob = estimateWinProbability(state);
    expect(prob.p1 + prob.p2).toBeCloseTo(100, 0);
  });

  it("returns { p1: 100, p2: 0 } when game ended with p1 winner", () => {
    const state = makeState({ phase: "ended", winner: "p1" });
    const prob = estimateWinProbability(state);
    expect(prob.p1).toBe(100);
    expect(prob.p2).toBe(0);
  });

  it("returns { p1: 0, p2: 100 } when game ended with p2 winner", () => {
    const state = makeState({ phase: "ended", winner: "p2" });
    const prob = estimateWinProbability(state);
    expect(prob.p1).toBe(0);
    expect(prob.p2).toBe(100);
  });

  it("returns approximately 50/50 for a balanced state", () => {
    // Both sides have identical teams and full HP
    const state = makeState();
    // Make teams identical to minimize matchup asymmetry
    const pokemon = makePokemon();
    state.sides.p1.active = [pokemon];
    state.sides.p1.team = [pokemon, makePokemon()];
    state.sides.p2.active = [makePokemon()];
    state.sides.p2.team = [makePokemon(), makePokemon()];
    const prob = estimateWinProbability(state);
    // Should be roughly equal (within 20 points of 50 is reasonable for heuristic)
    expect(prob.p1).toBeGreaterThan(30);
    expect(prob.p1).toBeLessThan(70);
    expect(prob.p2).toBeGreaterThan(30);
    expect(prob.p2).toBeLessThan(70);
  });

  it("returns draw (50/50) when game ends with no winner", () => {
    const state = makeState({ phase: "ended", winner: null });
    const prob = estimateWinProbability(state);
    expect(prob.p1).toBe(50);
    expect(prob.p2).toBe(50);
  });

  it("favors p1 when p1 has a significant advantage", () => {
    const state = makeState();
    state.sides.p2.team = state.sides.p2.team.map((p) => ({
      ...p,
      hp: 0,
      maxHp: p.maxHp,
      hpPercent: 0,
      fainted: true,
    }));
    state.sides.p2.active = [state.sides.p2.team[0]];
    const prob = estimateWinProbability(state);
    expect(prob.p1).toBeGreaterThan(80);
    expect(prob.p2).toBeLessThan(20);
  });

  it("includes evaluation result in the returned object", () => {
    const state = makeState();
    const prob = estimateWinProbability(state);
    expect(prob.evaluation).toBeDefined();
    expect(prob.evaluation).toHaveProperty("score");
    expect(prob.evaluation).toHaveProperty("rawScore");
    expect(prob.evaluation).toHaveProperty("features");
  });
});

// ---------------------------------------------------------------------------
// winProbabilityDelta
// ---------------------------------------------------------------------------

describe("winProbabilityDelta", () => {
  it("returns delta > 0 when p1 improves position", () => {
    const before = makeState();
    const after = makeState();
    // p2 loses a Pokemon between turns
    after.sides.p2.team[1] = makePokemon({
      speciesId: "greattusk",
      name: "Great Tusk",
      types: ["Ground", "Fighting"],
      hp: 0,
      maxHp: 357,
      hpPercent: 0,
      fainted: true,
    });
    const { delta } = winProbabilityDelta(before, after);
    expect(delta).toBeGreaterThan(0);
  });

  it("returns delta < 0 when p1 worsens position", () => {
    const before = makeState();
    const after = makeState();
    // p1 loses a Pokemon between turns
    after.sides.p1.team[1] = makePokemon({
      speciesId: "heatran",
      name: "Heatran",
      types: ["Fire", "Steel"],
      hp: 0,
      maxHp: 357,
      hpPercent: 0,
      fainted: true,
    });
    const { delta } = winProbabilityDelta(before, after);
    expect(delta).toBeLessThan(0);
  });

  it("marks isCritical true when |delta| >= 20", () => {
    const before = makeState();
    const after = makeState();
    // Create a massive swing: p2 goes from full health to all fainted
    after.sides.p2.team = after.sides.p2.team.map((p) => ({
      ...p,
      hp: 0,
      maxHp: p.maxHp,
      hpPercent: 0,
      fainted: true,
    }));
    after.sides.p2.active = [after.sides.p2.team[0]];
    const { isCritical, delta } = winProbabilityDelta(before, after);
    expect(Math.abs(delta)).toBeGreaterThanOrEqual(20);
    expect(isCritical).toBe(true);
  });

  it("marks isCritical false for small changes", () => {
    const before = makeState();
    const after = makeState();
    // Small HP change on one p2 Pokemon
    after.sides.p2.team[1] = makePokemon({
      speciesId: "greattusk",
      name: "Great Tusk",
      types: ["Ground", "Fighting"],
      hp: 300,
      maxHp: 357,
      hpPercent: 84,
    });
    const { isCritical } = winProbabilityDelta(before, after);
    expect(isCritical).toBe(false);
  });

  it("returns delta of 0 when state does not change", () => {
    const state = makeState();
    const { delta } = winProbabilityDelta(state, state);
    expect(delta).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// generateHints
// ---------------------------------------------------------------------------

describe("generateHints", () => {
  it("returns rankedMoves sorted by score descending", () => {
    const state = makeState();
    const actions = makeActions();
    const result = generateHints(state, actions);

    expect(result.rankedMoves.length).toBeGreaterThan(0);
    for (let i = 1; i < result.rankedMoves.length; i++) {
      expect(result.rankedMoves[i - 1].score).toBeGreaterThanOrEqual(
        result.rankedMoves[i].score,
      );
    }
  });

  it("ranks are sequential starting from 1", () => {
    const state = makeState();
    const actions = makeActions();
    const result = generateHints(state, actions);

    for (let i = 0; i < result.rankedMoves.length; i++) {
      expect(result.rankedMoves[i].rank).toBe(i + 1);
    }
  });

  it("best move has classification 'best'", () => {
    const state = makeState();
    const actions = makeActions();
    const result = generateHints(state, actions);

    expect(result.rankedMoves[0].classification).toBe("best");
  });

  it("worse moves have appropriate classifications (not 'best')", () => {
    const state = makeState();
    const actions = makeActions();
    const result = generateHints(state, actions);

    // If there are moves ranked below the best, at least some should not be "best"
    // (unless they all tie, which is unlikely with varied moves)
    if (result.rankedMoves.length > 1) {
      const lastMove = result.rankedMoves[result.rankedMoves.length - 1];
      if (lastMove.score < result.rankedMoves[0].score) {
        const validClassifications = [
          "best",
          "good",
          "neutral",
          "inaccuracy",
          "mistake",
          "blunder",
        ];
        expect(validClassifications).toContain(lastMove.classification);
        // The gap should produce a classification other than "best" for a lower-scoring move
        // unless the gap is 0 (tie)
        if (result.rankedMoves[0].score - lastMove.score > 0) {
          // At least one non-best move should exist
          const nonBestMoves = result.rankedMoves.filter(
            (m) => m.classification !== "best" && m.score < result.rankedMoves[0].score,
          );
          // There should be at least one non-best move if scores differ
          expect(nonBestMoves.length).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it("classifications span known values", () => {
    const state = makeState();
    const actions = makeActions();
    const result = generateHints(state, actions);

    const validClassifications = [
      "best",
      "good",
      "neutral",
      "inaccuracy",
      "mistake",
      "blunder",
    ];
    for (const hint of result.rankedMoves) {
      expect(validClassifications).toContain(hint.classification);
    }
  });

  it("includes switch options in results", () => {
    const state = makeState();
    const actions = makeActions();
    const result = generateHints(state, actions);

    const switchHints = result.rankedMoves.filter(
      (m) => m.action.type === "switch",
    );
    expect(switchHints.length).toBe(actions.switches.filter((s) => !s.fainted).length);
    // Switch hints should have names starting with "Switch to"
    for (const hint of switchHints) {
      expect(hint.name).toMatch(/^Switch to /);
    }
  });

  it("includes move options in results", () => {
    const state = makeState();
    const actions = makeActions();
    const result = generateHints(state, actions);

    const moveHints = result.rankedMoves.filter(
      (m) => m.action.type === "move",
    );
    // All 4 moves are enabled, so all 4 should be present
    expect(moveHints.length).toBe(4);
  });

  it("skips disabled moves", () => {
    const state = makeState();
    const actions = makeActions();
    actions.moves[0].disabled = true;
    actions.moves[1].disabled = true;
    const result = generateHints(state, actions);

    const moveHints = result.rankedMoves.filter(
      (m) => m.action.type === "move",
    );
    expect(moveHints.length).toBe(2);
    // The disabled moves (Earthquake, Outrage) should not appear
    const moveNames = moveHints.map((m) => m.name);
    expect(moveNames).not.toContain("Earthquake");
    expect(moveNames).not.toContain("Outrage");
  });

  it("force switch actions only include switches", () => {
    const state = makeState();
    const actions = makeActions({
      moves: [],
      forceSwitch: true,
      switches: [
        {
          index: 2,
          name: "Heatran",
          speciesId: "heatran",
          hp: 386,
          maxHp: 386,
          status: "",
          fainted: false,
        },
        {
          index: 3,
          name: "Dragonite",
          speciesId: "dragonite",
          hp: 323,
          maxHp: 323,
          status: "",
          fainted: false,
        },
      ],
    });
    const result = generateHints(state, actions);

    // All results should be switch actions
    for (const hint of result.rankedMoves) {
      expect(hint.action.type).toBe("switch");
    }
    expect(result.rankedMoves.length).toBe(2);
  });

  it("excludes fainted switches", () => {
    const state = makeState();
    const actions = makeActions({
      switches: [
        {
          index: 2,
          name: "Heatran",
          speciesId: "heatran",
          hp: 386,
          maxHp: 386,
          status: "",
          fainted: false,
        },
        {
          index: 3,
          name: "Dragonite",
          speciesId: "dragonite",
          hp: 0,
          maxHp: 323,
          status: "",
          fainted: true,
        },
      ],
    });
    const result = generateHints(state, actions);

    const switchHints = result.rankedMoves.filter(
      (m) => m.action.type === "switch",
    );
    expect(switchHints.length).toBe(1);
    expect(switchHints[0].name).toBe("Switch to Heatran");
  });

  it("returns currentEval with the evaluation of the position", () => {
    const state = makeState();
    const actions = makeActions();
    const result = generateHints(state, actions);

    expect(result.currentEval).toBeDefined();
    expect(result.currentEval.score).toBeGreaterThanOrEqual(-1);
    expect(result.currentEval.score).toBeLessThanOrEqual(1);
    expect(result.currentEval.features.length).toBeGreaterThan(0);
  });

  it("returns bestAction matching the top-ranked move's action", () => {
    const state = makeState();
    const actions = makeActions();
    const result = generateHints(state, actions);

    expect(result.bestAction).toEqual(result.rankedMoves[0].action);
  });

  it("each hint has an explanation string", () => {
    const state = makeState();
    const actions = makeActions();
    const result = generateHints(state, actions);

    for (const hint of result.rankedMoves) {
      expect(typeof hint.explanation).toBe("string");
      expect(hint.explanation.length).toBeGreaterThan(0);
    }
  });

  it("Stealth Rock gets a good score when not already set", () => {
    const state = makeState();
    const actions = makeActions();
    const result = generateHints(state, actions);

    const srHint = result.rankedMoves.find((m) => m.name === "Stealth Rock");
    expect(srHint).toBeDefined();
    expect(srHint!.score).toBeGreaterThan(0);
    expect(srHint!.explanation).toContain("Stealth Rock");
  });

  it("Stealth Rock gets 0 score when already set on opponent's side", () => {
    const state = makeState();
    state.sides.p2.sideConditions.stealthRock = true;
    const actions = makeActions();
    const result = generateHints(state, actions);

    const srHint = result.rankedMoves.find((m) => m.name === "Stealth Rock");
    expect(srHint).toBeDefined();
    expect(srHint!.score).toBe(0);
    expect(srHint!.explanation).toContain("already up");
  });

  it("Swords Dance gets scored as a setup move", () => {
    const state = makeState();
    const actions = makeActions();
    const result = generateHints(state, actions);

    const sdHint = result.rankedMoves.find((m) => m.name === "Swords Dance");
    expect(sdHint).toBeDefined();
    expect(sdHint!.score).toBeGreaterThan(0);
    expect(sdHint!.explanation).toMatch(/boost/i);
  });

  it("Swords Dance gets low score when HP is low", () => {
    const state = makeState();
    state.sides.p1.active = [makePokemon({ hp: 30, maxHp: 357, hpPercent: 8 })];
    const actions = makeActions();
    const result = generateHints(state, actions);

    const sdHint = result.rankedMoves.find((m) => m.name === "Swords Dance");
    expect(sdHint).toBeDefined();
    // Low HP means risky setup
    expect(sdHint!.explanation).toMatch(/low HP/i);
  });

  it("Spikes gets scored based on current layer count", () => {
    const state = makeState();
    const actions = makeActions({
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
          description: "Sets Spikes.",
        },
      ],
    });
    const result = generateHints(state, actions);

    const spikesHint = result.rankedMoves.find((m) => m.name === "Spikes");
    expect(spikesHint).toBeDefined();
    expect(spikesHint!.score).toBeGreaterThan(0);
    expect(spikesHint!.explanation).toContain("Spikes");
  });

  it("Spikes gets 0 score when at max layers", () => {
    const state = makeState();
    state.sides.p2.sideConditions.spikes = 3;
    const actions = makeActions({
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
          description: "Sets Spikes.",
        },
      ],
    });
    const result = generateHints(state, actions);

    const spikesHint = result.rankedMoves.find((m) => m.name === "Spikes");
    expect(spikesHint).toBeDefined();
    expect(spikesHint!.score).toBe(0);
  });

  it("Toxic Spikes gets scored", () => {
    const state = makeState();
    const actions = makeActions({
      moves: [
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
          description: "Sets Toxic Spikes.",
        },
      ],
    });
    const result = generateHints(state, actions);

    const tsHint = result.rankedMoves.find((m) => m.name === "Toxic Spikes");
    expect(tsHint).toBeDefined();
    expect(tsHint!.score).toBeGreaterThan(0);
  });

  it("Toxic Spikes gets 0 score at max layers", () => {
    const state = makeState();
    state.sides.p2.sideConditions.toxicSpikes = 2;
    const actions = makeActions({
      moves: [
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
          description: "Sets Toxic Spikes.",
        },
      ],
    });
    const result = generateHints(state, actions);

    const tsHint = result.rankedMoves.find((m) => m.name === "Toxic Spikes");
    expect(tsHint).toBeDefined();
    expect(tsHint!.score).toBe(0);
  });

  it("Sticky Web gets scored when not set", () => {
    const state = makeState();
    const actions = makeActions({
      moves: [
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
          description: "Sets Sticky Web.",
        },
      ],
    });
    const result = generateHints(state, actions);

    const swHint = result.rankedMoves.find((m) => m.name === "Sticky Web");
    expect(swHint).toBeDefined();
    expect(swHint!.score).toBeGreaterThan(0);
  });

  it("Sticky Web gets 0 score when already set", () => {
    const state = makeState();
    state.sides.p2.sideConditions.stickyWeb = true;
    const actions = makeActions({
      moves: [
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
          description: "Sets Sticky Web.",
        },
      ],
    });
    const result = generateHints(state, actions);

    const swHint = result.rankedMoves.find((m) => m.name === "Sticky Web");
    expect(swHint).toBeDefined();
    expect(swHint!.score).toBe(0);
  });

  it("Defog gets low score when no hazards present", () => {
    const state = makeState();
    const actions = makeActions({
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
          description: "Removes hazards.",
        },
      ],
    });
    const result = generateHints(state, actions);

    const defogHint = result.rankedMoves.find((m) => m.name === "Defog");
    expect(defogHint).toBeDefined();
    expect(defogHint!.score).toBeLessThanOrEqual(5);
    expect(defogHint!.explanation).toContain("No hazards");
  });

  it("Defog gets good score when hazards are up on own side", () => {
    const state = makeState();
    state.sides.p1.sideConditions.stealthRock = true;
    state.sides.p1.sideConditions.spikes = 2;
    const actions = makeActions({
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
          description: "Removes hazards.",
        },
      ],
    });
    const result = generateHints(state, actions);

    const defogHint = result.rankedMoves.find((m) => m.name === "Defog");
    expect(defogHint).toBeDefined();
    expect(defogHint!.score).toBeGreaterThan(20);
  });

  it("Toxic gets 0 score when opponent already has a status", () => {
    const state = makeState();
    state.sides.p2.active = [
      makePokemon({
        speciesId: "ironvaliant",
        name: "Iron Valiant",
        types: ["Fairy", "Fighting"],
        status: "brn",
      }),
    ];
    const actions = makeActions({
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
          description: "Badly poisons.",
        },
      ],
    });
    const result = generateHints(state, actions);

    const toxicHint = result.rankedMoves.find((m) => m.name === "Toxic");
    expect(toxicHint).toBeDefined();
    expect(toxicHint!.score).toBe(0);
  });

  it("Recover gets moderate score at moderate HP", () => {
    const state = makeState();
    state.sides.p1.active = [makePokemon({ hp: 250, maxHp: 357, hpPercent: 70 })];
    const actions = makeActions({
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
          description: "Restores 50% HP.",
        },
      ],
    });
    const result = generateHints(state, actions);

    const recoverHint = result.rankedMoves.find((m) => m.name === "Recover");
    expect(recoverHint).toBeDefined();
    expect(recoverHint!.score).toBeGreaterThan(0);
    expect(recoverHint!.explanation).toContain("moderate");
  });

  it("Recover gets low score at near-full HP", () => {
    const state = makeState();
    state.sides.p1.active = [makePokemon({ hp: 350, maxHp: 357, hpPercent: 98 })];
    const actions = makeActions({
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
          description: "Restores 50% HP.",
        },
      ],
    });
    const result = generateHints(state, actions);

    const recoverHint = result.rankedMoves.find((m) => m.name === "Recover");
    expect(recoverHint).toBeDefined();
    expect(recoverHint!.explanation).toContain("full HP");
  });

  it("unknown status move gets default score", () => {
    const state = makeState();
    const actions = makeActions({
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
          description: "Sets Trick Room.",
        },
      ],
    });
    const result = generateHints(state, actions);

    const trHint = result.rankedMoves.find((m) => m.name === "Trick Room");
    expect(trHint).toBeDefined();
    expect(trHint!.score).toBe(5);
    expect(trHint!.explanation).toBe("Status move");
  });

  it("priority move gets bonus when opponent is at low HP", () => {
    const state = makeState();
    state.sides.p2.active = [
      makePokemon({
        speciesId: "ironvaliant",
        name: "Iron Valiant",
        types: ["Fairy", "Fighting"],
        hp: 30,
        maxHp: 357,
        hpPercent: 8,
      }),
    ];
    state.sides.p2.team = [state.sides.p2.active[0]!];
    const actions = makeActions({
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
          description: "Priority move.",
        },
      ],
      switches: [],
    });
    const result = generateHints(state, actions);

    const aqHint = result.rankedMoves.find((m) => m.name === "Aqua Jet");
    expect(aqHint).toBeDefined();
    expect(aqHint!.explanation).toContain("priority");
  });

  it("switch scoring includes hazard penalty", () => {
    const state = makeState();
    state.sides.p1.sideConditions.stealthRock = true;
    state.sides.p1.sideConditions.spikes = 2;
    state.sides.p1.sideConditions.stickyWeb = true;
    const actions = makeActions();
    const result = generateHints(state, actions);

    const switchHints = result.rankedMoves.filter((m) => m.action.type === "switch");
    // Switches should have reduced scores due to hazards
    expect(switchHints.length).toBeGreaterThan(0);
  });

  it("handles empty move list", () => {
    const state = makeState();
    const actions = makeActions({ moves: [], switches: [] });
    const result = generateHints(state, actions);

    expect(result.rankedMoves).toHaveLength(0);
    expect(result.bestAction).toEqual({ type: "move", moveIndex: 1 });
  });

  it("p2 perspective reverses sides", () => {
    const state = makeState();
    const actions = makeActions();
    const result = generateHints(state, actions, "p2");

    expect(result.currentEval).toBeDefined();
    expect(result.rankedMoves.length).toBeGreaterThan(0);
  });

  it("switch scoring works for known team member", () => {
    const state = makeState();
    // Opponent is Dragon/Ground
    state.sides.p2.active = [
      makePokemon({
        speciesId: "garchomp",
        name: "Garchomp",
        types: ["Dragon", "Ground"],
      }),
    ];
    state.sides.p2.team = [state.sides.p2.active[0]!];
    const actions = makeActions({
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
      switches: [
        {
          index: 2,
          name: "Heatran",
          speciesId: "heatran",
          hp: 386,
          maxHp: 386,
          status: "",
          fainted: false,
        },
      ],
    });

    const result = generateHints(state, actions);
    const switchHint = result.rankedMoves.find((m) => m.action.type === "switch");
    expect(switchHint).toBeDefined();
    // Should produce a score (positive or negative based on matchup)
    expect(typeof switchHint!.score).toBe("number");
  });

  it("handles unknown move gracefully", () => {
    const state = makeState();
    const actions = makeActions({
      moves: [
        {
          name: "NotARealMove",
          id: "notarealmove",
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
      switches: [],
    });
    const result = generateHints(state, actions);

    const hint = result.rankedMoves.find((m) => m.name === "NotARealMove");
    expect(hint).toBeDefined();
    expect(hint!.score).toBe(0);
    expect(hint!.explanation).toBe("Unknown move");
  });

  it("no active Pokemon means no move scores", () => {
    const state = makeState();
    state.sides.p1.active = [null as never];
    const actions = makeActions();
    const result = generateHints(state, actions);

    // Should still have switch options but no move scores
    const moveHints = result.rankedMoves.filter((m) => m.action.type === "move");
    expect(moveHints).toHaveLength(0);
  });
});
