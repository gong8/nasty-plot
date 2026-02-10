import { runAutomatedBattle } from "../simulation/automated-battle-manager";
import type { AIPlayer, BattleAction, BattleState } from "../types";

// Shared mock stream instance so tests can configure it
let mockStreamInstance: {
  write: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  [Symbol.asyncIterator]: ReturnType<typeof vi.fn>;
};

vi.mock("@pkmn/sim", () => {
  return {
    BattleStreams: {
      BattleStream: class MockBattleStream {
        write = vi.fn();
        destroy = vi.fn();
        [Symbol.asyncIterator]() {
          return mockStreamInstance[Symbol.asyncIterator]();
        }
        constructor() {
          mockStreamInstance.write = this.write;
          mockStreamInstance.destroy = this.destroy;
        }
      },
    },
    Teams: {
      import: vi.fn((paste: string) => {
        if (!paste || paste.trim() === "") return null;
        return [{ species: "Garchomp", ability: "Rough Skin", moves: ["earthquake"] }];
      }),
      pack: vi.fn(() => "Garchomp|||roughskin|earthquake|||||||"),
    },
  };
});

function makeEndedState(): BattleState {
  return {
    phase: "ended",
    format: "singles",
    turn: 0,
    sides: {
      p1: {
        active: [null], team: [], name: "Player",
        sideConditions: { stealthRock: false, spikes: 0, toxicSpikes: 0, stickyWeb: false, reflect: 0, lightScreen: 0, auroraVeil: 0, tailwind: 0 },
        canTera: true,
      },
      p2: {
        active: [null], team: [], name: "Opponent",
        sideConditions: { stealthRock: false, spikes: 0, toxicSpikes: 0, stickyWeb: false, reflect: 0, lightScreen: 0, auroraVeil: 0, tailwind: 0 },
        canTera: true,
      },
    },
    field: { weather: "", weatherTurns: 0, terrain: "", terrainTurns: 0, trickRoom: 0 },
    winner: null,
    log: [],
    fullLog: [],
    waitingForChoice: false,
    availableActions: null,
    id: "auto-battle",
  };
}

// Default: return state with phase "ended" so the main loop exits immediately
vi.mock("../battle-manager", () => ({
  createInitialState: vi.fn(() => makeEndedState()),
}));

vi.mock("../protocol-parser", () => ({
  processChunk: vi.fn(() => []),
  parseRequest: vi.fn(() => ({
    actions: null,
    teamPreview: false,
    wait: true,
  })),
  updateSideFromRequest: vi.fn(),
}));

function createMockAI(): AIPlayer {
  return {
    difficulty: "random",
    chooseAction: vi.fn(async () => ({ type: "move", moveIndex: 1 }) as BattleAction),
    chooseLeads: vi.fn(() => [1, 2, 3, 4, 5, 6]),
  };
}

/** Set up the mock stream to produce no output (immediate end) */
function setupEmptyStream() {
  mockStreamInstance[Symbol.asyncIterator] = vi.fn(() => ({
    next: vi.fn().mockResolvedValue({ done: true, value: undefined }),
  }));
}

