import { runBatchSimulation } from "@nasty-plot/battle-engine"
import type { BatchSimConfig, BatchSimProgress } from "@nasty-plot/battle-engine"
import type { SingleBattleResult } from "@nasty-plot/battle-engine"
import type { BattleState } from "@nasty-plot/battle-engine"
import { DEFAULT_LEVEL } from "@nasty-plot/core"

// Mock the automated battle manager
vi.mock("#battle-engine/simulation/automated-battle-manager", () => ({
  runAutomatedBattle: vi.fn(),
}))

// Mock AI classes - must use class syntax for `new` to work
vi.mock("#battle-engine/ai/random-ai", () => ({
  RandomAI: class {
    difficulty = "random"
    chooseAction = vi.fn()
    chooseLeads = vi.fn(() => [1, 2, 3, 4, 5, 6])
  },
}))

vi.mock("#battle-engine/ai/greedy-ai", () => ({
  GreedyAI: class {
    difficulty = "greedy"
    chooseAction = vi.fn()
    chooseLeads = vi.fn(() => [1, 2, 3, 4, 5, 6])
  },
}))

vi.mock("#battle-engine/ai/heuristic-ai", () => ({
  HeuristicAI: class {
    difficulty = "heuristic"
    chooseAction = vi.fn()
    chooseLeads = vi.fn(() => [1, 2, 3, 4, 5, 6])
  },
}))

vi.mock("#battle-engine/ai/mcts-ai", () => ({
  MCTSAI: class {
    difficulty = "expert"
    chooseAction = vi.fn()
    chooseLeads = vi.fn(() => [1, 2, 3, 4, 5, 6])
  },
}))

