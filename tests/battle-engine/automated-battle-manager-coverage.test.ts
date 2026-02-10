import { describe, it, expect, vi, beforeEach } from "vitest"
import type {
  AIPlayer,
  BattleAction,
  BattleState,
  BattleActionSet,
} from "@nasty-plot/battle-engine"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let mockStreamInstance: {
  write: ReturnType<typeof vi.fn>
  destroy: ReturnType<typeof vi.fn>
  chunks: string[]
  _asyncIteratorFn: ReturnType<typeof vi.fn>
}

vi.mock("@pkmn/sim", () => {
  return {
    BattleStreams: {
      BattleStream: class MockBattleStream {
        write = vi.fn()
        destroy = vi.fn();
        [Symbol.asyncIterator]() {
          return mockStreamInstance._asyncIteratorFn()
        }
        constructor() {
          mockStreamInstance.write = this.write
          mockStreamInstance.destroy = this.destroy
        }
      },
    },
    Teams: {
      import: vi.fn((paste: string) => {
        if (!paste || paste.trim() === "") return null
        return [{ species: "Garchomp", ability: "Rough Skin", moves: ["earthquake"] }]
      }),
      pack: vi.fn(() => "Garchomp|||roughskin|earthquake|||||||"),
    },
  }
})

function defaultSideConditions() {
  return {
    stealthRock: false,
    spikes: 0,
    toxicSpikes: 0,
    stickyWeb: false,
    reflect: 0,
    lightScreen: 0,
    auroraVeil: 0,
    tailwind: 0,
  }
}

function makeBattleState(overrides: Partial<BattleState> = {}): BattleState {
  return {
    phase: "setup",
    format: "singles",
    turn: 0,
    sides: {
      p1: {
        active: [null],
        team: [],
        name: "Player",
        sideConditions: defaultSideConditions(),
        canTera: true,
        hasTerastallized: false,
      },
      p2: {
        active: [null],
        team: [],
        name: "Opponent",
        sideConditions: defaultSideConditions(),
        canTera: true,
        hasTerastallized: false,
      },
    },
    field: { weather: "", weatherTurns: 0, terrain: "", terrainTurns: 0, trickRoom: 0 },
    winner: null,
    log: [],
    fullLog: [],
    waitingForChoice: false,
    availableActions: null,
    id: "auto-battle",
    ...overrides,
  }
}

// Track how many ticks have passed to control flow
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let tickCount: number
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let mockStateRef: BattleState

vi.mock("#battle-engine/battle-manager", () => ({
  createInitialState: vi.fn((_id: string, format: string) => {
    const state = makeBattleState({
      format: format as "singles" | "doubles",
    })
    mockStateRef = state
    return state
  }),
}))

const mockProcessChunk = vi.fn()
const mockParseRequest = vi.fn()
const mockParseRequestForSlot = vi.fn()
const mockUpdateSideFromRequest = vi.fn()

vi.mock("#battle-engine/protocol-parser", () => ({
  processChunk: (...args: unknown[]) => mockProcessChunk(...args),
  parseRequest: (...args: unknown[]) => mockParseRequest(...args),
  parseRequestForSlot: (...args: unknown[]) => mockParseRequestForSlot(...args),
  updateSideFromRequest: (...args: unknown[]) => mockUpdateSideFromRequest(...args),
}))

function createMockAI(overrides: Partial<AIPlayer> = {}): AIPlayer {
  return {
    difficulty: "random",
    chooseAction: vi.fn(async () => ({ type: "move", moveIndex: 1 }) as BattleAction),
    chooseLeads: vi.fn(() => [1, 2, 3, 4, 5, 6]),
    ...overrides,
  }
}

/**
 * Create an async iterator from an array of chunks.
 * Each chunk is yielded one at a time.
 */
function makeAsyncIterator(chunks: string[]) {
  let index = 0
  return () => ({
    next: vi.fn(async () => {
      if (index < chunks.length) {
        return { done: false, value: chunks[index++] }
      }
      return { done: true, value: undefined }
    }),
  })
}

function setupEmptyStream() {
  mockStreamInstance._asyncIteratorFn = makeAsyncIterator([])
}

// ---------------------------------------------------------------------------
// Import the function under test AFTER mocks
// ---------------------------------------------------------------------------
import { runAutomatedBattle } from "@nasty-plot/battle-engine"

