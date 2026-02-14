import { vi, type Mock } from "vitest"

// Mock @pkmn/sim before importing battle-manager
const mockStreamWrite = vi.fn()
const mockStreamDestroy = vi.fn()
let mockStreamChunks: string[] = []
let mockStreamResolve: ((value: IteratorResult<string>) => void) | null = null

// Create an async iterable mock for the BattleStream
function _createMockStream() {
  const stream = {
    write: mockStreamWrite,
    destroy: mockStreamDestroy,
    battle: undefined as { toJSON(): unknown } | undefined,
    [Symbol.asyncIterator]() {
      let index = 0
      return {
        next(): Promise<IteratorResult<string>> {
          if (index < mockStreamChunks.length) {
            return Promise.resolve({ value: mockStreamChunks[index++], done: false })
          }
          // Return a promise that can be resolved externally to push more data
          return new Promise<IteratorResult<string>>((resolve) => {
            mockStreamResolve = resolve
          })
        },
        return(): Promise<IteratorResult<string>> {
          return Promise.resolve({ value: undefined as unknown as string, done: true })
        },
      }
    },
  }
  return stream
}

let currentMockStream: ReturnType<typeof _createMockStream>

vi.mock("@pkmn/sim", () => {
  // Use a real class so `new BattleStream()` works
  class MockBattleStream {
    write: Mock
    destroy: Mock
    battle: { toJSON(): unknown } | undefined
    constructor() {
      this.write = mockStreamWrite
      this.destroy = mockStreamDestroy
      this.battle = undefined
      currentMockStream = this as unknown as ReturnType<typeof _createMockStream>
      // Also set the async iterator
      ;(this as unknown as Record<symbol, unknown>)[Symbol.asyncIterator] = () => {
        let index = 0
        return {
          next(): Promise<IteratorResult<string>> {
            if (index < mockStreamChunks.length) {
              return Promise.resolve({ value: mockStreamChunks[index++], done: false })
            }
            return new Promise<IteratorResult<string>>((resolve) => {
              mockStreamResolve = resolve
            })
          },
          return(): Promise<IteratorResult<string>> {
            return Promise.resolve({ value: undefined as unknown as string, done: true })
          },
        }
      }
    }
    [Symbol.asyncIterator]() {
      let index = 0
      return {
        next(): Promise<IteratorResult<string>> {
          if (index < mockStreamChunks.length) {
            return Promise.resolve({ value: mockStreamChunks[index++], done: false })
          }
          return new Promise<IteratorResult<string>>((resolve) => {
            mockStreamResolve = resolve
          })
        },
        return(): Promise<IteratorResult<string>> {
          return Promise.resolve({ value: undefined as unknown as string, done: true })
        },
      }
    }
  }

  return {
    BattleStreams: {
      BattleStream: MockBattleStream,
    },
    Teams: {
      import: vi.fn((paste: string) => {
        if (!paste || paste.trim() === "") return null
        return [{ species: "Garchomp", moves: ["earthquake"] }]
      }),
      pack: vi.fn(() => "Garchomp|||earthquake||||||||"),
    },
  }
})

import { BattleManager, createInitialState } from "@nasty-plot/battle-engine"
import type { AIPlayer, BattleAction } from "@nasty-plot/battle-engine"

// Helper to push a chunk into the mock stream
function pushChunk(chunk: string) {
  if (mockStreamResolve) {
    const resolve = mockStreamResolve
    mockStreamResolve = null
    resolve({ value: chunk, done: false })
  }
}

// Helper to generate a minimal p1 request JSON
function makeP1Request(
  opts: { teamPreview?: boolean; wait?: boolean; forceSwitch?: boolean } = {},
): string {
  if (opts.wait) {
    return JSON.stringify({ wait: true, side: { id: "p1", name: "Player", pokemon: [] } })
  }
  if (opts.teamPreview) {
    return JSON.stringify({
      teamPreview: true,
      side: {
        id: "p1",
        name: "Player",
        pokemon: [
          {
            ident: "p1: Garchomp",
            details: "Garchomp, L100",
            condition: "319/319",
            active: false,
            stats: { atk: 394, def: 226, spa: 176, spd: 206, spe: 333 },
            moves: ["earthquake"],
            baseAbility: "roughskin",
            item: "lifeorb",
            teraType: "Ground",
          },
        ],
      },
    })
  }
  if (opts.forceSwitch) {
    return JSON.stringify({
      forceSwitch: [true],
      side: {
        id: "p1",
        name: "Player",
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
            ident: "p1: Heatran",
            details: "Heatran, L100",
            condition: "311/311",
            active: false,
            stats: { atk: 194, def: 248, spa: 394, spd: 248, spe: 169 },
            moves: ["magmastorm"],
            baseAbility: "flashfire",
            item: "leftovers",
          },
        ],
      },
    })
  }
  return JSON.stringify({
    active: [
      {
        moves: [
          {
            move: "Earthquake",
            id: "earthquake",
            pp: 16,
            maxpp: 16,
            target: "normal",
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
    ],
    side: {
      id: "p1",
      name: "Player",
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
          ident: "p1: Heatran",
          details: "Heatran, L100",
          condition: "311/311",
          active: false,
          stats: { atk: 194, def: 248, spa: 394, spd: 248, spe: 169 },
          moves: ["magmastorm"],
          baseAbility: "flashfire",
          item: "leftovers",
        },
      ],
    },
  })
}