function makeMockFinalState(overrides?: Partial<BattleState>): BattleState {
  return {
    phase: "ended",
    format: "singles",
    turn: 20,
    sides: {
      p1: {
        active: [null],
        team: [
          {
            pokemonId: "garchomp",
            name: "Garchomp",
            nickname: "Garchomp",
            level: DEFAULT_LEVEL,
            types: ["Dragon", "Ground"],
            hp: 200,
            maxHp: 319,
            hpPercent: 63,
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
          {
            pokemonId: "clefable",
            name: "Clefable",
            nickname: "Clefable",
            level: DEFAULT_LEVEL,
            types: ["Fairy"],
            hp: 0,
            maxHp: 394,
            hpPercent: 0,
            status: "",
            fainted: true,
            item: "Leftovers",
            ability: "Magic Guard",
            isTerastallized: false,
            moves: [],
            stats: { hp: 394, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
            boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 },
            volatiles: [],
          },
        ],
        name: "Team 1",
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
        active: [null],
        team: [
          {
            pokemonId: "heatran",
            name: "Heatran",
            nickname: "Heatran",
            level: DEFAULT_LEVEL,
            types: ["Fire", "Steel"],
            hp: 0,
            maxHp: 311,
            hpPercent: 0,
            status: "",
            fainted: true,
            item: "Leftovers",
            ability: "Flash Fire",
            isTerastallized: false,
            moves: [],
            stats: { hp: 311, atk: 194, def: 248, spa: 394, spd: 248, spe: 169 },
            boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 },
            volatiles: [],
          },
        ],
        name: "Team 2",
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
    field: { weather: "", weatherTurns: 0, terrain: "", terrainTurns: 0, trickRoom: 0 },
    winner: "p1",
    log: [],
    fullLog: [],
    waitingForChoice: false,
    availableActions: null,
    id: "batch-test",
    ...overrides,
  }
}

function makeMockResult(
  winner: "p1" | "p2" | "draw",
  turnCount: number,
  state?: BattleState,
): SingleBattleResult {
  return {
    winner,
    turnCount,
    protocolLog: "",
    team1Paste: "team1",
    team2Paste: "team2",
    turnActions: [],
    finalState:
      state ?? makeMockFinalState({ winner: winner === "draw" ? null : winner, turn: turnCount }),
  }
}

function makeBaseConfig(overrides?: Partial<BatchSimConfig>): BatchSimConfig {
  return {
    formatId: "gen9ou",
    gameType: "singles",
    team1Paste: "Garchomp|||roughskin|earthquake|||||||",
    team2Paste: "Heatran|||flashfire|magmastorm|||||||",
    aiDifficulty: "random",
    totalGames: 3,
    concurrency: 1,
    ...overrides,
  }
}

describe("runBatchSimulation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("runs the correct number of games and returns results", async () => {
    const { runAutomatedBattle } =
      await import("#battle-engine/simulation/automated-battle-manager")
    vi.mocked(runAutomatedBattle)
      .mockResolvedValueOnce(makeMockResult("p1", 15))
      .mockResolvedValueOnce(makeMockResult("p2", 20))
      .mockResolvedValueOnce(makeMockResult("p1", 10))

    const config = makeBaseConfig({ totalGames: 3 })
    const { results, analytics } = await runBatchSimulation(config)

    expect(runAutomatedBattle).toHaveBeenCalledTimes(3)
    expect(results).toHaveLength(3)
    expect(analytics.team1WinRate).toBeCloseTo(66.7, 0)
    expect(analytics.team2WinRate).toBeCloseTo(33.3, 0)
    expect(analytics.drawRate).toBe(0)
  })

  it("computes correct turn count statistics", async () => {
    const { runAutomatedBattle } =
      await import("#battle-engine/simulation/automated-battle-manager")
    vi.mocked(runAutomatedBattle)
      .mockResolvedValueOnce(makeMockResult("p1", 10))
      .mockResolvedValueOnce(makeMockResult("p1", 30))
      .mockResolvedValueOnce(makeMockResult("p2", 20))

    const config = makeBaseConfig({ totalGames: 3 })
    const { analytics } = await runBatchSimulation(config)

    expect(analytics.minTurnCount).toBe(10)
    expect(analytics.maxTurnCount).toBe(30)
    expect(analytics.avgTurnCount).toBe(20)
  })

  it("calculates turn distribution bucketed by 5s", async () => {
    const { runAutomatedBattle } =
      await import("#battle-engine/simulation/automated-battle-manager")
    vi.mocked(runAutomatedBattle)
      .mockResolvedValueOnce(makeMockResult("p1", 7))
      .mockResolvedValueOnce(makeMockResult("p1", 8))
      .mockResolvedValueOnce(makeMockResult("p2", 15))

    const config = makeBaseConfig({ totalGames: 3 })
    const { analytics } = await runBatchSimulation(config)

    expect(analytics.turnDistribution[5]).toBe(2)
    expect(analytics.turnDistribution[15]).toBe(1)
  })

  it("reports progress via onProgress callback", async () => {
    const { runAutomatedBattle } =
      await import("#battle-engine/simulation/automated-battle-manager")
    vi.mocked(runAutomatedBattle)
      .mockResolvedValueOnce(makeMockResult("p1", 10))
      .mockResolvedValueOnce(makeMockResult("p2", 20))

    const progressUpdates: BatchSimProgress[] = []
    const config = makeBaseConfig({ totalGames: 2 })
    await runBatchSimulation(config, (progress) => {
      progressUpdates.push({ ...progress })
    })

    expect(progressUpdates.length).toBe(2)
    expect(progressUpdates[progressUpdates.length - 1].completed).toBe(2)
    expect(progressUpdates[progressUpdates.length - 1].total).toBe(2)
  })

  it("counts failed games as draws", async () => {
    const { runAutomatedBattle } =
      await import("#battle-engine/simulation/automated-battle-manager")
    vi.mocked(runAutomatedBattle)
      .mockRejectedValueOnce(new Error("Sim crashed"))
      .mockResolvedValueOnce(makeMockResult("p1", 15))

    const config = makeBaseConfig({ totalGames: 2 })
    const { analytics } = await runBatchSimulation(config)

    expect(analytics.drawRate).toBeGreaterThan(0)
    expect(analytics.team1WinRate).toBe(50)
  })

  it("gathers per-pokemon stats from final states", async () => {
    const { runAutomatedBattle } =
      await import("#battle-engine/simulation/automated-battle-manager")
    vi.mocked(runAutomatedBattle)
      .mockResolvedValueOnce(makeMockResult("p1", 15))
      .mockResolvedValueOnce(makeMockResult("p1", 20))

    const config = makeBaseConfig({ totalGames: 2 })
    const { analytics } = await runBatchSimulation(config)

    expect(analytics.pokemonStats.length).toBeGreaterThan(0)

    const garchomp = analytics.pokemonStats.find((p) => p.pokemonId === "garchomp")
    expect(garchomp).toBeDefined()
    expect(garchomp!.gamesAppeared).toBe(2)

    const clefable = analytics.pokemonStats.find((p) => p.pokemonId === "clefable")
    expect(clefable).toBeDefined()
    expect(clefable!.totalFaints).toBe(2)

    const heatran = analytics.pokemonStats.find((p) => p.pokemonId === "heatran")
    expect(heatran).toBeDefined()
    expect(heatran!.totalFaints).toBe(2)
  })

  it("handles all wins going to p2", async () => {
    const { runAutomatedBattle } =
      await import("#battle-engine/simulation/automated-battle-manager")
    vi.mocked(runAutomatedBattle)
      .mockResolvedValueOnce(makeMockResult("p2", 10))
      .mockResolvedValueOnce(makeMockResult("p2", 15))

    const config = makeBaseConfig({ totalGames: 2 })
    const { analytics } = await runBatchSimulation(config)

    expect(analytics.team1WinRate).toBe(0)
    expect(analytics.team2WinRate).toBe(100)
    expect(analytics.drawRate).toBe(0)
  })

  it("handles all draws", async () => {
    const { runAutomatedBattle } =
      await import("#battle-engine/simulation/automated-battle-manager")
    vi.mocked(runAutomatedBattle)
      .mockResolvedValueOnce(makeMockResult("draw", 300))
      .mockResolvedValueOnce(makeMockResult("draw", 300))

    const config = makeBaseConfig({ totalGames: 2 })
    const { analytics } = await runBatchSimulation(config)

    expect(analytics.team1WinRate).toBe(0)
    expect(analytics.team2WinRate).toBe(0)
    expect(analytics.drawRate).toBe(100)
  })

  it("uses correct AI for each difficulty level", async () => {
    const { runAutomatedBattle } =
      await import("#battle-engine/simulation/automated-battle-manager")
    vi.mocked(runAutomatedBattle).mockResolvedValue(makeMockResult("p1", 10))

    for (const difficulty of ["random", "greedy", "heuristic", "expert"] as const) {
      vi.mocked(runAutomatedBattle).mockClear()
      const config = makeBaseConfig({ totalGames: 1, aiDifficulty: difficulty })
      await runBatchSimulation(config)

      const lastCall = vi.mocked(runAutomatedBattle).mock.lastCall
      expect(lastCall).toBeDefined()
      expect(lastCall![0].ai1).toBeDefined()
      expect(lastCall![0].ai2).toBeDefined()
      expect(lastCall![0].ai1.difficulty).toBe(difficulty)
      expect(lastCall![0].ai2.difficulty).toBe(difficulty)
    }
  })

  it("defaults concurrency to 4 when not specified", async () => {
    const { runAutomatedBattle } =
      await import("#battle-engine/simulation/automated-battle-manager")
    vi.mocked(runAutomatedBattle).mockResolvedValue(makeMockResult("p1", 10))

    const config = makeBaseConfig({ totalGames: 1 })
    delete (config as Partial<BatchSimConfig>).concurrency

    const { results } = await runBatchSimulation(config)
    expect(results).toHaveLength(1)
  })

  it("handles zero-length results gracefully (all games fail)", async () => {
    const { runAutomatedBattle } =
      await import("#battle-engine/simulation/automated-battle-manager")
    vi.mocked(runAutomatedBattle).mockRejectedValue(new Error("crash"))

    const config = makeBaseConfig({ totalGames: 2 })
    const { analytics } = await runBatchSimulation(config)

    expect(analytics.avgTurnCount).toBe(0)
    expect(analytics.minTurnCount).toBe(0)
    expect(analytics.maxTurnCount).toBe(0)
    expect(analytics.drawRate).toBe(100)
  })

  it("passes maxTurns of 300 to runAutomatedBattle", async () => {
    const { runAutomatedBattle } =
      await import("#battle-engine/simulation/automated-battle-manager")
    vi.mocked(runAutomatedBattle).mockResolvedValue(makeMockResult("p1", 10))

    const config = makeBaseConfig({ totalGames: 1 })
    await runBatchSimulation(config)

    const callArgs = vi.mocked(runAutomatedBattle).mock.calls[0][0]
    expect(callArgs.maxTurns).toBe(300)
  })

  it("passes format and team config through to runAutomatedBattle", async () => {
    const { runAutomatedBattle } =
      await import("#battle-engine/simulation/automated-battle-manager")
    vi.mocked(runAutomatedBattle).mockResolvedValue(makeMockResult("p1", 10))

    const config = makeBaseConfig({
      totalGames: 1,
      formatId: "gen9uu",
      gameType: "doubles",
      team1Name: "Alpha",
      team2Name: "Beta",
    })
    await runBatchSimulation(config)

    const callArgs = vi.mocked(runAutomatedBattle).mock.calls[0][0]
    expect(callArgs.formatId).toBe("gen9uu")
    expect(callArgs.gameType).toBe("doubles")
    expect(callArgs.team1Name).toBe("Alpha")
    expect(callArgs.team2Name).toBe("Beta")
  })
})