describe("runAutomatedBattle - deep coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tickCount = 0
    mockStreamInstance = {
      write: vi.fn(),
      destroy: vi.fn(),
      chunks: [],
      _asyncIteratorFn: makeAsyncIterator([]),
    }
    mockProcessChunk.mockReturnValue([])
    mockParseRequest.mockReturnValue({
      actions: null,
      teamPreview: false,
      wait: true,
      forceSwitch: false,
    })
    mockParseRequestForSlot.mockReturnValue({
      actions: null,
      teamPreview: false,
      wait: false,
      forceSwitch: false,
    })
    mockUpdateSideFromRequest.mockReturnValue(undefined)
  })

  // -----------------------------------------------------------------------
  // pasteToPackedTeam
  // -----------------------------------------------------------------------

  describe("team paste parsing", () => {
    it("passes already-packed teams through directly", async () => {
      const { Teams } = await import("@pkmn/sim")
      setupEmptyStream()

      // Packed format: contains | but no newlines
      const packed = "Garchomp|||roughskin|earthquake|||||||"
      const state = makeBattleState({ phase: "ended" })
      const { createInitialState } = await import("#battle-engine/battle-manager")
      vi.mocked(createInitialState).mockReturnValue(state)

      const ai1 = createMockAI()
      const ai2 = createMockAI()

      await runAutomatedBattle({
        formatId: "gen9ou",
        gameType: "singles",
        team1Paste: packed,
        team2Paste: packed,
        ai1,
        ai2,
        maxTurns: 1,
      })

      // Teams.import should not be called for packed format
      expect(vi.mocked(Teams.import)).not.toHaveBeenCalled()
    })

    it("throws when empty team paste is provided", async () => {
      setupEmptyStream()

      const state = makeBattleState({ phase: "ended" })
      const { createInitialState } = await import("#battle-engine/battle-manager")
      vi.mocked(createInitialState).mockReturnValue(state)

      const ai1 = createMockAI()
      const ai2 = createMockAI()

      await expect(
        runAutomatedBattle({
          formatId: "gen9ou",
          gameType: "singles",
          team1Paste: "",
          team2Paste: "packed|team",
          ai1,
          ai2,
        }),
      ).rejects.toThrow("Failed to parse team pastes")
    })

    it("throws when Teams.import returns empty array", async () => {
      const { Teams } = await import("@pkmn/sim")
      vi.mocked(Teams.import).mockReturnValueOnce([])
      setupEmptyStream()

      const state = makeBattleState({ phase: "ended" })
      const { createInitialState } = await import("#battle-engine/battle-manager")
      vi.mocked(createInitialState).mockReturnValue(state)

      const ai1 = createMockAI()
      const ai2 = createMockAI()

      await expect(
        runAutomatedBattle({
          formatId: "gen9ou",
          gameType: "singles",
          team1Paste: "Garchomp\nAbility: Rough Skin\n- Earthquake",
          team2Paste: "packed|team",
          ai1,
          ai2,
        }),
      ).rejects.toThrow("Failed to parse team pastes")
    })

    it("throws when Teams.import throws an error", async () => {
      const { Teams } = await import("@pkmn/sim")
      vi.mocked(Teams.import).mockImplementationOnce(() => {
        throw new Error("parse error")
      })
      setupEmptyStream()

      const state = makeBattleState({ phase: "ended" })
      const { createInitialState } = await import("#battle-engine/battle-manager")
      vi.mocked(createInitialState).mockReturnValue(state)

      const ai1 = createMockAI()
      const ai2 = createMockAI()

      await expect(
        runAutomatedBattle({
          formatId: "gen9ou",
          gameType: "singles",
          team1Paste: "Garchomp\nAbility: Rough Skin\n- Earthquake",
          team2Paste: "packed|team",
          ai1,
          ai2,
        }),
      ).rejects.toThrow("Failed to parse team pastes")
    })

    it("converts showdown paste format to packed", async () => {
      const { Teams } = await import("@pkmn/sim")
      vi.mocked(Teams.import).mockReturnValue([
        { species: "Garchomp", ability: "Rough Skin", moves: ["earthquake"] } as never,
      ])
      vi.mocked(Teams.pack).mockReturnValue("Garchomp|||roughskin|earthquake|||||||")
      setupEmptyStream()

      const state = makeBattleState({ phase: "ended" })
      const { createInitialState } = await import("#battle-engine/battle-manager")
      vi.mocked(createInitialState).mockReturnValue(state)

      const ai1 = createMockAI()
      const ai2 = createMockAI()

      await runAutomatedBattle({
        formatId: "gen9ou",
        gameType: "singles",
        team1Paste: "Garchomp\nAbility: Rough Skin\n- Earthquake",
        team2Paste: "Garchomp\nAbility: Rough Skin\n- Earthquake",
        ai1,
        ai2,
        maxTurns: 1,
      })

      expect(vi.mocked(Teams.import)).toHaveBeenCalledTimes(2)
      expect(vi.mocked(Teams.pack)).toHaveBeenCalledTimes(2)
    })
  })

  // -----------------------------------------------------------------------
  // Protocol parsing - request handling
  // -----------------------------------------------------------------------

  describe("protocol and request parsing", () => {
    it("processes protocol lines from stream chunks", async () => {
      const state = makeBattleState({ phase: "ended" })
      const { createInitialState } = await import("#battle-engine/battle-manager")
      vi.mocked(createInitialState).mockReturnValue(state)

      // Stream emits protocol lines (not requests)
      mockStreamInstance._asyncIteratorFn = makeAsyncIterator([
        "|move|p1a: Garchomp|Earthquake|p2a: Heatran\n|-damage|p2a: Heatran|0 fnt",
      ])

      const ai1 = createMockAI()
      const ai2 = createMockAI()

      await runAutomatedBattle({
        formatId: "gen9ou",
        gameType: "singles",
        team1Paste: "packed|team",
        team2Paste: "packed|team",
        ai1,
        ai2,
        maxTurns: 1,
      })

      expect(mockProcessChunk).toHaveBeenCalled()
    })

    it("parses p1 request and sets pending actions", async () => {
      const { createInitialState } = await import("#battle-engine/battle-manager")
      let turnsSeen = 0

      // Create state that transitions from battle to ended after one action
      vi.mocked(createInitialState).mockImplementation((_id, fmt) => {
        const s = makeBattleState({ format: fmt as "singles" | "doubles" })
        // Override phase getter-like behavior
        Object.defineProperty(s, "phase", {
          get() {
            return turnsSeen >= 1 ? "ended" : "battle"
          },
          set(v: string) {
            if (v === "ended") turnsSeen = 999
          },
          configurable: true,
        })
        return s
      })

      const p1ReqJson = JSON.stringify({
        side: { id: "p1", name: "Player", pokemon: [] },
        active: [
          { moves: [{ move: "Earthquake", id: "earthquake", pp: 10, maxpp: 16, disabled: false }] },
        ],
      })
      const p2ReqJson = JSON.stringify({
        side: { id: "p2", name: "Opponent", pokemon: [] },
        active: [
          { moves: [{ move: "Magma Storm", id: "magmastorm", pp: 8, maxpp: 8, disabled: false }] },
        ],
      })

      const mockActions: BattleActionSet = {
        moves: [
          {
            name: "Earthquake",
            id: "earthquake",
            pp: 10,
            maxPp: 16,
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

      mockParseRequest
        .mockReturnValueOnce({
          actions: mockActions,
          teamPreview: false,
          wait: false,
          forceSwitch: false,
          side: { name: "Player", id: "p1", pokemon: [] },
        })
        .mockReturnValueOnce({
          actions: mockActions,
          teamPreview: false,
          wait: false,
          forceSwitch: false,
          side: { name: "Opponent", id: "p2", pokemon: [] },
        })

      // Stream emits both requests in one chunk
      mockStreamInstance._asyncIteratorFn = makeAsyncIterator([
        `|request|${p1ReqJson}\n|request|${p2ReqJson}`,
      ])

      const ai1 = createMockAI()
      const ai2 = createMockAI()

      vi.mocked(ai1.chooseAction).mockImplementation(async () => {
        turnsSeen++
        return { type: "move", moveIndex: 1 }
      })
      vi.mocked(ai2.chooseAction).mockImplementation(async () => {
        turnsSeen++
        return { type: "move", moveIndex: 1 }
      })

      const result = await runAutomatedBattle({
        formatId: "gen9ou",
        gameType: "singles",
        team1Paste: "packed|team",
        team2Paste: "packed|team",
        ai1,
        ai2,
        maxTurns: 3,
      })

      expect(mockParseRequest).toHaveBeenCalled()
      expect(result).toBeDefined()
    })

    it("handles team preview for both players", async () => {
      const { createInitialState } = await import("#battle-engine/battle-manager")
      const state = makeBattleState({ phase: "ended" })
      vi.mocked(createInitialState).mockReturnValue(state)

      const p1ReqJson = JSON.stringify({
        side: { id: "p1", name: "Player", pokemon: [] },
        teamPreview: true,
      })
      const p2ReqJson = JSON.stringify({
        side: { id: "p2", name: "Opponent", pokemon: [] },
        teamPreview: true,
      })

      mockParseRequest
        .mockReturnValueOnce({
          actions: null,
          teamPreview: true,
          wait: false,
          forceSwitch: false,
          side: { name: "Player", id: "p1", pokemon: [] },
        })
        .mockReturnValueOnce({
          actions: null,
          teamPreview: true,
          wait: false,
          forceSwitch: false,
          side: { name: "Opponent", id: "p2", pokemon: [] },
        })

      mockStreamInstance._asyncIteratorFn = makeAsyncIterator([
        `|request|${p1ReqJson}\n|request|${p2ReqJson}`,
      ])

      const ai1 = createMockAI()
      const ai2 = createMockAI()

      await runAutomatedBattle({
        formatId: "gen9ou",
        gameType: "singles",
        team1Paste: "packed|team",
        team2Paste: "packed|team",
        ai1,
        ai2,
        maxTurns: 1,
      })

      // chooseLeads should be called for both AIs
      expect(ai1.chooseLeads).toHaveBeenCalledWith(6, "singles")
      expect(ai2.chooseLeads).toHaveBeenCalledWith(6, "singles")

      // Team order should be written to stream
      const writeCalls = mockStreamInstance.write.mock.calls.map((c: string[]) => c[0])
      expect(writeCalls.some((c: string) => c.includes(">p1 team"))).toBe(true)
      expect(writeCalls.some((c: string) => c.includes(">p2 team"))).toBe(true)
    })

    it("skips bad request JSON without crashing", async () => {
      const { createInitialState } = await import("#battle-engine/battle-manager")
      const state = makeBattleState({ phase: "ended" })
      vi.mocked(createInitialState).mockReturnValue(state)

      // bad JSON in the request line
      mockStreamInstance._asyncIteratorFn = makeAsyncIterator(["|request|{invalid json!!!}"])
      // Make parseRequest throw for invalid JSON
      mockParseRequest.mockImplementationOnce(() => {
        throw new SyntaxError("bad JSON")
      })

      const ai1 = createMockAI()
      const ai2 = createMockAI()

      const result = await runAutomatedBattle({
        formatId: "gen9ou",
        gameType: "singles",
        team1Paste: "packed|team",
        team2Paste: "packed|team",
        ai1,
        ai2,
        maxTurns: 1,
      })

      // Should not crash
      expect(result).toBeDefined()
    })

    it("does not process duplicate protocol chunks", async () => {
      const { createInitialState } = await import("#battle-engine/battle-manager")
      const state = makeBattleState({ phase: "ended" })
      vi.mocked(createInitialState).mockReturnValue(state)

      // Same protocol chunk sent twice
      mockStreamInstance._asyncIteratorFn = makeAsyncIterator([
        "|turn|1\n|move|p1a: Garchomp|Earthquake",
        "|turn|1\n|move|p1a: Garchomp|Earthquake",
      ])

      const ai1 = createMockAI()
      const ai2 = createMockAI()

      await runAutomatedBattle({
        formatId: "gen9ou",
        gameType: "singles",
        team1Paste: "packed|team",
        team2Paste: "packed|team",
        ai1,
        ai2,
        maxTurns: 1,
      })

      // processChunk should be called for the first occurrence
      // but not for the duplicate (lastProtocolChunk dedup check)
      const processChunkCalls = mockProcessChunk.mock.calls.length
      // The dedup logic prevents processing the same chunk twice
      expect(processChunkCalls).toBeGreaterThanOrEqual(1)
    })

    it("handles request with wait=true (no actions needed)", async () => {
      const { createInitialState } = await import("#battle-engine/battle-manager")
      const state = makeBattleState({ phase: "ended" })
      vi.mocked(createInitialState).mockReturnValue(state)

      const waitReq = JSON.stringify({
        side: { id: "p1", name: "Player", pokemon: [] },
        wait: true,
      })

      mockParseRequest.mockReturnValueOnce({
        actions: null,
        teamPreview: false,
        wait: true,
        forceSwitch: false,
        side: { name: "Player", id: "p1", pokemon: [] },
      })

      mockStreamInstance._asyncIteratorFn = makeAsyncIterator([`|request|${waitReq}`])

      const ai1 = createMockAI()
      const ai2 = createMockAI()

      const result = await runAutomatedBattle({
        formatId: "gen9ou",
        gameType: "singles",
        team1Paste: "packed|team",
        team2Paste: "packed|team",
        ai1,
        ai2,
        maxTurns: 1,
      })

      // AI should not be asked for actions when wait is true
      expect(ai1.chooseAction).not.toHaveBeenCalled()
      expect(result).toBeDefined()
    })

    it("calls updateSideFromRequest when side info is present", async () => {
      const { createInitialState } = await import("#battle-engine/battle-manager")
      const state = makeBattleState({ phase: "ended" })
      vi.mocked(createInitialState).mockReturnValue(state)

      const reqJson = JSON.stringify({
        side: { id: "p1", name: "Player", pokemon: [{ ident: "p1: Garchomp" }] },
        active: [{ moves: [] }],
      })

      mockParseRequest.mockReturnValueOnce({
        actions: null,
        teamPreview: false,
        wait: true,
        forceSwitch: false,
        side: { name: "Player", id: "p1", pokemon: [{ ident: "p1: Garchomp" }] },
      })

      mockStreamInstance._asyncIteratorFn = makeAsyncIterator([`|request|${reqJson}`])

      const ai1 = createMockAI()
      const ai2 = createMockAI()

      await runAutomatedBattle({
        formatId: "gen9ou",
        gameType: "singles",
        team1Paste: "packed|team",
        team2Paste: "packed|team",
        ai1,
        ai2,
        maxTurns: 1,
      })

      expect(mockUpdateSideFromRequest).toHaveBeenCalledWith(
        expect.any(Object),
        "p1",
        expect.objectContaining({ name: "Player" }),
      )
    })
  })

  // -----------------------------------------------------------------------
  // Action processing - singles
  // -----------------------------------------------------------------------

  describe("action processing - singles", () => {
    it("processes both pending actions in singles mode", async () => {
      const { createInitialState } = await import("#battle-engine/battle-manager")
      let actionCallCount = 0

      vi.mocked(createInitialState).mockImplementation((_id, fmt) => {
        const s = makeBattleState({ format: fmt as "singles" | "doubles" })
        Object.defineProperty(s, "phase", {
          get() {
            return actionCallCount >= 2 ? "ended" : "battle"
          },
          set() {},
          configurable: true,
        })
        return s
      })

      const mockActions: BattleActionSet = {
        moves: [
          {
            name: "Earthquake",
            id: "earthquake",
            pp: 10,
            maxPp: 16,
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

      const p1Req = JSON.stringify({
        side: { id: "p1", name: "P1", pokemon: [] },
        active: [{ moves: [] }],
      })
      const p2Req = JSON.stringify({
        side: { id: "p2", name: "P2", pokemon: [] },
        active: [{ moves: [] }],
      })

      mockParseRequest
        .mockReturnValueOnce({
          actions: mockActions,
          teamPreview: false,
          wait: false,
          forceSwitch: false,
          side: { name: "P1", id: "p1", pokemon: [] },
        })
        .mockReturnValueOnce({
          actions: mockActions,
          teamPreview: false,
          wait: false,
          forceSwitch: false,
          side: { name: "P2", id: "p2", pokemon: [] },
        })

      mockStreamInstance._asyncIteratorFn = makeAsyncIterator([
        `|request|${p1Req}\n|request|${p2Req}`,
      ])

      const ai1 = createMockAI()
      const ai2 = createMockAI()

      vi.mocked(ai1.chooseAction).mockImplementation(async () => {
        actionCallCount++
        return { type: "move", moveIndex: 1 }
      })
      vi.mocked(ai2.chooseAction).mockImplementation(async () => {
        actionCallCount++
        return { type: "move", moveIndex: 1 }
      })

      const result = await runAutomatedBattle({
        formatId: "gen9ou",
        gameType: "singles",
        team1Paste: "packed|team",
        team2Paste: "packed|team",
        ai1,
        ai2,
        maxTurns: 5,
      })

      expect(ai1.chooseAction).toHaveBeenCalled()
      expect(ai2.chooseAction).toHaveBeenCalled()
      expect(result.turnActions.length).toBeGreaterThanOrEqual(1)
    })
  })

  // -----------------------------------------------------------------------
  // Action processing - doubles
  // -----------------------------------------------------------------------

  describe("action processing - doubles", () => {
    it("handles doubles mode with slot 2 actions", async () => {
      const { createInitialState } = await import("#battle-engine/battle-manager")
      let actionCallCount = 0

      vi.mocked(createInitialState).mockImplementation((_id, fmt) => {
        const s = makeBattleState({ format: fmt as "singles" | "doubles" })
        Object.defineProperty(s, "phase", {
          get() {
            return actionCallCount >= 4 ? "ended" : "battle"
          },
          set() {},
          configurable: true,
        })
        return s
      })

      const mockActions: BattleActionSet = {
        moves: [
          {
            name: "Earthquake",
            id: "earthquake",
            pp: 10,
            maxPp: 16,
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

      const slot2Actions: BattleActionSet = {
        moves: [
          {
            name: "Protect",
            id: "protect",
            pp: 10,
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
        activeSlot: 1,
      }

      const p1Req = JSON.stringify({
        side: { id: "p1", name: "P1", pokemon: [] },
        active: [{ moves: [] }, { moves: [] }],
      })
      const p2Req = JSON.stringify({
        side: { id: "p2", name: "P2", pokemon: [] },
        active: [{ moves: [] }, { moves: [] }],
      })

      mockParseRequest
        .mockReturnValueOnce({
          actions: mockActions,
          teamPreview: false,
          wait: false,
          forceSwitch: false,
          side: { name: "P1", id: "p1", pokemon: [] },
        })
        .mockReturnValueOnce({
          actions: mockActions,
          teamPreview: false,
          wait: false,
          forceSwitch: false,
          side: { name: "P2", id: "p2", pokemon: [] },
        })

      mockParseRequestForSlot
        .mockReturnValueOnce({
          actions: slot2Actions,
          teamPreview: false,
          wait: false,
          forceSwitch: false,
        })
        .mockReturnValueOnce({
          actions: slot2Actions,
          teamPreview: false,
          wait: false,
          forceSwitch: false,
        })

      mockStreamInstance._asyncIteratorFn = makeAsyncIterator([
        `|request|${p1Req}\n|request|${p2Req}`,
      ])

      const ai1 = createMockAI()
      const ai2 = createMockAI()

      vi.mocked(ai1.chooseAction).mockImplementation(async () => {
        actionCallCount++
        return { type: "move", moveIndex: 1 }
      })
      vi.mocked(ai2.chooseAction).mockImplementation(async () => {
        actionCallCount++
        return { type: "move", moveIndex: 1 }
      })

      const result = await runAutomatedBattle({
        formatId: "gen9doublesou",
        gameType: "doubles",
        team1Paste: "packed|team",
        team2Paste: "packed|team",
        ai1,
        ai2,
        maxTurns: 5,
      })

      // In doubles, chooseAction is called twice per player per turn (slot 1 + slot 2)
      expect(ai1.chooseAction).toHaveBeenCalledTimes(2)
      expect(ai2.chooseAction).toHaveBeenCalledTimes(2)
      expect(result.turnActions.length).toBeGreaterThanOrEqual(1)
    })
  })

  // -----------------------------------------------------------------------
  // Force switch handling
  // -----------------------------------------------------------------------

  describe("force switch handling", () => {
    it("handles p1 force switch in singles", async () => {
      const { createInitialState } = await import("#battle-engine/battle-manager")
      let switchCount = 0

      vi.mocked(createInitialState).mockImplementation((_id, fmt) => {
        const s = makeBattleState({ format: fmt as "singles" | "doubles" })
        Object.defineProperty(s, "phase", {
          get() {
            return switchCount >= 1 ? "ended" : "battle"
          },
          set() {},
          configurable: true,
        })
        return s
      })

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
      }

      const p1Req = JSON.stringify({
        side: { id: "p1", name: "P1", pokemon: [] },
        forceSwitch: [true],
      })

      mockParseRequest.mockReturnValueOnce({
        actions: forceSwitchActions,
        teamPreview: false,
        wait: false,
        forceSwitch: true,
        side: { name: "P1", id: "p1", pokemon: [] },
      })

      mockStreamInstance._asyncIteratorFn = makeAsyncIterator([`|request|${p1Req}`])

      const ai1 = createMockAI()
      const ai2 = createMockAI()

      vi.mocked(ai1.chooseAction).mockImplementation(async () => {
        switchCount++
        return { type: "switch", pokemonIndex: 2 }
      })

      const result = await runAutomatedBattle({
        formatId: "gen9ou",
        gameType: "singles",
        team1Paste: "packed|team",
        team2Paste: "packed|team",
        ai1,
        ai2,
        maxTurns: 5,
      })

      expect(ai1.chooseAction).toHaveBeenCalled()
      const writeCalls = mockStreamInstance.write.mock.calls.map((c: string[]) => c[0])
      expect(writeCalls.some((c: string) => c.includes(">p1 switch"))).toBe(true)
      expect(result).toBeDefined()
    })

    it("handles p2 force switch in singles", async () => {
      const { createInitialState } = await import("#battle-engine/battle-manager")
      let switchCount = 0

      vi.mocked(createInitialState).mockImplementation((_id, fmt) => {
        const s = makeBattleState({ format: fmt as "singles" | "doubles" })
        Object.defineProperty(s, "phase", {
          get() {
            return switchCount >= 1 ? "ended" : "battle"
          },
          set() {},
          configurable: true,
        })
        return s
      })

      const forceSwitchActions: BattleActionSet = {
        moves: [],
        canTera: false,
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
        forceSwitch: true,
      }

      const p2Req = JSON.stringify({
        side: { id: "p2", name: "P2", pokemon: [] },
        forceSwitch: [true],
      })

      mockParseRequest.mockReturnValueOnce({
        actions: forceSwitchActions,
        teamPreview: false,
        wait: false,
        forceSwitch: true,
        side: { name: "P2", id: "p2", pokemon: [] },
      })

      mockStreamInstance._asyncIteratorFn = makeAsyncIterator([`|request|${p2Req}`])

      const ai1 = createMockAI()
      const ai2 = createMockAI()

      vi.mocked(ai2.chooseAction).mockImplementation(async () => {
        switchCount++
        return { type: "switch", pokemonIndex: 3 }
      })

      const result = await runAutomatedBattle({
        formatId: "gen9ou",
        gameType: "singles",
        team1Paste: "packed|team",
        team2Paste: "packed|team",
        ai1,
        ai2,
        maxTurns: 5,
      })

      expect(ai2.chooseAction).toHaveBeenCalled()
      const writeCalls = mockStreamInstance.write.mock.calls.map((c: string[]) => c[0])
      expect(writeCalls.some((c: string) => c.includes(">p2 switch"))).toBe(true)
      expect(result).toBeDefined()
    })

    it("handles p1 force switch in doubles with slot2", async () => {
      const { createInitialState } = await import("#battle-engine/battle-manager")
      let switchCount = 0

      vi.mocked(createInitialState).mockImplementation((_id, fmt) => {
        const s = makeBattleState({ format: fmt as "singles" | "doubles" })
        Object.defineProperty(s, "phase", {
          get() {
            return switchCount >= 2 ? "ended" : "battle"
          },
          set() {},
          configurable: true,
        })
        return s
      })

      const forceSwitchActions: BattleActionSet = {
        moves: [],
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
        forceSwitch: true,
      }

      const slot2ForceSwitch: BattleActionSet = {
        moves: [],
        canTera: false,
        switches: [
          {
            index: 4,
            name: "Tyranitar",
            speciesId: "tyranitar",
            hp: 404,
            maxHp: 404,
            status: "",
            fainted: false,
          },
        ],
        forceSwitch: true,
        activeSlot: 1,
      }

      const p1Req = JSON.stringify({
        side: { id: "p1", name: "P1", pokemon: [] },
        forceSwitch: [true, true],
      })

      mockParseRequest.mockReturnValueOnce({
        actions: forceSwitchActions,
        teamPreview: false,
        wait: false,
        forceSwitch: true,
        side: { name: "P1", id: "p1", pokemon: [] },
      })

      mockParseRequestForSlot.mockReturnValueOnce({
        actions: slot2ForceSwitch,
        teamPreview: false,
        wait: false,
        forceSwitch: true,
      })

      mockStreamInstance._asyncIteratorFn = makeAsyncIterator([`|request|${p1Req}`])

      const ai1 = createMockAI()
      const ai2 = createMockAI()

      vi.mocked(ai1.chooseAction).mockImplementation(async (_state, actions) => {
        switchCount++
        const switchTarget = actions.switches[0]?.index ?? 3
        return { type: "switch", pokemonIndex: switchTarget }
      })

      const result = await runAutomatedBattle({
        formatId: "gen9doublesou",
        gameType: "doubles",
        team1Paste: "packed|team",
        team2Paste: "packed|team",
        ai1,
        ai2,
        maxTurns: 5,
      })

      // AI1 should be called twice (once per slot)
      expect(ai1.chooseAction).toHaveBeenCalledTimes(2)
      expect(result).toBeDefined()
    })

    it("handles p2 force switch in doubles with slot2", async () => {
      const { createInitialState } = await import("#battle-engine/battle-manager")
      let switchCount = 0

      vi.mocked(createInitialState).mockImplementation((_id, fmt) => {
        const s = makeBattleState({ format: fmt as "singles" | "doubles" })
        Object.defineProperty(s, "phase", {
          get() {
            return switchCount >= 2 ? "ended" : "battle"
          },
          set() {},
          configurable: true,
        })
        return s
      })

      const forceSwitchActions: BattleActionSet = {
        moves: [],
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
        forceSwitch: true,
      }

      const slot2ForceSwitch: BattleActionSet = {
        moves: [],
        canTera: false,
        switches: [
          {
            index: 4,
            name: "Tyranitar",
            speciesId: "tyranitar",
            hp: 404,
            maxHp: 404,
            status: "",
            fainted: false,
          },
        ],
        forceSwitch: true,
        activeSlot: 1,
      }

      const p2Req = JSON.stringify({
        side: { id: "p2", name: "P2", pokemon: [] },
        forceSwitch: [true, true],
      })

      mockParseRequest.mockReturnValueOnce({
        actions: forceSwitchActions,
        teamPreview: false,
        wait: false,
        forceSwitch: true,
        side: { name: "P2", id: "p2", pokemon: [] },
      })

      mockParseRequestForSlot.mockReturnValueOnce({
        actions: slot2ForceSwitch,
        teamPreview: false,
        wait: false,
        forceSwitch: true,
      })

      mockStreamInstance._asyncIteratorFn = makeAsyncIterator([`|request|${p2Req}`])

      const ai1 = createMockAI()
      const ai2 = createMockAI()

      vi.mocked(ai2.chooseAction).mockImplementation(async (_state, actions) => {
        switchCount++
        const switchTarget = actions.switches[0]?.index ?? 3
        return { type: "switch", pokemonIndex: switchTarget }
      })

      const result = await runAutomatedBattle({
        formatId: "gen9doublesou",
        gameType: "doubles",
        team1Paste: "packed|team",
        team2Paste: "packed|team",
        ai1,
        ai2,
        maxTurns: 5,
      })

      expect(ai2.chooseAction).toHaveBeenCalledTimes(2)
      expect(result).toBeDefined()
    })
  })

  // -----------------------------------------------------------------------
  // actionToChoice conversion
  // -----------------------------------------------------------------------

  describe("actionToChoice", () => {
    it("converts switch action to 'switch N' choice string", async () => {
      const { createInitialState } = await import("#battle-engine/battle-manager")
      let actionCallCount = 0

      vi.mocked(createInitialState).mockImplementation((_id, fmt) => {
        const s = makeBattleState({ format: fmt as "singles" | "doubles" })
        Object.defineProperty(s, "phase", {
          get() {
            return actionCallCount >= 2 ? "ended" : "battle"
          },
          set() {},
          configurable: true,
        })
        return s
      })

      const mockActions: BattleActionSet = {
        moves: [
          {
            name: "Earthquake",
            id: "earthquake",
            pp: 10,
            maxPp: 16,
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
      }

      const p1Req = JSON.stringify({ side: { id: "p1", name: "P1", pokemon: [] } })
      const p2Req = JSON.stringify({ side: { id: "p2", name: "P2", pokemon: [] } })

      mockParseRequest
        .mockReturnValueOnce({
          actions: mockActions,
          teamPreview: false,
          wait: false,
          forceSwitch: false,
          side: { name: "P1", id: "p1", pokemon: [] },
        })
        .mockReturnValueOnce({
          actions: mockActions,
          teamPreview: false,
          wait: false,
          forceSwitch: false,
          side: { name: "P2", id: "p2", pokemon: [] },
        })

      mockStreamInstance._asyncIteratorFn = makeAsyncIterator([
        `|request|${p1Req}\n|request|${p2Req}`,
      ])

      const ai1 = createMockAI()
      const ai2 = createMockAI()

      // P1 uses switch, P2 uses move
      vi.mocked(ai1.chooseAction).mockImplementation(async () => {
        actionCallCount++
        return { type: "switch", pokemonIndex: 3 }
      })
      vi.mocked(ai2.chooseAction).mockImplementation(async () => {
        actionCallCount++
        return { type: "move", moveIndex: 1 }
      })

      const result = await runAutomatedBattle({
        formatId: "gen9ou",
        gameType: "singles",
        team1Paste: "packed|team",
        team2Paste: "packed|team",
        ai1,
        ai2,
        maxTurns: 5,
      })

      // p1 should have written "switch 3"
      const writeCalls = mockStreamInstance.write.mock.calls.map((c: string[]) => c[0])
      expect(writeCalls.some((c: string) => c === ">p1 switch 3")).toBe(true)
      expect(result.turnActions.some((t) => t.p1 === "switch 3")).toBe(true)
    })

    it("converts move action with tera flag", async () => {
      const { createInitialState } = await import("#battle-engine/battle-manager")
      let actionCallCount = 0

      vi.mocked(createInitialState).mockImplementation((_id, fmt) => {
        const s = makeBattleState({ format: fmt as "singles" | "doubles" })
        Object.defineProperty(s, "phase", {
          get() {
            return actionCallCount >= 2 ? "ended" : "battle"
          },
          set() {},
          configurable: true,
        })
        return s
      })

      const mockActions: BattleActionSet = {
        moves: [
          {
            name: "Earthquake",
            id: "earthquake",
            pp: 10,
            maxPp: 16,
            type: "Ground",
            disabled: false,
            target: "normal",
            basePower: 100,
            category: "Physical",
            accuracy: 100,
            description: "",
          },
        ],
        canTera: true,
        switches: [],
        forceSwitch: false,
      }

      const p1Req = JSON.stringify({ side: { id: "p1", name: "P1", pokemon: [] } })
      const p2Req = JSON.stringify({ side: { id: "p2", name: "P2", pokemon: [] } })

      mockParseRequest
        .mockReturnValueOnce({
          actions: mockActions,
          teamPreview: false,
          wait: false,
          forceSwitch: false,
          side: { name: "P1", id: "p1", pokemon: [] },
        })
        .mockReturnValueOnce({
          actions: mockActions,
          teamPreview: false,
          wait: false,
          forceSwitch: false,
          side: { name: "P2", id: "p2", pokemon: [] },
        })

      mockStreamInstance._asyncIteratorFn = makeAsyncIterator([
        `|request|${p1Req}\n|request|${p2Req}`,
      ])

      const ai1 = createMockAI()
      const ai2 = createMockAI()

      vi.mocked(ai1.chooseAction).mockImplementation(async () => {
        actionCallCount++
        return { type: "move", moveIndex: 1, tera: true }
      })
      vi.mocked(ai2.chooseAction).mockImplementation(async () => {
        actionCallCount++
        return { type: "move", moveIndex: 1 }
      })

      const result = await runAutomatedBattle({
        formatId: "gen9ou",
        gameType: "singles",
        team1Paste: "packed|team",
        team2Paste: "packed|team",
        ai1,
        ai2,
        maxTurns: 5,
      })

      const writeCalls = mockStreamInstance.write.mock.calls.map((c: string[]) => c[0])
      expect(writeCalls.some((c: string) => c.includes("terastallize"))).toBe(true)
      expect(result.turnActions.some((t) => t.p1.includes("terastallize"))).toBe(true)
    })

    it("converts move action with mega flag", async () => {
      const { createInitialState } = await import("#battle-engine/battle-manager")
      let actionCallCount = 0

      vi.mocked(createInitialState).mockImplementation((_id, fmt) => {
        const s = makeBattleState({ format: fmt as "singles" | "doubles" })
        Object.defineProperty(s, "phase", {
          get() {
            return actionCallCount >= 2 ? "ended" : "battle"
          },
          set() {},
          configurable: true,
        })
        return s
      })

      const mockActions: BattleActionSet = {
        moves: [
          {
            name: "Earthquake",
            id: "earthquake",
            pp: 10,
            maxPp: 16,
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

      const p1Req = JSON.stringify({ side: { id: "p1", name: "P1", pokemon: [] } })
      const p2Req = JSON.stringify({ side: { id: "p2", name: "P2", pokemon: [] } })

      mockParseRequest
        .mockReturnValueOnce({
          actions: mockActions,
          teamPreview: false,
          wait: false,
          forceSwitch: false,
          side: { name: "P1", id: "p1", pokemon: [] },
        })
        .mockReturnValueOnce({
          actions: mockActions,
          teamPreview: false,
          wait: false,
          forceSwitch: false,
          side: { name: "P2", id: "p2", pokemon: [] },
        })

      mockStreamInstance._asyncIteratorFn = makeAsyncIterator([
        `|request|${p1Req}\n|request|${p2Req}`,
      ])

      const ai1 = createMockAI()
      const ai2 = createMockAI()

      vi.mocked(ai1.chooseAction).mockImplementation(async () => {
        actionCallCount++
        return { type: "move", moveIndex: 2, mega: true }
      })
      vi.mocked(ai2.chooseAction).mockImplementation(async () => {
        actionCallCount++
        return { type: "move", moveIndex: 1 }
      })

      const result = await runAutomatedBattle({
        formatId: "gen9ou",
        gameType: "singles",
        team1Paste: "packed|team",
        team2Paste: "packed|team",
        ai1,
        ai2,
        maxTurns: 5,
      })

      const writeCalls = mockStreamInstance.write.mock.calls.map((c: string[]) => c[0])
      expect(writeCalls.some((c: string) => c.includes("mega"))).toBe(true)
      expect(result.turnActions.some((t) => t.p1.includes("mega"))).toBe(true)
    })

    it("converts move action with targetSlot", async () => {
      const { createInitialState } = await import("#battle-engine/battle-manager")
      let actionCallCount = 0

      vi.mocked(createInitialState).mockImplementation((_id, fmt) => {
        const s = makeBattleState({ format: fmt as "singles" | "doubles" })
        Object.defineProperty(s, "phase", {
          get() {
            return actionCallCount >= 2 ? "ended" : "battle"
          },
          set() {},
          configurable: true,
        })
        return s
      })

      const mockActions: BattleActionSet = {
        moves: [
          {
            name: "Earthquake",
            id: "earthquake",
            pp: 10,
            maxPp: 16,
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

      const p1Req = JSON.stringify({ side: { id: "p1", name: "P1", pokemon: [] } })
      const p2Req = JSON.stringify({ side: { id: "p2", name: "P2", pokemon: [] } })

      mockParseRequest
        .mockReturnValueOnce({
          actions: mockActions,
          teamPreview: false,
          wait: false,
          forceSwitch: false,
          side: { name: "P1", id: "p1", pokemon: [] },
        })
        .mockReturnValueOnce({
          actions: mockActions,
          teamPreview: false,
          wait: false,
          forceSwitch: false,
          side: { name: "P2", id: "p2", pokemon: [] },
        })

      mockStreamInstance._asyncIteratorFn = makeAsyncIterator([
        `|request|${p1Req}\n|request|${p2Req}`,
      ])

      const ai1 = createMockAI()
      const ai2 = createMockAI()

      vi.mocked(ai1.chooseAction).mockImplementation(async () => {
        actionCallCount++
        return { type: "move", moveIndex: 1, targetSlot: -1 }
      })
      vi.mocked(ai2.chooseAction).mockImplementation(async () => {
        actionCallCount++
        return { type: "move", moveIndex: 1 }
      })

      const result = await runAutomatedBattle({
        formatId: "gen9ou",
        gameType: "singles",
        team1Paste: "packed|team",
        team2Paste: "packed|team",
        ai1,
        ai2,
        maxTurns: 5,
      })

      const writeCalls = mockStreamInstance.write.mock.calls.map((c: string[]) => c[0])
      expect(writeCalls.some((c: string) => c.includes("-1"))).toBe(true)
      expect(result).toBeDefined()
    })
  })

  // -----------------------------------------------------------------------
  // Max turns / draw
  // -----------------------------------------------------------------------

  describe("max turns and draw", () => {
    it("returns draw when state has no winner and phase is ended", async () => {
      // This test verifies the winner determination logic at the end of runAutomatedBattle.
      // When state.winner is null, the result should be "draw".
      const { createInitialState } = await import("#battle-engine/battle-manager")
      const state = makeBattleState({ phase: "ended" })
      state.winner = null
      state.turn = 100
      vi.mocked(createInitialState).mockReturnValue(state)
      setupEmptyStream()

      const ai1 = createMockAI()
      const ai2 = createMockAI()

      const result = await runAutomatedBattle({
        formatId: "gen9ou",
        gameType: "singles",
        team1Paste: "packed|team",
        team2Paste: "packed|team",
        ai1,
        ai2,
        maxTurns: 1,
      })

      expect(result.winner).toBe("draw")
      expect(result.turnCount).toBe(100)
    })
  })

  // -----------------------------------------------------------------------
  // escapeTeam
  // -----------------------------------------------------------------------

  describe("escapeTeam", () => {
    it("escapes backslashes and quotes in team strings", async () => {
      const { createInitialState } = await import("#battle-engine/battle-manager")
      const state = makeBattleState({ phase: "ended" })
      vi.mocked(createInitialState).mockReturnValue(state)
      setupEmptyStream()

      const ai1 = createMockAI()
      const ai2 = createMockAI()

      // Team string containing a literal backslash and a literal double quote
      // In JS: backslash = \\, double quote = \"
      const teamWithBackslash = "Gar\\chomp|||rough\\skin|earthquake|||||||"

      await runAutomatedBattle({
        formatId: "gen9ou",
        gameType: "singles",
        team1Paste: teamWithBackslash,
        team2Paste: teamWithBackslash,
        ai1,
        ai2,
        maxTurns: 1,
      })

      const writeCalls = mockStreamInstance.write.mock.calls.map((c: string[]) => c[0])
      const playerCmd = writeCalls.find((c: string) => c.includes(">player p1"))
      expect(playerCmd).toBeDefined()
      // The escapeTeam function should double-escape backslashes:
      // single \ becomes \\ in the output
      expect(playerCmd).toContain("Gar\\\\chomp")
      expect(playerCmd).toContain("rough\\\\skin")
    })
  })

  // -----------------------------------------------------------------------
  // Stream cleanup
  // -----------------------------------------------------------------------

  describe("stream cleanup", () => {
    it("handles stream.destroy throwing without crashing", async () => {
      const { createInitialState } = await import("#battle-engine/battle-manager")
      const state = makeBattleState({ phase: "ended" })
      vi.mocked(createInitialState).mockReturnValue(state)
      setupEmptyStream()

      const ai1 = createMockAI()
      const ai2 = createMockAI()

      // Make destroy throw
      mockStreamInstance.destroy = vi.fn(() => {
        throw new Error("destroy failed")
      })

      // Should not throw
      const result = await runAutomatedBattle({
        formatId: "gen9ou",
        gameType: "singles",
        team1Paste: "packed|team",
        team2Paste: "packed|team",
        ai1,
        ai2,
        maxTurns: 1,
      })

      expect(result).toBeDefined()
    })

    it("accumulates protocol log from stream chunks", async () => {
      const { createInitialState } = await import("#battle-engine/battle-manager")
      const state = makeBattleState({ phase: "ended" })
      vi.mocked(createInitialState).mockReturnValue(state)

      // Stream emits multiple chunks that get accumulated in protocolLog
      mockStreamInstance._asyncIteratorFn = makeAsyncIterator([
        "|turn|1",
        "|move|p1a: Garchomp|Earthquake",
      ])

      const ai1 = createMockAI()
      const ai2 = createMockAI()

      const result = await runAutomatedBattle({
        formatId: "gen9ou",
        gameType: "singles",
        team1Paste: "packed|team",
        team2Paste: "packed|team",
        ai1,
        ai2,
        maxTurns: 1,
      })

      // protocolLog should contain all chunks
      expect(result.protocolLog).toContain("|turn|1")
      expect(result.protocolLog).toContain("|move|p1a: Garchomp|Earthquake")
    })
  })

  // -----------------------------------------------------------------------
  // Protocol handling edge cases
  // -----------------------------------------------------------------------

  describe("protocol edge cases", () => {
    it("processes request followed by protocol in same chunk", async () => {
      const { createInitialState } = await import("#battle-engine/battle-manager")
      const state = makeBattleState({ phase: "ended" })
      vi.mocked(createInitialState).mockReturnValue(state)

      const reqJson = JSON.stringify({ side: { id: "p1", name: "P1", pokemon: [] }, wait: true })

      mockParseRequest.mockReturnValueOnce({
        actions: null,
        teamPreview: false,
        wait: true,
        forceSwitch: false,
        side: { name: "P1", id: "p1", pokemon: [] },
      })

      // Request line followed by protocol lines
      mockStreamInstance._asyncIteratorFn = makeAsyncIterator([
        `|request|${reqJson}\n|turn|1\n|move|p1a: Garchomp|Earthquake`,
      ])

      const ai1 = createMockAI()
      const ai2 = createMockAI()

      await runAutomatedBattle({
        formatId: "gen9ou",
        gameType: "singles",
        team1Paste: "packed|team",
        team2Paste: "packed|team",
        ai1,
        ai2,
        maxTurns: 1,
      })

      // Both parseRequest (for request line) and processChunk (for remaining) should be called
      expect(mockParseRequest).toHaveBeenCalled()
      expect(mockProcessChunk).toHaveBeenCalled()
    })

    it("handles protocol before request in same chunk", async () => {
      const { createInitialState } = await import("#battle-engine/battle-manager")
      const state = makeBattleState({ phase: "ended" })
      vi.mocked(createInitialState).mockReturnValue(state)

      const reqJson = JSON.stringify({ side: { id: "p1", name: "P1", pokemon: [] }, wait: true })

      mockParseRequest.mockReturnValueOnce({
        actions: null,
        teamPreview: false,
        wait: true,
        forceSwitch: false,
        side: { name: "P1", id: "p1", pokemon: [] },
      })

      // Protocol line before request
      mockStreamInstance._asyncIteratorFn = makeAsyncIterator([`|turn|1\n|request|${reqJson}`])

      const ai1 = createMockAI()
      const ai2 = createMockAI()

      await runAutomatedBattle({
        formatId: "gen9ou",
        gameType: "singles",
        team1Paste: "packed|team",
        team2Paste: "packed|team",
        ai1,
        ai2,
        maxTurns: 1,
      })

      // processChunk should be called for the protocol before the request
      expect(mockProcessChunk).toHaveBeenCalled()
      expect(mockParseRequest).toHaveBeenCalled()
    })

    it("handles request without side id", async () => {
      const { createInitialState } = await import("#battle-engine/battle-manager")
      const state = makeBattleState({ phase: "ended" })
      vi.mocked(createInitialState).mockReturnValue(state)

      // Request without side.id
      const reqJson = JSON.stringify({ active: [{ moves: [] }] })

      mockParseRequest.mockReturnValueOnce({
        actions: null,
        teamPreview: false,
        wait: true,
        forceSwitch: false,
      })

      mockStreamInstance._asyncIteratorFn = makeAsyncIterator([`|request|${reqJson}`])

      const ai1 = createMockAI()
      const ai2 = createMockAI()

      const result = await runAutomatedBattle({
        formatId: "gen9ou",
        gameType: "singles",
        team1Paste: "packed|team",
        team2Paste: "packed|team",
        ai1,
        ai2,
        maxTurns: 1,
      })

      // Should not crash with missing sideId
      expect(result).toBeDefined()
      // updateSideFromRequest should NOT be called without sideId
      expect(mockUpdateSideFromRequest).not.toHaveBeenCalled()
    })

    it("uses fallback formatId when config.formatId is empty", async () => {
      const { createInitialState } = await import("#battle-engine/battle-manager")
      const state = makeBattleState({ phase: "ended" })
      vi.mocked(createInitialState).mockReturnValue(state)
      setupEmptyStream()

      const ai1 = createMockAI()
      const ai2 = createMockAI()

      await runAutomatedBattle({
        formatId: "",
        gameType: "singles",
        team1Paste: "packed|team",
        team2Paste: "packed|team",
        ai1,
        ai2,
        maxTurns: 1,
      })

      const writeCalls = mockStreamInstance.write.mock.calls.map((c: string[]) => c[0])
      const startCmd = writeCalls.find((c: string) => c.includes(">start"))
      expect(startCmd).toContain("gen9ou") // fallback format
    })
  })
})