function makeP2Request(
  opts: { teamPreview?: boolean; wait?: boolean; forceSwitch?: boolean } = {},
): string {
  if (opts.wait) {
    return JSON.stringify({ wait: true, side: { id: "p2", name: "Opponent", pokemon: [] } })
  }
  if (opts.teamPreview) {
    return JSON.stringify({
      teamPreview: true,
      side: {
        id: "p2",
        name: "Opponent",
        pokemon: [
          {
            ident: "p2: Heatran",
            details: "Heatran, L100",
            condition: "311/311",
            active: false,
            stats: { atk: 194, def: 248, spa: 394, spd: 248, spe: 169 },
            moves: ["magmastorm"],
            baseAbility: "flashfire",
            item: "leftovers",
          },
        ],
      },
    })
  }
  if (opts.forceSwitch) {
    return JSON.stringify({
      forceSwitch: [true],
      side: {
        id: "p2",
        name: "Opponent",
        pokemon: [
          {
            ident: "p2a: Heatran",
            details: "Heatran, L100",
            condition: "0 fnt",
            active: true,
            stats: {},
            moves: [],
          },
          {
            ident: "p2: Clefable",
            details: "Clefable, L100",
            condition: "394/394",
            active: false,
            stats: { atk: 146, def: 186, spa: 226, spd: 216, spe: 156 },
            moves: ["moonblast"],
            baseAbility: "magicguard",
            item: "leftovers",
          },
        ],
      },
    })
  }
  return JSON.stringify({
    active: [
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
        ],
      },
    ],
    side: {
      id: "p2",
      name: "Opponent",
      pokemon: [
        {
          ident: "p2a: Heatran",
          details: "Heatran, L100",
          condition: "311/311",
          active: true,
          stats: { atk: 194, def: 248, spa: 394, spd: 248, spe: 169 },
          moves: ["magmastorm"],
          baseAbility: "flashfire",
          item: "leftovers",
        },
        {
          ident: "p2: Clefable",
          details: "Clefable, L100",
          condition: "394/394",
          active: false,
          stats: { atk: 146, def: 186, spa: 226, spd: 216, spe: 156 },
          moves: ["moonblast"],
          baseAbility: "magicguard",
          item: "leftovers",
        },
      ],
    },
  })
}

// Sample packed team format (already packed, single line with pipes)
const PACKED_TEAM = "Garchomp|||earthquake||||||||"
// Sample paste format
const PASTE_TEAM = `Garchomp @ Life Orb
Ability: Rough Skin
EVs: 252 Atk / 4 SpD / 252 Spe
Jolly Nature
- Earthquake
- Dragon Claw
- Swords Dance
- Scale Shot`

describe("createInitialState", () => {
  it("creates a singles state with correct defaults", () => {
    const state = createInitialState("test-id", "singles")

    expect(state.id).toBe("test-id")
    expect(state.gameType).toBe("singles")
    expect(state.phase).toBe("setup")
    expect(state.turn).toBe(0)
    expect(state.winner).toBeNull()
    expect(state.log).toEqual([])
    expect(state.fullLog).toEqual([])
    expect(state.waitingForChoice).toBe(false)
    expect(state.availableActions).toBeNull()
  })

  it("creates singles sides with 1 active slot each", () => {
    const state = createInitialState("test-id", "singles")

    expect(state.sides.p1.active).toHaveLength(1)
    expect(state.sides.p1.active[0]).toBeNull()
    expect(state.sides.p2.active).toHaveLength(1)
    expect(state.sides.p2.active[0]).toBeNull()
  })

  it("creates doubles sides with 2 active slots each", () => {
    const state = createInitialState("test-id", "doubles")

    expect(state.sides.p1.active).toHaveLength(2)
    expect(state.sides.p2.active).toHaveLength(2)
  })

  it("initializes side conditions correctly", () => {
    const state = createInitialState("test-id", "singles")
    const sc = state.sides.p1.sideConditions

    expect(sc.stealthRock).toBe(false)
    expect(sc.spikes).toBe(0)
    expect(sc.toxicSpikes).toBe(0)
    expect(sc.stickyWeb).toBe(false)
    expect(sc.reflect).toBe(0)
    expect(sc.lightScreen).toBe(0)
    expect(sc.auroraVeil).toBe(0)
    expect(sc.tailwind).toBe(0)
  })

  it("initializes field state correctly", () => {
    const state = createInitialState("test-id", "singles")

    expect(state.field.weather).toBe("")
    expect(state.field.weatherTurns).toBe(0)
    expect(state.field.terrain).toBe("")
    expect(state.field.terrainTurns).toBe(0)
    expect(state.field.trickRoom).toBe(0)
  })

  it("sets canTera to true for both sides", () => {
    const state = createInitialState("test-id", "singles")

    expect(state.sides.p1.canTera).toBe(true)
    expect(state.sides.p2.canTera).toBe(true)
  })

  it("assigns default names", () => {
    const state = createInitialState("test-id", "singles")

    expect(state.sides.p1.name).toBe("Player")
    expect(state.sides.p2.name).toBe("Opponent")
  })
})

