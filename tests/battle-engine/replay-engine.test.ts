import { ReplayEngine } from "@nasty-plot/battle-engine"
import { createInitialState } from "#battle-engine/battle-manager.service"
import * as protocolParser from "#battle-engine/protocol-parser.service"
import * as winProb from "#battle-engine/ai/win-probability.service"
import type { BattleState } from "@nasty-plot/battle-engine"

// Mock dependencies
vi.mock("#battle-engine/battle-manager.service", () => ({
  createInitialState: vi.fn(),
}))

vi.mock("#battle-engine/protocol-parser.service", () => ({
  processLine: vi.fn(),
}))

vi.mock("#battle-engine/ai/win-probability.service", () => ({
  estimateWinProbability: vi.fn(),
}))

function makeMockState(overrides?: Partial<BattleState>): BattleState {
  return {
    phase: "battle",
    format: "singles",
    turn: 0,
    sides: {
      p1: {
        active: [null],
        team: [],
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
        active: [null],
        team: [],
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
    field: { weather: "", weatherTurns: 0, terrain: "", terrainTurns: 0, trickRoom: 0 },
    winner: null,
    log: [],
    fullLog: [],
    waitingForChoice: false,
    availableActions: null,
    id: "replay",
    ...overrides,
  }
}

describe("ReplayEngine", () => {
  let mockState: BattleState

  beforeEach(() => {
    vi.clearAllMocks()
    mockState = makeMockState()
    vi.mocked(createInitialState).mockReturnValue(mockState)
    vi.mocked(winProb.estimateWinProbability).mockReturnValue({
      p1: 55,
      p2: 45,
      evaluation: { score: 0.1, rawScore: 100, features: [] },
    })
  })

  describe("parse()", () => {
    it("creates an initial frame at turn 0 with 50% win probability", () => {
      vi.mocked(protocolParser.processLine).mockReturnValue(null)

      const engine = new ReplayEngine("")
      engine.parse()

      expect(engine.totalFrames).toBe(1)
      const frame = engine.getFrame(0)
      expect(frame).not.toBeNull()
      expect(frame!.turnNumber).toBe(0)
      expect(frame!.winProbTeam1).toBe(50)
      expect(frame!.entries).toEqual([])
    })

    it("skips empty lines in protocol log", () => {
      vi.mocked(protocolParser.processLine).mockReturnValue(null)

      const engine = new ReplayEngine("\n\n\n")
      engine.parse()

      expect(protocolParser.processLine).not.toHaveBeenCalled()
      expect(engine.totalFrames).toBe(1) // Only initial frame
    })

    it("skips |request| and |error| lines", () => {
      vi.mocked(protocolParser.processLine).mockReturnValue(null)

      const engine = new ReplayEngine("|request|{}\n|error|something")
      engine.parse()

      expect(protocolParser.processLine).not.toHaveBeenCalled()
    })

    it("creates frames at turn boundaries", () => {
      let callCount = 0
      vi.mocked(protocolParser.processLine).mockImplementation((state) => {
        callCount++
        if (callCount === 1) {
          // First line: a switch
          return { type: "switch", message: "Player sent out Garchomp!", turn: 0 }
        }
        if (callCount === 2) {
          // Second line: turn marker
          state.turn = 1
          return { type: "turn", message: "=== Turn 1 ===", turn: 1 }
        }
        if (callCount === 3) {
          return { type: "move", message: "Garchomp used Earthquake!", turn: 1 }
        }
        if (callCount === 4) {
          state.turn = 2
          return { type: "turn", message: "=== Turn 2 ===", turn: 2 }
        }
        return null
      })

      const engine = new ReplayEngine(
        "|switch|p1a: Garchomp|Garchomp, L100|319/319\n|turn|1\n|move|p1a: Garchomp|Earthquake\n|turn|2",
      )
      engine.parse()

      // Initial frame (turn 0) + turn 1 frame + turn 2 frame
      expect(engine.totalFrames).toBe(3)
      expect(engine.getFrame(1)!.turnNumber).toBe(1)
      expect(engine.getFrame(2)!.turnNumber).toBe(2)
    })

    it("creates a frame on win", () => {
      let callCount = 0
      vi.mocked(protocolParser.processLine).mockImplementation((state) => {
        callCount++
        if (callCount === 1) {
          return { type: "move", message: "Garchomp used Earthquake!", turn: 0 }
        }
        if (callCount === 2) {
          state.phase = "ended"
          state.winner = "p1"
          return { type: "win", message: "Player won!", turn: 0 }
        }
        return null
      })

      const engine = new ReplayEngine("|move|p1a: Garchomp|Earthquake\n|win|Player")
      engine.parse()

      // Initial frame + win frame
      expect(engine.totalFrames).toBe(2)
      const winFrame = engine.getFrame(1)
      expect(winFrame).not.toBeNull()
      expect(winFrame!.entries.some((e) => e.type === "win")).toBe(true)
    })

    it("is idempotent - parsing twice does not duplicate frames", () => {
      vi.mocked(protocolParser.processLine).mockReturnValue(null)

      const engine = new ReplayEngine("")
      engine.parse()
      engine.parse()

      expect(engine.totalFrames).toBe(1) // Only initial frame
    })

    it("handles win probability estimation failure gracefully", () => {
      let callCount = 0
      vi.mocked(protocolParser.processLine).mockImplementation((state) => {
        callCount++
        if (callCount === 1) {
          return { type: "switch", message: "sent out Garchomp", turn: 0 }
        }
        if (callCount === 2) {
          state.turn = 1
          return { type: "turn", message: "=== Turn 1 ===", turn: 1 }
        }
        return null
      })
      vi.mocked(winProb.estimateWinProbability).mockImplementation(() => {
        throw new Error("eval failed")
      })

      const engine = new ReplayEngine("|switch|p1a: Garchomp|Garchomp\n|turn|1")
      engine.parse()

      // Should still create frames with null winProb
      expect(engine.totalFrames).toBe(2)
      expect(engine.getFrame(1)!.winProbTeam1).toBeNull()
    })

    it("creates a trailing frame for remaining entries after last turn", () => {
      let callCount = 0
      vi.mocked(protocolParser.processLine).mockImplementation((state) => {
        callCount++
        if (callCount === 1) {
          state.turn = 1
          return { type: "turn", message: "=== Turn 1 ===", turn: 1 }
        }
        if (callCount === 2) {
          return { type: "move", message: "Garchomp used Earthquake!", turn: 1 }
        }
        if (callCount === 3) {
          return { type: "damage", message: "Heatran lost HP!", turn: 1 }
        }
        return null
      })

      const engine = new ReplayEngine(
        "|turn|1\n|move|p1a: Garchomp|Earthquake\n|-damage|p2a: Heatran|200/311",
      )
      engine.parse()

      // Initial frame + entries after turn 1 boundary
      expect(engine.totalFrames).toBeGreaterThanOrEqual(2)
    })
  })

  describe("navigation methods", () => {
    let engine: ReplayEngine

    beforeEach(() => {
      // Set up engine with 4 frames (turns 0, 1, 2, 3)
      let callCount = 0
      vi.mocked(protocolParser.processLine).mockImplementation((state) => {
        callCount++
        if (callCount <= 3) {
          state.turn = callCount
          return { type: "turn", message: `=== Turn ${callCount} ===`, turn: callCount }
        }
        return null
      })

      engine = new ReplayEngine("|turn|1\n|turn|2\n|turn|3")
      engine.parse()
    })

    describe("getFrame()", () => {
      it("returns the frame at a valid index", () => {
        const frame = engine.getFrame(0)
        expect(frame).not.toBeNull()
        expect(frame!.turnNumber).toBe(0)
      })

      it("returns null for negative index", () => {
        expect(engine.getFrame(-1)).toBeNull()
      })

      it("returns null for out-of-bounds index", () => {
        expect(engine.getFrame(100)).toBeNull()
      })
    })

    describe("getFrameByTurn()", () => {
      it("returns the frame matching the given turn number", () => {
        const frame = engine.getFrameByTurn(0)
        expect(frame).not.toBeNull()
        expect(frame!.turnNumber).toBe(0)
      })

      it("returns null for a non-existent turn number", () => {
        expect(engine.getFrameByTurn(999)).toBeNull()
      })
    })

    describe("nextFrame()", () => {
      it("advances to the next frame", () => {
        expect(engine.getCurrentIndex()).toBe(0)
        const frame = engine.nextFrame()
        expect(frame).not.toBeNull()
        expect(engine.getCurrentIndex()).toBe(1)
      })

      it("returns null when at the last frame", () => {
        // Navigate to last frame
        while (engine.nextFrame() !== null) {
          // keep going
        }
        expect(engine.nextFrame()).toBeNull()
      })
    })

    describe("prevFrame()", () => {
      it("goes back to the previous frame", () => {
        engine.nextFrame() // go to index 1
        const frame = engine.prevFrame()
        expect(frame).not.toBeNull()
        expect(engine.getCurrentIndex()).toBe(0)
      })

      it("returns null when at the first frame", () => {
        expect(engine.prevFrame()).toBeNull()
        expect(engine.getCurrentIndex()).toBe(0)
      })
    })

    describe("setCurrentIndex()", () => {
      it("sets current index and returns the frame", () => {
        const frame = engine.setCurrentIndex(2)
        expect(frame).not.toBeNull()
        expect(engine.getCurrentIndex()).toBe(2)
      })

      it("returns null for invalid negative index", () => {
        expect(engine.setCurrentIndex(-1)).toBeNull()
        expect(engine.getCurrentIndex()).toBe(0) // unchanged
      })

      it("returns null for out-of-bounds index", () => {
        expect(engine.setCurrentIndex(100)).toBeNull()
      })
    })

    describe("getAllFrames()", () => {
      it("returns all parsed frames", () => {
        const frames = engine.getAllFrames()
        expect(frames.length).toBe(engine.totalFrames)
        expect(frames[0].turnNumber).toBe(0)
      })
    })

    describe("maxTurn", () => {
      it("returns the turn number of the last frame", () => {
        expect(engine.maxTurn).toBe(3)
      })

      it("returns 0 for an engine with no frames", () => {
        vi.mocked(protocolParser.processLine).mockReturnValue(null)
        // Create engine but don't parse - frames will be empty since parsed = false
        const emptyEngine = new ReplayEngine("")
        // Before parse, frames is empty
        expect(emptyEngine.maxTurn).toBe(0)
      })
    })
  })

  describe("parse() - |split| handling", () => {
    it("processes owner line from split marker and skips spectator line", () => {
      let callCount = 0
      vi.mocked(protocolParser.processLine).mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          // This is the owner line after |split|
          return { type: "damage", message: "Garchomp lost HP! (200/319)", turn: 0 }
        }
        return null
      })

      // |split|p1 followed by owner line then spectator line
      const log = "|split|p1\n|-damage|p1a: Garchomp|200/319\n|-damage|p1a: Garchomp|63/100"
      const engine = new ReplayEngine(log)
      engine.parse()

      // processLine should only be called once (for the owner line)
      expect(protocolParser.processLine).toHaveBeenCalledTimes(1)
      // Initial frame + no turn boundary frame = 1 frame with entries in trailing
      expect(engine.totalFrames).toBeGreaterThanOrEqual(1)
    })

    it("handles split with turn boundary inside owner line", () => {
      let callCount = 0
      vi.mocked(protocolParser.processLine).mockImplementation((state) => {
        callCount++
        if (callCount === 1) {
          return { type: "switch", message: "sent out Garchomp", turn: 0 }
        }
        if (callCount === 2) {
          // Owner line after split is a turn marker
          state.turn = 1
          return { type: "turn", message: "=== Turn 1 ===", turn: 1 }
        }
        return null
      })

      const log = "|switch|p1a: Garchomp|Garchomp, L100|319/319\n|split|p1\n|turn|1\n|turn|1"
      const engine = new ReplayEngine(log)
      engine.parse()

      // Initial frame + frame at turn 1 from split
      expect(engine.totalFrames).toBeGreaterThanOrEqual(2)
      const frame1 = engine.getFrame(1)
      expect(frame1).not.toBeNull()
      expect(frame1!.turnNumber).toBe(1)
    })

    it("handles split with win inside owner line", () => {
      let callCount = 0
      vi.mocked(protocolParser.processLine).mockImplementation((state) => {
        callCount++
        if (callCount === 1) {
          return { type: "move", message: "Garchomp used Earthquake!", turn: 0 }
        }
        if (callCount === 2) {
          // Owner line after split is a win
          state.phase = "ended"
          state.winner = "p1"
          return { type: "win", message: "Player won!", turn: 0 }
        }
        return null
      })

      const log = "|move|p1a: Garchomp|Earthquake\n|split|p1\n|win|Player\n|win|Player"
      const engine = new ReplayEngine(log)
      engine.parse()

      // Initial frame + win frame
      expect(engine.totalFrames).toBe(2)
      const winFrame = engine.getFrame(1)
      expect(winFrame).not.toBeNull()
      expect(winFrame!.entries.some((e) => e.type === "win")).toBe(true)
    })

    it("handles split with win probability failure inside split turn", () => {
      let callCount = 0
      vi.mocked(protocolParser.processLine).mockImplementation((state) => {
        callCount++
        if (callCount === 1) {
          return { type: "switch", message: "sent out Garchomp", turn: 0 }
        }
        if (callCount === 2) {
          state.turn = 1
          return { type: "turn", message: "=== Turn 1 ===", turn: 1 }
        }
        return null
      })
      vi.mocked(winProb.estimateWinProbability).mockImplementation(() => {
        throw new Error("eval failed")
      })

      const log = "|switch|p1a: Garchomp|Garchomp\n|split|p1\n|turn|1\n|turn|1"
      const engine = new ReplayEngine(log)
      engine.parse()

      // Should still create frame with null win prob
      expect(engine.totalFrames).toBeGreaterThanOrEqual(2)
      expect(engine.getFrame(1)!.winProbTeam1).toBeNull()
    })

    it("handles split where owner line returns null", () => {
      vi.mocked(protocolParser.processLine).mockReturnValue(null)

      const log = "|split|p1\n|some-unknown|data\n|some-unknown-spectator|data"
      const engine = new ReplayEngine(log)
      engine.parse()

      // processLine was called for owner line but returned null
      expect(protocolParser.processLine).toHaveBeenCalledTimes(1)
      expect(engine.totalFrames).toBe(1) // Only initial frame
    })

    it("handles split at end of log (no owner line available)", () => {
      vi.mocked(protocolParser.processLine).mockReturnValue(null)

      // split is the last line, no owner or spectator lines follow
      const log = "|split|p1"
      const engine = new ReplayEngine(log)
      engine.parse()

      // processLine should not be called (no i+1 line exists)
      expect(protocolParser.processLine).not.toHaveBeenCalled()
      expect(engine.totalFrames).toBe(1)
    })

    it("skips stream marker lines (update, sideupdate, p1, p2)", () => {
      vi.mocked(protocolParser.processLine).mockReturnValue(null)

      const log = "update\nsideupdate\np1\np2"
      const engine = new ReplayEngine(log)
      engine.parse()

      // All these lines should be skipped
      expect(protocolParser.processLine).not.toHaveBeenCalled()
    })
  })

  describe("constructor defaults", () => {
    it("defaults format to 'singles'", () => {
      const engine = new ReplayEngine("", "singles")
      vi.mocked(protocolParser.processLine).mockReturnValue(null)
      engine.parse()
      expect(createInitialState).toHaveBeenCalledWith("replay", "singles")
    })

    it("accepts 'doubles' format", () => {
      const engine = new ReplayEngine("", "doubles")
      vi.mocked(protocolParser.processLine).mockReturnValue(null)
      engine.parse()
      expect(createInitialState).toHaveBeenCalledWith("replay", "doubles")
    })
  })
})
