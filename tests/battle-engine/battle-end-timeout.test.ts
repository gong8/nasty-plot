import { vi, type Mock, describe, it, expect, beforeEach } from "vitest"
import { BattleManager } from "@nasty-plot/battle-engine"

// Mock @pkmn/sim
const mockStreamWrite = vi.fn()
const mockStreamDestroy = vi.fn()
let mockStreamChunks: string[] = []
let mockStreamResolve: ((value: IteratorResult<string>) => void) | null = null

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

vi.mock("@pkmn/sim", () => {
  class MockBattleStream {
    write: Mock
    destroy: Mock
    battle: { toJSON(): unknown } | undefined
    constructor() {
      this.write = mockStreamWrite
      this.destroy = mockStreamDestroy
      this.battle = undefined
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

function pushChunk(chunk: string) {
  if (mockStreamResolve) {
    const resolve = mockStreamResolve
    mockStreamResolve = null
    resolve({ value: chunk, done: false })
  }
}

function makeP1Request(): string {
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
          moves: ["earthquake"],
        },
      ],
    },
  })
}

const PACKED_TEAM = "Garchomp|||earthquake||||||||"

describe("BattleManager End Game Timeout", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStreamChunks = []
    mockStreamResolve = null
  })

  it("should resolve submitAction when battle ends without a final request", async () => {
    const manager = new BattleManager({
      formatId: "gen9ou",
      gameType: "singles",
      playerTeam: PACKED_TEAM,
      opponentTeam: PACKED_TEAM,
    })

    // Start
    const startPromise = manager.start()
    await new Promise((r) => setTimeout(r, 10))
    pushChunk(`|request|${makeP1Request()}`)
    await startPromise

    // Submit winning move
    const actionPromise = manager.submitAction({ type: "move", moveIndex: 0 })
    await new Promise((r) => setTimeout(r, 10))

    // Push "win" message WITHOUT a subsequent request
    // This simulates the scenario where the battle ends and no further input is required
    pushChunk(`|win|Player`)

    // We expect actionPromise to resolve.
    // If the bug exists, this will hang (until timeout).
    // To verify the fix, we use a shorter timeout in the test environment or check resolution status.

    // Using a promise race to detect hang
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timed out")), 1000),
    )

    await expect(Promise.race([actionPromise, timeout])).resolves.not.toThrow()

    const state = manager.getState()
    expect(state.phase).toBe("ended")
    expect(state.winner).toBe("p1")
  })
})