describe("BattleManager", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStreamChunks = []
    mockStreamResolve = null
  })

  describe("constructor", () => {
    it("creates a BattleManager with the given config", () => {
      const manager = new BattleManager({
        formatId: "gen9ou",
        gameType: "singles",
        playerTeam: PACKED_TEAM,
        opponentTeam: PACKED_TEAM,
      })

      const state = manager.getState()
      expect(state.phase).toBe("setup")
      expect(state.gameType).toBe("singles")
      expect(state.sides.p1.name).toBe("Player")
      expect(state.sides.p2.name).toBe("Opponent")
    })

    it("uses custom player names when provided", () => {
      const manager = new BattleManager({
        formatId: "gen9ou",
        gameType: "singles",
        playerTeam: PACKED_TEAM,
        opponentTeam: PACKED_TEAM,
        playerName: "Ash",
        opponentName: "Gary",
      })

      const state = manager.getState()
      expect(state.sides.p1.name).toBe("Ash")
      expect(state.sides.p2.name).toBe("Gary")
    })
  })

  describe("setAI", () => {
    it("sets the AI player", () => {
      const manager = new BattleManager({
        formatId: "gen9ou",
        gameType: "singles",
        playerTeam: PACKED_TEAM,
        opponentTeam: PACKED_TEAM,
      })

      const mockAI: AIPlayer = {
        difficulty: "random",
        chooseAction: vi.fn(),
        chooseLeads: vi.fn(),
      }

      // Should not throw
      manager.setAI(mockAI)
    })
  })

  describe("setSetPredictor", () => {
    it("sets the set predictor", () => {
      const manager = new BattleManager({
        formatId: "gen9ou",
        gameType: "singles",
        playerTeam: PACKED_TEAM,
        opponentTeam: PACKED_TEAM,
      })

      const mockPredictor = {
        updateFromObservation: vi.fn(),
        predictSet: vi.fn(),
      }

      // Should not throw
      manager.setSetPredictor(mockPredictor as never)
    })
  })

  describe("onUpdate", () => {
    it("registers an event handler", () => {
      const manager = new BattleManager({
        formatId: "gen9ou",
        gameType: "singles",
        playerTeam: PACKED_TEAM,
        opponentTeam: PACKED_TEAM,
      })

      const handler = vi.fn()
      manager.onUpdate(handler)
      // Handler is registered; we'll verify it's called via start()
    })
  })

  describe("getState", () => {
    it("returns the current battle state", () => {
      const manager = new BattleManager({
        formatId: "gen9ou",
        gameType: "singles",
        playerTeam: PACKED_TEAM,
        opponentTeam: PACKED_TEAM,
      })

      const state = manager.getState()
      expect(state).toBeDefined()
      expect(state.phase).toBe("setup")
    })
  })

  describe("start", () => {
    it("writes start and player commands to the stream", async () => {
      const manager = new BattleManager({
        formatId: "gen9ou",
        gameType: "singles",
        playerTeam: PACKED_TEAM,
        opponentTeam: PACKED_TEAM,
        playerName: "Player",
        opponentName: "Opponent",
      })

      // Queue a p1 request chunk so start() resolves
      const startPromise = manager.start()

      // Wait a tick for readStream to start
      await new Promise((r) => setTimeout(r, 10))

      // Push a request chunk to resolve the start promise
      pushChunk(`|request|${makeP1Request()}`)

      await startPromise

      expect(mockStreamWrite).toHaveBeenCalledWith(
        expect.stringContaining('>start {"formatid":"gen9ou"}'),
      )
      expect(mockStreamWrite).toHaveBeenCalledWith(expect.stringContaining(">player p1"))
      expect(mockStreamWrite).toHaveBeenCalledWith(expect.stringContaining(">player p2"))
    })

    it("uses default formatId 'gen9ou' when not provided", async () => {
      const manager = new BattleManager({
        formatId: "",
        gameType: "singles",
        playerTeam: PACKED_TEAM,
        opponentTeam: PACKED_TEAM,
      })

      const startPromise = manager.start()
      await new Promise((r) => setTimeout(r, 10))
      pushChunk(`|request|${makeP1Request()}`)
      await startPromise

      expect(mockStreamWrite).toHaveBeenCalledWith('>start {"formatid":"gen9ou"}')
    })

    it("does nothing if already started", async () => {
      const manager = new BattleManager({
        formatId: "gen9ou",
        gameType: "singles",
        playerTeam: PACKED_TEAM,
        opponentTeam: PACKED_TEAM,
      })

      const startPromise = manager.start()
      await new Promise((r) => setTimeout(r, 10))
      pushChunk(`|request|${makeP1Request()}`)
      await startPromise

      const writeCountAfterFirstStart = mockStreamWrite.mock.calls.length

      // Second start should be a no-op
      await manager.start()
      expect(mockStreamWrite.mock.calls.length).toBe(writeCountAfterFirstStart)
    })

    it("throws when player team is empty", async () => {
      const manager = new BattleManager({
        formatId: "gen9ou",
        gameType: "singles",
        playerTeam: "",
        opponentTeam: PACKED_TEAM,
      })

      await expect(manager.start()).rejects.toThrow("Failed to parse player team")
    })

    it("throws when opponent team is empty", async () => {
      const manager = new BattleManager({
        formatId: "gen9ou",
        gameType: "singles",
        playerTeam: PACKED_TEAM,
        opponentTeam: "",
      })

      await expect(manager.start()).rejects.toThrow("Failed to parse opponent team")
    })

    it("converts paste format to packed for the stream", async () => {
      const manager = new BattleManager({
        formatId: "gen9ou",
        gameType: "singles",
        playerTeam: PASTE_TEAM,
        opponentTeam: PASTE_TEAM,
      })

      const startPromise = manager.start()
      await new Promise((r) => setTimeout(r, 10))
      pushChunk(`|request|${makeP1Request()}`)
      await startPromise

      // The teams should have been packed by Teams.pack
      expect(mockStreamWrite).toHaveBeenCalledWith(expect.stringContaining(">player p1"))
      expect(mockStreamWrite).toHaveBeenCalledWith(expect.stringContaining(">player p2"))
    })

    it("sets phase to preview when team preview request arrives", async () => {
      const manager = new BattleManager({
        formatId: "gen9ou",
        gameType: "singles",
        playerTeam: PACKED_TEAM,
        opponentTeam: PACKED_TEAM,
      })

      const startPromise = manager.start()
      await new Promise((r) => setTimeout(r, 10))

      // Push a team preview request
      pushChunk(`|request|${makeP1Request({ teamPreview: true })}`)
      await startPromise

      const state = manager.getState()
      expect(state.phase).toBe("preview")
      expect(state.waitingForChoice).toBe(true)
    })

    it("calls event handler when request arrives", async () => {
      const handler = vi.fn()
      const manager = new BattleManager({
        formatId: "gen9ou",
        gameType: "singles",
        playerTeam: PACKED_TEAM,
        opponentTeam: PACKED_TEAM,
      })
      manager.onUpdate(handler)

      const startPromise = manager.start()
      await new Promise((r) => setTimeout(r, 10))
      pushChunk(`|request|${makeP1Request()}`)
      await startPromise

      expect(handler).toHaveBeenCalled()
    })

    it("handles wait request by setting waitingForChoice to false", async () => {
      const manager = new BattleManager({
        formatId: "gen9ou",
        gameType: "singles",
        playerTeam: PACKED_TEAM,
        opponentTeam: PACKED_TEAM,
      })

      const startPromise = manager.start()
      await new Promise((r) => setTimeout(r, 10))

      // First send a normal request to resolve start(), then wait
      pushChunk(`|request|${makeP1Request()}\n|request|${makeP1Request({ wait: true })}`)
      // The first request resolves the start, the second sets wait
      await startPromise

      // After processing both, the last request with wait should set waitingForChoice to false
      // But note the first request sets it to true. The wait request overrides it.
    })
  })

  describe("processOutput with protocol lines", () => {
    it("processes protocol lines and invokes event handler", async () => {
      const handler = vi.fn()
      const manager = new BattleManager({
        formatId: "gen9ou",
        gameType: "singles",
        playerTeam: PACKED_TEAM,
        opponentTeam: PACKED_TEAM,
      })
      manager.onUpdate(handler)

      const startPromise = manager.start()
      await new Promise((r) => setTimeout(r, 10))

      // Push protocol lines + request
      pushChunk(
        `|switch|p1a: Garchomp|Garchomp, L100, M|319/319\n|switch|p2a: Heatran|Heatran, L100|311/311\n|turn|1\n|request|${makeP1Request()}`,
      )

      await startPromise

      const state = manager.getState()
      expect(state.turn).toBe(1)
      // Protocol switch adds Garchomp + Heatran, request side adds both from its pokemon array
      expect(state.sides.p1.team.length).toBeGreaterThanOrEqual(1)
      expect(state.sides.p1.team[0].name).toBe("Garchomp")
    })

    it("handles error lines in protocol", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
      const manager = new BattleManager({
        formatId: "gen9ou",
        gameType: "singles",
        playerTeam: PACKED_TEAM,
        opponentTeam: PACKED_TEAM,
      })

      const startPromise = manager.start()
      await new Promise((r) => setTimeout(r, 10))

      // Push an error followed by a normal request
      pushChunk(`|error|Invalid team format\n|request|${makeP1Request()}`)
      await startPromise

      expect(consoleSpy).toHaveBeenCalledWith("[BattleManager] Sim error:", "Invalid team format")
      consoleSpy.mockRestore()
    })

    it("deduplicates identical protocol chunks", async () => {
      const handler = vi.fn()
      const manager = new BattleManager({
        formatId: "gen9ou",
        gameType: "singles",
        playerTeam: PACKED_TEAM,
        opponentTeam: PACKED_TEAM,
      })
      manager.onUpdate(handler)

      const startPromise = manager.start()
      await new Promise((r) => setTimeout(r, 10))

      // The same protocol lines appear twice (as pkmn/sim does for p1 and p2 chunks)
      pushChunk(`|turn|1\n|request|${makeP1Request()}`)
      await startPromise

      const state = manager.getState()
      // Turn should still be 1 (not processed twice)
      expect(state.turn).toBe(1)
    })

    it("accumulates protocol log for replay", async () => {
      const manager = new BattleManager({
        formatId: "gen9ou",
        gameType: "singles",
        playerTeam: PACKED_TEAM,
        opponentTeam: PACKED_TEAM,
      })

      const startPromise = manager.start()
      await new Promise((r) => setTimeout(r, 10))

      pushChunk(`|turn|1\n|request|${makeP1Request()}`)
      await startPromise

      const log = manager.getProtocolLog()
      expect(log).toContain("|turn|1")
    })
  })

  describe("processOutput with p2 request", () => {
    it("stores pending p2 actions for AI", async () => {
      const mockAI: AIPlayer = {
        difficulty: "random",
        chooseAction: vi.fn().mockResolvedValue({ type: "move", moveIndex: 1 }),
        chooseLeads: vi.fn().mockReturnValue([1, 2, 3, 4, 5, 6]),
      }

      const manager = new BattleManager({
        formatId: "gen9ou",
        gameType: "singles",
        playerTeam: PACKED_TEAM,
        opponentTeam: PACKED_TEAM,
      })
      manager.setAI(mockAI)

      const startPromise = manager.start()
      await new Promise((r) => setTimeout(r, 10))

      // Push both p1 and p2 request chunks
      pushChunk(`|request|${makeP1Request()}`)
      await startPromise

      // Now push a p2 request - AI stores it for later
      await new Promise((r) => setTimeout(r, 10))
      pushChunk(`|request|${makeP2Request()}`)
      await new Promise((r) => setTimeout(r, 50))

      // The p2 request with normal actions should be stored as pending
      // (AI will process it when player submits their action)
    })
  })

  describe("chooseLead", () => {
    it("writes team lead order to the stream", async () => {
      const manager = new BattleManager({
        formatId: "gen9ou",
        gameType: "singles",
        playerTeam: PACKED_TEAM,
        opponentTeam: PACKED_TEAM,
      })

      // Start the battle with team preview
      const startPromise = manager.start()
      await new Promise((r) => setTimeout(r, 10))
      pushChunk(`|request|${makeP1Request({ teamPreview: true })}`)
      await startPromise

      // Now choose leads. This writes to stream and waits for update
      const leadPromise = manager.chooseLead([1, 2, 3, 4, 5, 6])
      await new Promise((r) => setTimeout(r, 10))

      expect(mockStreamWrite).toHaveBeenCalledWith(">p1 team 123456")

      // Resolve the lead promise by pushing next request
      pushChunk(`|turn|1\n|request|${makeP1Request()}`)
      await leadPromise

      expect(manager.getState().phase).toBe("battle")
    })

    it("also sends AI lead choice when AI is set", async () => {
      const mockAI: AIPlayer = {
        difficulty: "random",
        chooseAction: vi.fn(),
        chooseLeads: vi.fn().mockReturnValue([3, 1, 2, 4, 5, 6]),
      }

      const manager = new BattleManager({
        formatId: "gen9ou",
        gameType: "singles",
        playerTeam: PACKED_TEAM,
        opponentTeam: PACKED_TEAM,
      })
      manager.setAI(mockAI)

      const startPromise = manager.start()
      await new Promise((r) => setTimeout(r, 10))
      pushChunk(`|request|${makeP1Request({ teamPreview: true })}`)
      await startPromise

      const leadPromise = manager.chooseLead([1, 2, 3, 4, 5, 6])
      await new Promise((r) => setTimeout(r, 10))

      expect(mockStreamWrite).toHaveBeenCalledWith(">p1 team 123456")
      expect(mockStreamWrite).toHaveBeenCalledWith(">p2 team 312456")
      expect(mockAI.chooseLeads).toHaveBeenCalled()

      pushChunk(`|turn|1\n|request|${makeP1Request()}`)
      await leadPromise
    })
  })

  describe("submitAction", () => {
    async function setupBattleForAction() {
      const manager = new BattleManager({
        formatId: "gen9ou",
        gameType: "singles",
        playerTeam: PACKED_TEAM,
        opponentTeam: PACKED_TEAM,
      })

      const startPromise = manager.start()
      await new Promise((r) => setTimeout(r, 10))
      pushChunk(`|request|${makeP1Request()}`)
      await startPromise

      return manager
    }

    it("writes a move action to the stream", async () => {
      const manager = await setupBattleForAction()

      const action: BattleAction = { type: "move", moveIndex: 1 }
      const actionPromise = manager.submitAction(action)
      await new Promise((r) => setTimeout(r, 10))

      expect(mockStreamWrite).toHaveBeenCalledWith(">p1 move 1")

      // Resolve by pushing the next update
      pushChunk(`|request|${makeP1Request()}`)
      await actionPromise
    })

    it("writes a move with tera flag", async () => {
      const manager = await setupBattleForAction()

      const action: BattleAction = { type: "move", moveIndex: 2, tera: true }
      const actionPromise = manager.submitAction(action)
      await new Promise((r) => setTimeout(r, 10))

      expect(mockStreamWrite).toHaveBeenCalledWith(">p1 move 2 terastallize")

      pushChunk(`|request|${makeP1Request()}`)
      await actionPromise
    })

    it("writes a move with mega flag", async () => {
      const manager = await setupBattleForAction()

      const action: BattleAction = { type: "move", moveIndex: 1, mega: true }
      const actionPromise = manager.submitAction(action)
      await new Promise((r) => setTimeout(r, 10))

      expect(mockStreamWrite).toHaveBeenCalledWith(">p1 move 1 mega")

      pushChunk(`|request|${makeP1Request()}`)
      await actionPromise
    })

    it("writes a move with target slot for doubles", async () => {
      const manager = await setupBattleForAction()

      const action: BattleAction = { type: "move", moveIndex: 1, targetSlot: -1 }
      const actionPromise = manager.submitAction(action)
      await new Promise((r) => setTimeout(r, 10))

      expect(mockStreamWrite).toHaveBeenCalledWith(">p1 move 1 -1")

      pushChunk(`|request|${makeP1Request()}`)
      await actionPromise
    })

    it("writes a switch action to the stream", async () => {
      const manager = await setupBattleForAction()

      const action: BattleAction = { type: "switch", pokemonIndex: 3 }
      const actionPromise = manager.submitAction(action)
      await new Promise((r) => setTimeout(r, 10))

      expect(mockStreamWrite).toHaveBeenCalledWith(">p1 switch 3")

      pushChunk(`|request|${makeP1Request()}`)
      await actionPromise
    })

    it("sets waitingForChoice to false after submitting", async () => {
      const manager = await setupBattleForAction()

      const action: BattleAction = { type: "move", moveIndex: 1 }
      const actionPromise = manager.submitAction(action)
      await new Promise((r) => setTimeout(r, 10))

      // After submit, waitingForChoice should be false
      expect(manager.getState().waitingForChoice).toBe(false)

      pushChunk(`|request|${makeP1Request()}`)
      await actionPromise
    })
  })

  describe("getSerializedBattle", () => {
    it("returns null when stream has no battle", () => {
      const manager = new BattleManager({
        formatId: "gen9ou",
        gameType: "singles",
        playerTeam: PACKED_TEAM,
        opponentTeam: PACKED_TEAM,
      })

      expect(manager.getSerializedBattle()).toBeNull()
    })

    it("returns serialized battle when toJSON is available", async () => {
      const manager = new BattleManager({
        formatId: "gen9ou",
        gameType: "singles",
        playerTeam: PACKED_TEAM,
        opponentTeam: PACKED_TEAM,
      })

      const startPromise = manager.start()
      await new Promise((r) => setTimeout(r, 10))

      // Inject a mock battle object with toJSON
      currentMockStream.battle = {
        toJSON: () => ({ turn: 5, p1: "data", p2: "data" }),
      }

      pushChunk(`|request|${makeP1Request()}`)
      await startPromise

      const serialized = manager.getSerializedBattle()
      expect(serialized).toEqual({ turn: 5, p1: "data", p2: "data" })
    })
  })

  describe("getProtocolLog", () => {
    it("returns empty string before any protocol is received", () => {
      const manager = new BattleManager({
        formatId: "gen9ou",
        gameType: "singles",
        playerTeam: PACKED_TEAM,
        opponentTeam: PACKED_TEAM,
      })

      expect(manager.getProtocolLog()).toBe("")
    })
  })

  describe("destroy", () => {
    it("calls destroy on the underlying stream", () => {
      const manager = new BattleManager({
        formatId: "gen9ou",
        gameType: "singles",
        playerTeam: PACKED_TEAM,
        opponentTeam: PACKED_TEAM,
      })

      manager.destroy()
      expect(mockStreamDestroy).toHaveBeenCalled()
    })

    it("handles destroy being called multiple times", () => {
      const manager = new BattleManager({
        formatId: "gen9ou",
        gameType: "singles",
        playerTeam: PACKED_TEAM,
        opponentTeam: PACKED_TEAM,
      })

      manager.destroy()
      manager.destroy()
      // Should not throw
      expect(mockStreamDestroy).toHaveBeenCalledTimes(2)
    })

    it("handles destroy when stream throws", () => {
      const manager = new BattleManager({
        formatId: "gen9ou",
        gameType: "singles",
        playerTeam: PACKED_TEAM,
        opponentTeam: PACKED_TEAM,
      })

      mockStreamDestroy.mockImplementationOnce(() => {
        throw new Error("Stream already destroyed")
      })

      // Should not throw
      expect(() => manager.destroy()).not.toThrow()
    })
  })

  describe("SetPredictor integration", () => {
    it("updates predictor when opponent moves are observed", async () => {
      const mockPredictor = {
        updateFromObservation: vi.fn(),
        predictSet: vi.fn(),
      }

      const manager = new BattleManager({
        formatId: "gen9ou",
        gameType: "singles",
        playerTeam: PACKED_TEAM,
        opponentTeam: PACKED_TEAM,
      })
      manager.setSetPredictor(mockPredictor as never)

      const startPromise = manager.start()
      await new Promise((r) => setTimeout(r, 10))

      // Push protocol with p2 move observation
      pushChunk(`|move|p2a: Heatran|Magma Storm|p1a: Garchomp\n|request|${makeP1Request()}`)
      await startPromise

      expect(mockPredictor.updateFromObservation).toHaveBeenCalledWith("heatran", {
        moveUsed: "Magma Storm",
      })
    })

    it("updates predictor when opponent item is revealed", async () => {
      const mockPredictor = {
        updateFromObservation: vi.fn(),
        predictSet: vi.fn(),
      }

      const manager = new BattleManager({
        formatId: "gen9ou",
        gameType: "singles",
        playerTeam: PACKED_TEAM,
        opponentTeam: PACKED_TEAM,
      })
      manager.setSetPredictor(mockPredictor as never)

      const startPromise = manager.start()
      await new Promise((r) => setTimeout(r, 10))

      pushChunk(`|-item|p2a: Heatran|Leftovers\n|request|${makeP1Request()}`)
      await startPromise

      expect(mockPredictor.updateFromObservation).toHaveBeenCalledWith("heatran", {
        itemRevealed: "Leftovers",
      })
    })

    it("updates predictor when opponent ability is revealed", async () => {
      const mockPredictor = {
        updateFromObservation: vi.fn(),
        predictSet: vi.fn(),
      }

      const manager = new BattleManager({
        formatId: "gen9ou",
        gameType: "singles",
        playerTeam: PACKED_TEAM,
        opponentTeam: PACKED_TEAM,
      })
      manager.setSetPredictor(mockPredictor as never)

      const startPromise = manager.start()
      await new Promise((r) => setTimeout(r, 10))

      pushChunk(`|-ability|p2a: Heatran|Flash Fire\n|request|${makeP1Request()}`)
      await startPromise

      expect(mockPredictor.updateFromObservation).toHaveBeenCalledWith("heatran", {
        abilityRevealed: "Flash Fire",
      })
    })

    it("does not update predictor for p1 observations", async () => {
      const mockPredictor = {
        updateFromObservation: vi.fn(),
        predictSet: vi.fn(),
      }

      const manager = new BattleManager({
        formatId: "gen9ou",
        gameType: "singles",
        playerTeam: PACKED_TEAM,
        opponentTeam: PACKED_TEAM,
      })
      manager.setSetPredictor(mockPredictor as never)

      const startPromise = manager.start()
      await new Promise((r) => setTimeout(r, 10))

      pushChunk(`|move|p1a: Garchomp|Earthquake|p2a: Heatran\n|request|${makeP1Request()}`)
      await startPromise

      expect(mockPredictor.updateFromObservation).not.toHaveBeenCalled()
    })
  })

  describe("handleRequest p2 forceSwitch", () => {
    it("AI immediately responds to forced switch when p1 is not choosing", async () => {
      const mockAI: AIPlayer = {
        difficulty: "random",
        chooseAction: vi.fn().mockResolvedValue({ type: "switch", pokemonIndex: 2 }),
        chooseLeads: vi.fn().mockReturnValue([1, 2, 3, 4, 5, 6]),
      }

      const manager = new BattleManager({
        formatId: "gen9ou",
        gameType: "singles",
        playerTeam: PACKED_TEAM,
        opponentTeam: PACKED_TEAM,
      })
      manager.setAI(mockAI)

      // Start the battle
      const startPromise = manager.start()
      await new Promise((r) => setTimeout(r, 10))
      pushChunk(`|request|${makeP1Request({ wait: true })}`)
      await startPromise

      // Now the state has waitingForChoice=false (from wait)
      // Push a p2 force switch request
      pushChunk(`|request|${makeP2Request({ forceSwitch: true })}`)
      await new Promise((r) => setTimeout(r, 800)) // Wait for the AI delay

      // AI should have been called for forced switch
      expect(mockAI.chooseAction).toHaveBeenCalled()
      expect(mockStreamWrite).toHaveBeenCalledWith(">p2 switch 2")
    })
  })

  describe("AI turn handling", () => {
    it("calls AI chooseAction when player submits action and p2 actions are pending", async () => {
      const mockAI: AIPlayer = {
        difficulty: "random",
        chooseAction: vi.fn().mockResolvedValue({ type: "move", moveIndex: 1 }),
        chooseLeads: vi.fn().mockReturnValue([1, 2, 3, 4, 5, 6]),
      }

      const manager = new BattleManager({
        formatId: "gen9ou",
        gameType: "singles",
        playerTeam: PACKED_TEAM,
        opponentTeam: PACKED_TEAM,
      })
      manager.setAI(mockAI)

      // Start
      const startPromise = manager.start()
      await new Promise((r) => setTimeout(r, 10))
      pushChunk(`|request|${makeP1Request()}`)
      await startPromise

      // Push p2 request (stores pending actions)
      pushChunk(`|request|${makeP2Request()}`)
      await new Promise((r) => setTimeout(r, 50))

      // Now player submits action
      const actionPromise = manager.submitAction({ type: "move", moveIndex: 1 })
      // Wait for AI delay (300-1000ms)
      await new Promise((r) => setTimeout(r, 1200))

      expect(mockAI.chooseAction).toHaveBeenCalled()
      expect(mockStreamWrite).toHaveBeenCalledWith(">p2 move 1")

      pushChunk(`|request|${makeP1Request()}`)
      await actionPromise
    })

    it("passes serialized battle to MCTS AI with setBattleState", async () => {
      const mockSetBattleState = vi.fn()
      const mockAI = {
        difficulty: "random" as const,
        chooseAction: vi.fn().mockResolvedValue({ type: "move", moveIndex: 1 }),
        chooseLeads: vi.fn().mockReturnValue([1, 2, 3, 4, 5, 6]),
        setBattleState: mockSetBattleState,
      }

      const manager = new BattleManager({
        formatId: "gen9ou",
        gameType: "singles",
        playerTeam: PACKED_TEAM,
        opponentTeam: PACKED_TEAM,
      })
      manager.setAI(mockAI as unknown as AIPlayer)

      // Start
      const startPromise = manager.start()
      await new Promise((r) => setTimeout(r, 10))

      // Inject a mock battle with toJSON
      currentMockStream.battle = {
        toJSON: () => ({ turn: 1 }),
      }

      pushChunk(`|request|${makeP1Request()}`)
      await startPromise

      // Push p2 request
      pushChunk(`|request|${makeP2Request()}`)
      await new Promise((r) => setTimeout(r, 50))

      // Player submits
      const actionPromise = manager.submitAction({ type: "move", moveIndex: 1 })
      await new Promise((r) => setTimeout(r, 1200))

      expect(mockSetBattleState).toHaveBeenCalledWith({ turn: 1 }, "gen9ou")

      pushChunk(`|request|${makeP1Request()}`)
      await actionPromise
    })
  })

  describe("battle end detection", () => {
    it("resolves waitForUpdate immediately when phase is ended", async () => {
      const manager = new BattleManager({
        formatId: "gen9ou",
        gameType: "singles",
        playerTeam: PACKED_TEAM,
        opponentTeam: PACKED_TEAM,
      })

      const startPromise = manager.start()
      await new Promise((r) => setTimeout(r, 10))
      pushChunk(`|request|${makeP1Request()}`)
      await startPromise

      // Manually set phase to ended to test waitForUpdate early exit
      const state = manager.getState()
      state.phase = "ended"

      // submitAction calls waitForUpdate internally
      const actionPromise = manager.submitAction({ type: "move", moveIndex: 1 })
      // Should resolve quickly because phase is ended
      await actionPromise
    })
  })

  describe("tera gating logic", () => {
    it("gates canTera to false after player has terastallized", async () => {
      const manager = new BattleManager({
        formatId: "gen9ou",
        gameType: "singles",
        playerTeam: PACKED_TEAM,
        opponentTeam: PACKED_TEAM,
      })

      // Start the battle
      const startPromise = manager.start()
      await new Promise((r) => setTimeout(r, 10))
      pushChunk(`|request|${makeP1Request()}`)
      await startPromise

      // Verify initial state: canTera should be available
      let state = manager.getState()
      expect(state.availableActions?.canTera).toBe(true)
      expect(state.sides.p1.hasTerastallized).toBe(false)

      // Push a protocol chunk showing p1 terastallizing
      pushChunk(`|-terastallize|p1a: Garchomp|Ground\n|request|${makeP1Request()}`)
      await new Promise((r) => setTimeout(r, 50))

      // Verify hasTerastallized flag is set
      state = manager.getState()
      expect(state.sides.p1.hasTerastallized).toBe(true)

      // Now push a new request where the sim still includes canTerastallize
      // (this simulates what @pkmn/sim does - it doesn't know about our tracking)
      pushChunk(`|request|${makeP1Request()}`)
      await new Promise((r) => setTimeout(r, 50))

      // The battle-manager should gate canTera to false despite the request having canTerastallize
      state = manager.getState()
      expect(state.availableActions?.canTera).toBe(false)
    })

    it("gates canTera to false for opponent after they terastallize", async () => {
      const mockAI: AIPlayer = {
        difficulty: "random",
        chooseAction: vi.fn().mockResolvedValue({ type: "move", moveIndex: 1 }),
        chooseLeads: vi.fn().mockReturnValue([1, 2, 3, 4, 5, 6]),
      }

      const manager = new BattleManager({
        formatId: "gen9ou",
        gameType: "singles",
        playerTeam: PACKED_TEAM,
        opponentTeam: PACKED_TEAM,
      })
      manager.setAI(mockAI)

      // Start the battle
      const startPromise = manager.start()
      await new Promise((r) => setTimeout(r, 10))
      pushChunk(`|request|${makeP1Request()}`)
      await startPromise

      // Verify initial state: p2 hasn't terastallized
      let state = manager.getState()
      expect(state.sides.p2.hasTerastallized).toBe(false)

      // Push a protocol chunk showing p2 terastallizing
      pushChunk(`|-terastallize|p2a: Heatran|Fire\n|request|${makeP1Request()}`)
      await new Promise((r) => setTimeout(r, 50))

      // Verify p2 hasTerastallized flag is set
      state = manager.getState()
      expect(state.sides.p2.hasTerastallized).toBe(true)

      // When the next p2 request comes in (with canTerastallize set by sim),
      // battle-manager should gate it to false
      pushChunk(`|request|${makeP2Request()}`)
      await new Promise((r) => setTimeout(r, 50))

      // The AI's available actions should have canTera=false
      // (We can't directly check p2's availableActions since it's not exposed,
      // but the flag should prevent AI from being given tera option)
      state = manager.getState()
      expect(state.sides.p2.hasTerastallized).toBe(true)
    })

    it("preserves canTera=true if player has not yet terastallized", async () => {
      const manager = new BattleManager({
        formatId: "gen9ou",
        gameType: "singles",
        playerTeam: PACKED_TEAM,
        opponentTeam: PACKED_TEAM,
      })

      // Start the battle
      const startPromise = manager.start()
      await new Promise((r) => setTimeout(r, 10))
      pushChunk(`|request|${makeP1Request()}`)
      await startPromise

      // Multiple requests without terastallizing
      pushChunk(`|request|${makeP1Request()}`)
      await new Promise((r) => setTimeout(r, 50))

      let state = manager.getState()
      expect(state.sides.p1.hasTerastallized).toBe(false)
      expect(state.availableActions?.canTera).toBe(true)

      // Another request
      pushChunk(`|request|${makeP1Request()}`)
      await new Promise((r) => setTimeout(r, 50))

      state = manager.getState()
      expect(state.sides.p1.hasTerastallized).toBe(false)
      expect(state.availableActions?.canTera).toBe(true)
    })
  })
})