describe("runAutomatedBattle", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockStreamInstance = {
      write: vi.fn(),
      destroy: vi.fn(),
      [Symbol.asyncIterator]: vi.fn(() => ({
        next: vi.fn().mockResolvedValue({ done: true, value: undefined }),
      })),
    };
    // Re-set the default mock to return ended state
    const { createInitialState } = await import("../battle-manager");
    vi.mocked(createInitialState).mockReturnValue(makeEndedState());
  });

  it("throws if team pastes cannot be parsed", async () => {
    const { Teams } = await import("@pkmn/sim");
    vi.mocked(Teams.import).mockReturnValue(null);
    setupEmptyStream();

    const ai1 = createMockAI();
    const ai2 = createMockAI();

    await expect(
      runAutomatedBattle({
        formatId: "gen9ou",
        gameType: "singles",
        team1Paste: "Garchomp\nAbility: Rough Skin\nEVs: 252 Atk\n- Earthquake",
        team2Paste: "Heatran\nAbility: Flash Fire\nEVs: 252 SpA\n- Magma Storm",
        ai1,
        ai2,
      })
    ).rejects.toThrow("Failed to parse team pastes");
  });

  it("returns a draw when state has no winner", async () => {
    setupEmptyStream();

    const ai1 = createMockAI();
    const ai2 = createMockAI();

    const result = await runAutomatedBattle({
      formatId: "gen9ou",
      gameType: "singles",
      team1Paste: "Garchomp|||roughskin|earthquake|||||||",
      team2Paste: "Heatran|||flashfire|magmastorm|||||||",
      ai1,
      ai2,
      maxTurns: 1,
    });

    expect(result.winner).toBe("draw");
    expect(result.team1Paste).toBe("Garchomp|||roughskin|earthquake|||||||");
    expect(result.team2Paste).toBe("Heatran|||flashfire|magmastorm|||||||");
    expect(result.protocolLog).toBeDefined();
    expect(result.turnActions).toBeDefined();
    expect(result.finalState).toBeDefined();
  });

  it("accepts pre-packed team format (no newlines)", async () => {
    setupEmptyStream();

    const ai1 = createMockAI();
    const ai2 = createMockAI();

    const packedTeam = "Garchomp|||roughskin|earthquake|||||||";

    const result = await runAutomatedBattle({
      formatId: "gen9ou",
      gameType: "singles",
      team1Paste: packedTeam,
      team2Paste: packedTeam,
      ai1,
      ai2,
      maxTurns: 1,
    });

    expect(result).toBeDefined();
    expect(result.winner).toBe("draw");
  });

  it("uses default team names when not provided", async () => {
    setupEmptyStream();

    const ai1 = createMockAI();
    const ai2 = createMockAI();

    const result = await runAutomatedBattle({
      formatId: "gen9ou",
      gameType: "singles",
      team1Paste: "packed|team",
      team2Paste: "packed|team",
      ai1,
      ai2,
      maxTurns: 1,
    });

    expect(result.finalState.sides.p1.name).toBe("Team 1");
    expect(result.finalState.sides.p2.name).toBe("Team 2");
  });

  it("uses custom team names when provided", async () => {
    setupEmptyStream();

    const ai1 = createMockAI();
    const ai2 = createMockAI();

    const result = await runAutomatedBattle({
      formatId: "gen9ou",
      gameType: "singles",
      team1Paste: "packed|team",
      team2Paste: "packed|team",
      team1Name: "Alpha",
      team2Name: "Beta",
      ai1,
      ai2,
      maxTurns: 1,
    });

    expect(result.finalState.sides.p1.name).toBe("Alpha");
    expect(result.finalState.sides.p2.name).toBe("Beta");
  });

  it("handles no maxTurns specified without error", async () => {
    setupEmptyStream();

    const ai1 = createMockAI();
    const ai2 = createMockAI();

    const result = await runAutomatedBattle({
      formatId: "gen9ou",
      gameType: "singles",
      team1Paste: "packed|team",
      team2Paste: "packed|team",
      ai1,
      ai2,
    });

    expect(result).toBeDefined();
  });

  it("records p1 as winner when state.winner is p1", async () => {
    const { createInitialState } = await import("../battle-manager");
    const state = makeEndedState();
    state.winner = "p1";
    state.turn = 5;
    vi.mocked(createInitialState).mockReturnValue(state);
    setupEmptyStream();

    const ai1 = createMockAI();
    const ai2 = createMockAI();

    const result = await runAutomatedBattle({
      formatId: "gen9ou",
      gameType: "singles",
      team1Paste: "packed|team",
      team2Paste: "packed|team",
      ai1,
      ai2,
      maxTurns: 1,
    });

    expect(result.winner).toBe("p1");
    expect(result.turnCount).toBe(5);
  });

  it("records p2 as winner when state.winner is p2", async () => {
    const { createInitialState } = await import("../battle-manager");
    const state = makeEndedState();
    state.winner = "p2";
    state.turn = 10;
    vi.mocked(createInitialState).mockReturnValue(state);
    setupEmptyStream();

    const ai1 = createMockAI();
    const ai2 = createMockAI();

    const result = await runAutomatedBattle({
      formatId: "gen9ou",
      gameType: "singles",
      team1Paste: "packed|team",
      team2Paste: "packed|team",
      ai1,
      ai2,
      maxTurns: 1,
    });

    expect(result.winner).toBe("p2");
    expect(result.turnCount).toBe(10);
  });

  it("calls stream.destroy during cleanup", async () => {
    setupEmptyStream();

    const ai1 = createMockAI();
    const ai2 = createMockAI();

    await runAutomatedBattle({
      formatId: "gen9ou",
      gameType: "singles",
      team1Paste: "packed|team",
      team2Paste: "packed|team",
      ai1,
      ai2,
      maxTurns: 1,
    });

    expect(mockStreamInstance.destroy).toHaveBeenCalled();
  });

  it("writes start and player commands to stream", async () => {
    setupEmptyStream();

    const ai1 = createMockAI();
    const ai2 = createMockAI();

    await runAutomatedBattle({
      formatId: "gen9ou",
      gameType: "singles",
      team1Paste: "packed|team",
      team2Paste: "packed|team",
      ai1,
      ai2,
      maxTurns: 1,
    });

    const writeCalls = mockStreamInstance.write.mock.calls.map((c: string[]) => c[0]);
    expect(writeCalls.some((c: string) => c.includes(">start"))).toBe(true);
    expect(writeCalls.some((c: string) => c.includes(">player p1"))).toBe(true);
    expect(writeCalls.some((c: string) => c.includes(">player p2"))).toBe(true);
  });

  it("returns turnCount from state.turn", async () => {
    setupEmptyStream();

    const ai1 = createMockAI();
    const ai2 = createMockAI();

    const result = await runAutomatedBattle({
      formatId: "gen9ou",
      gameType: "singles",
      team1Paste: "packed|team",
      team2Paste: "packed|team",
      ai1,
      ai2,
      maxTurns: 1,
    });

    expect(result.turnCount).toBe(result.finalState.turn);
  });

  it("includes format in start command", async () => {
    setupEmptyStream();

    const ai1 = createMockAI();
    const ai2 = createMockAI();

    await runAutomatedBattle({
      formatId: "gen9uu",
      gameType: "singles",
      team1Paste: "packed|team",
      team2Paste: "packed|team",
      ai1,
      ai2,
      maxTurns: 1,
    });

    const writeCalls = mockStreamInstance.write.mock.calls.map((c: string[]) => c[0]);
    const startCmd = writeCalls.find((c: string) => c.includes(">start"));
    expect(startCmd).toContain("gen9uu");
  });

  it("returns empty turnActions when no actions occur", async () => {
    setupEmptyStream();

    const ai1 = createMockAI();
    const ai2 = createMockAI();

    const result = await runAutomatedBattle({
      formatId: "gen9ou",
      gameType: "singles",
      team1Paste: "packed|team",
      team2Paste: "packed|team",
      ai1,
      ai2,
      maxTurns: 1,
    });

    expect(result.turnActions).toEqual([]);
  });
});
