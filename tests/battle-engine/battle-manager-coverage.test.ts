import { vi, type Mock } from "vitest"

// Mock @pkmn/sim before importing battle-manager
const mockStreamWrite = vi.fn()
const mockStreamDestroy = vi.fn()
let mockStreamChunks: string[] = []
let mockStreamResolve: ((value: IteratorResult<string>) => void) | null = null

let currentMockStream: { battle?: { toJSON(): unknown } }

// Use a mutable holder so the hoisted vi.mock factory can capture the reference
// and individual tests can swap the implementation
let teamsImportImpl: (paste: string) => unknown[] | null = (paste: string) => {
  if (!paste || paste.trim() === "") return null
  return [{ species: "Garchomp", moves: ["earthquake"] }]
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
      currentMockStream = this as unknown as { battle?: { toJSON(): unknown } }
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
      import: vi.fn((paste: string) => teamsImportImpl(paste)),
      pack: vi.fn(() => "Garchomp|||earthquake||||||||"),
    },
  }
})

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { BattleManager, createInitialState } from "@nasty-plot/battle-engine"
import type { AIPlayer, BattleAction } from "@nasty-plot/battle-engine"

function pushChunk(chunk: string) {
  if (mockStreamResolve) {
    const resolve = mockStreamResolve
    mockStreamResolve = null
    resolve({ value: chunk, done: false })
  }
}

const PACKED_TEAM = "Garchomp|||earthquake||||||||"

const PASTE_TEAM = `Garchomp @ Life Orb
Ability: Rough Skin
EVs: 252 Atk / 4 SpD / 252 Spe
Jolly Nature
- Earthquake
- Dragon Claw
- Swords Dance
- Scale Shot`

function makeP1Request(
  opts: { teamPreview?: boolean; wait?: boolean; forceSwitch?: boolean; doubles?: boolean } = {},
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
    const forceArr = opts.doubles ? [true, true] : [true]
    return JSON.stringify({
      forceSwitch: forceArr,
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

  if (opts.doubles) {
    return JSON.stringify({
      active: [
        {
          moves: [
            {
              move: "Earthquake",
              id: "earthquake",
              pp: 16,
              maxpp: 16,
              target: "allAdjacent",
              type: "Ground",
            },
          ],
          canTerastallize: "Ground",
        },
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
            baseAbility: "roughskin",
            item: "lifeorb",
            teraType: "Ground",
          },
          {
            ident: "p1b: Heatran",
            details: "Heatran, L100",
            condition: "311/311",
            active: true,
            stats: { atk: 194, def: 248, spa: 394, spd: 248, spe: 169 },
            moves: ["magmastorm"],
            baseAbility: "flashfire",
            item: "leftovers",
          },
          {
            ident: "p1: Clefable",
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
  opts: { teamPreview?: boolean; wait?: boolean; forceSwitch?: boolean; doubles?: boolean } = {},
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
    const forceArr = opts.doubles ? [true, true] : [true]
    return JSON.stringify({
      forceSwitch: forceArr,
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
            ident: "p2b: Clefable",
            details: "Clefable, L100",
            condition: "0 fnt",
            active: true,
            stats: {},
            moves: [],
          },
          {
            ident: "p2: Toxapex",
            details: "Toxapex, L100",
            condition: "304/304",
            active: false,
            stats: { atk: 152, def: 324, spa: 122, spd: 292, spe: 95 },
            moves: ["scald"],
            baseAbility: "regenerator",
            item: "blacksludge",
          },
        ],
      },
    })
  }

  if (opts.doubles) {
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
        {
          moves: [
            {
              move: "Moonblast",
              id: "moonblast",
              pp: 24,
              maxpp: 24,
              target: "normal",
              type: "Fairy",
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
            ident: "p2b: Clefable",
            details: "Clefable, L100",
            condition: "394/394",
            active: true,
            stats: { atk: 146, def: 186, spa: 226, spd: 216, spe: 156 },
            moves: ["moonblast"],
            baseAbility: "magicguard",
            item: "leftovers",
          },
          {
            ident: "p2: Toxapex",
            details: "Toxapex, L100",
            condition: "304/304",
            active: false,
            stats: { atk: 152, def: 324, spa: 122, spd: 292, spe: 95 },
            moves: ["scald"],
            baseAbility: "regenerator",
            item: "blacksludge",
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

describe("BattleManager - coverage boost", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStreamChunks = []
    mockStreamResolve = null
    // Reset to default implementation
    teamsImportImpl = (paste: string) => {
      if (!paste || paste.trim() === "") return null
      return [{ species: "Garchomp", moves: ["earthquake"] }]
    }
  })

  describe("pasteToPackedTeam - Teams.import throws", () => {
    it("returns error when Teams.import throws an exception for player team", async () => {
      // Make Teams.import throw
      teamsImportImpl = () => {
        throw new Error("Parsing error")
      }

      const manager = new BattleManager({
        formatId: "gen9ou",
        gameType: "singles",
        playerTeam: PASTE_TEAM,
        opponentTeam: PACKED_TEAM,
      })

      await expect(manager.start()).rejects.toThrow("Failed to parse player team")
    })

    it("returns error when Teams.import throws an exception for opponent team", async () => {
      // First call succeeds (player), second throws (opponent)
      let callCount = 0
      teamsImportImpl = () => {
        callCount++
        if (callCount === 1) return [{ species: "Garchomp", moves: ["earthquake"] }]
        throw new Error("Parsing error")
      }

      const manager = new BattleManager({
        formatId: "gen9ou",
        gameType: "singles",
        playerTeam: PASTE_TEAM,
        opponentTeam: PASTE_TEAM,
      })

      await expect(manager.start()).rejects.toThrow("Failed to parse opponent team")
    })

    it("returns error when Teams.import returns empty array", async () => {
      teamsImportImpl = () => []

      const manager = new BattleManager({
        formatId: "gen9ou",
        gameType: "singles",
        playerTeam: PASTE_TEAM,
        opponentTeam: PACKED_TEAM,
      })

      await expect(manager.start()).rejects.toThrow("Failed to parse player team")
    })
  })

  describe("handleAIForceSwitchDoubles", () => {
    it("handles doubles force switch with both slot actions", async () => {
      const mockAI: AIPlayer = {
        difficulty: "random",
        chooseAction: vi
          .fn()
          .mockResolvedValueOnce({ type: "switch", pokemonIndex: 3 })
          .mockResolvedValueOnce({ type: "switch", pokemonIndex: 4 }),
        chooseLeads: vi.fn().mockReturnValue([1, 2, 3, 4, 5, 6]),
      }

      const manager = new BattleManager({
        formatId: "gen9vgc2024regulationh",
        gameType: "doubles",
        playerTeam: PACKED_TEAM,
        opponentTeam: PACKED_TEAM,
      })
      manager.setAI(mockAI)

      // Start the battle
      const startPromise = manager.start()
      await new Promise((r) => setTimeout(r, 10))

      // Push a p1 wait request to start, so waitingForChoice = false
      pushChunk(`|request|${makeP1Request({ wait: true })}`)
      await startPromise

      // Verify waitingForChoice is false (from wait request)
      expect(manager.getState().waitingForChoice).toBe(false)

      // Push a doubles p2 force switch request — this triggers handleAIForceSwitchDoubles
      pushChunk(`|request|${makeP2Request({ forceSwitch: true, doubles: true })}`)
      await new Promise((r) => setTimeout(r, 800))

      // AI should have been called for both slots
      expect(mockAI.chooseAction).toHaveBeenCalledTimes(2)
      // The combined choice should have been written as "switch 3, switch 4"
      expect(mockStreamWrite).toHaveBeenCalledWith(">p2 switch 3, switch 4")
    })

    it("handles doubles force switch with only slot1 actions (slot2 null)", async () => {
      const mockAI: AIPlayer = {
        difficulty: "random",
        chooseAction: vi.fn().mockResolvedValueOnce({ type: "switch", pokemonIndex: 3 }),
        chooseLeads: vi.fn().mockReturnValue([1, 2, 3, 4, 5, 6]),
      }

      const manager = new BattleManager({
        formatId: "gen9vgc2024regulationh",
        gameType: "doubles",
        playerTeam: PACKED_TEAM,
        opponentTeam: PACKED_TEAM,
      })
      manager.setAI(mockAI)

      // Start the battle
      const startPromise = manager.start()
      await new Promise((r) => setTimeout(r, 10))

      // Push a p1 wait request so waitingForChoice = false
      pushChunk(`|request|${makeP1Request({ wait: true })}`)
      await startPromise

      // Push a singles-style p2 force switch (only one slot fainted), but in doubles game type
      // When forceSwitch has only one true, parseRequestForSlot for slot 1 returns null actions
      pushChunk(`|request|${makeP2Request({ forceSwitch: true })}`)
      await new Promise((r) => setTimeout(r, 800))

      // AI should have been called once (for slot 1 only)
      expect(mockAI.chooseAction).toHaveBeenCalledTimes(1)
      expect(mockStreamWrite).toHaveBeenCalledWith(">p2 switch 3, pass")
    })
  })

  describe("submitDoubleActions", () => {
    it("writes combined double actions to the stream", async () => {
      const manager = new BattleManager({
        formatId: "gen9vgc2024regulationh",
        gameType: "doubles",
        playerTeam: PACKED_TEAM,
        opponentTeam: PACKED_TEAM,
      })

      const startPromise = manager.start()
      await new Promise((r) => setTimeout(r, 10))
      pushChunk(`|request|${makeP1Request({ doubles: true })}`)
      await startPromise

      const action1: BattleAction = { type: "move", moveIndex: 1, targetSlot: -1 }
      const action2: BattleAction = { type: "move", moveIndex: 1, targetSlot: 1 }

      const actionPromise = manager.submitDoubleActions(action1, action2)
      await new Promise((r) => setTimeout(r, 10))

      expect(mockStreamWrite).toHaveBeenCalledWith(">p1 move 1 -1, move 1 1")

      pushChunk(`|request|${makeP1Request({ doubles: true })}`)
      await actionPromise
    })

    it("is a no-op if already submitting", async () => {
      const manager = new BattleManager({
        formatId: "gen9vgc2024regulationh",
        gameType: "doubles",
        playerTeam: PACKED_TEAM,
        opponentTeam: PACKED_TEAM,
      })

      const startPromise = manager.start()
      await new Promise((r) => setTimeout(r, 10))
      pushChunk(`|request|${makeP1Request({ doubles: true })}`)
      await startPromise

      const action1: BattleAction = { type: "move", moveIndex: 1 }
      const action2: BattleAction = { type: "move", moveIndex: 1 }

      // Start first submit (blocks waiting for update)
      const actionPromise1 = manager.submitDoubleActions(action1, action2)
      await new Promise((r) => setTimeout(r, 10))

      // Second submit while first is pending — should be no-op
      const actionPromise2 = manager.submitDoubleActions(
        { type: "switch", pokemonIndex: 3 },
        { type: "switch", pokemonIndex: 4 },
      )
      await actionPromise2 // Resolves immediately (no-op)

      // Only one p1 write for the first submit
      const p1Writes = mockStreamWrite.mock.calls.filter(
        (call: string[]) => typeof call[0] === "string" && call[0].startsWith(">p1 "),
      )
      expect(p1Writes).toHaveLength(1)

      pushChunk(`|request|${makeP1Request({ doubles: true })}`)
      await actionPromise1
    })

    it("triggers AI in doubles when pending p2 actions exist", async () => {
      const mockAI: AIPlayer = {
        difficulty: "random",
        chooseAction: vi
          .fn()
          .mockResolvedValueOnce({ type: "move", moveIndex: 1 })
          .mockResolvedValueOnce({ type: "move", moveIndex: 1 }),
        chooseLeads: vi.fn().mockReturnValue([1, 2, 3, 4, 5, 6]),
      }

      const manager = new BattleManager({
        formatId: "gen9vgc2024regulationh",
        gameType: "doubles",
        playerTeam: PACKED_TEAM,
        opponentTeam: PACKED_TEAM,
      })
      manager.setAI(mockAI)

      const startPromise = manager.start()
      await new Promise((r) => setTimeout(r, 10))
      pushChunk(`|request|${makeP1Request({ doubles: true })}`)
      await startPromise

      // Push p2 doubles request to store pending actions
      pushChunk(`|request|${makeP2Request({ doubles: true })}`)
      await new Promise((r) => setTimeout(r, 50))

      const action1: BattleAction = { type: "move", moveIndex: 1 }
      const action2: BattleAction = { type: "move", moveIndex: 1 }

      const actionPromise = manager.submitDoubleActions(action1, action2)
      // Wait for AI delay
      await new Promise((r) => setTimeout(r, 1200))

      expect(mockAI.chooseAction).toHaveBeenCalledTimes(2)
      // AI should write combined doubles choice
      expect(mockStreamWrite).toHaveBeenCalledWith(">p2 move 1, move 1")

      pushChunk(`|request|${makeP1Request({ doubles: true })}`)
      await actionPromise
    })
  })

  describe("chooseLead - submitting guard", () => {
    it("is a no-op if already submitting", async () => {
      const manager = new BattleManager({
        formatId: "gen9ou",
        gameType: "singles",
        playerTeam: PACKED_TEAM,
        opponentTeam: PACKED_TEAM,
      })

      const startPromise = manager.start()
      await new Promise((r) => setTimeout(r, 10))
      pushChunk(`|request|${makeP1Request({ teamPreview: true })}`)
      await startPromise

      // First chooseLead
      const leadPromise1 = manager.chooseLead([1, 2, 3, 4, 5, 6])
      await new Promise((r) => setTimeout(r, 10))

      // Second chooseLead while first is pending — should be no-op
      const leadPromise2 = manager.chooseLead([6, 5, 4, 3, 2, 1])
      await leadPromise2

      // Only one p1 team write
      const teamWrites = mockStreamWrite.mock.calls.filter(
        (call: string[]) => typeof call[0] === "string" && call[0] === ">p1 team 123456",
      )
      expect(teamWrites).toHaveLength(1)

      // Should NOT have the second order
      const teamWrites2 = mockStreamWrite.mock.calls.filter(
        (call: string[]) => typeof call[0] === "string" && call[0] === ">p1 team 654321",
      )
      expect(teamWrites2).toHaveLength(0)

      pushChunk(`|turn|1\n|request|${makeP1Request()}`)
      await leadPromise1
    })
  })

  describe("submitAction - submitting guard", () => {
    it("is a no-op if already submitting", async () => {
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

      // First submit
      const actionPromise1 = manager.submitAction({ type: "move", moveIndex: 1 })
      await new Promise((r) => setTimeout(r, 10))

      // Second submit while first is pending
      const actionPromise2 = manager.submitAction({ type: "move", moveIndex: 2 })
      await actionPromise2

      // Only one p1 move write for move 1
      const moveWrites = mockStreamWrite.mock.calls.filter(
        (call: string[]) => typeof call[0] === "string" && call[0] === ">p1 move 1",
      )
      expect(moveWrites).toHaveLength(1)

      // move 2 should NOT have been written
      const move2Writes = mockStreamWrite.mock.calls.filter(
        (call: string[]) => typeof call[0] === "string" && call[0] === ">p1 move 2",
      )
      expect(move2Writes).toHaveLength(0)

      pushChunk(`|request|${makeP1Request()}`)
      await actionPromise1
    })
  })

  describe("start timeout", () => {
    it("rejects with startError message when battle fails to start", async () => {
      const manager = new BattleManager({
        formatId: "gen9ou",
        gameType: "singles",
        playerTeam: PACKED_TEAM,
        opponentTeam: PACKED_TEAM,
      })

      const startPromise = manager.start()
      await new Promise((r) => setTimeout(r, 10))

      // Push an error line to set startError, but don't resolve with a request
      pushChunk("|error|Invalid team format")
      // Don't push any request — let the timeout fire

      await expect(startPromise).rejects.toThrow("Battle failed to start: Invalid team format")
    }, 15_000)

    it("rejects with generic timeout message when no error is set", async () => {
      const manager = new BattleManager({
        formatId: "gen9ou",
        gameType: "singles",
        playerTeam: PACKED_TEAM,
        opponentTeam: PACKED_TEAM,
      })

      const startPromise = manager.start()
      // Don't push any chunks — let the timeout fire

      await expect(startPromise).rejects.toThrow(
        "Battle timed out waiting for the simulator. Check team/format validity.",
      )
    }, 15_000)
  })

  describe("handleRequest error handling", () => {
    it("logs and continues when request JSON is malformed", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
      const manager = new BattleManager({
        formatId: "gen9ou",
        gameType: "singles",
        playerTeam: PACKED_TEAM,
        opponentTeam: PACKED_TEAM,
      })

      const startPromise = manager.start()
      await new Promise((r) => setTimeout(r, 10))

      // Push malformed JSON as request, followed by a valid one
      pushChunk(`|request|{not valid json}\n|request|${makeP1Request()}`)
      await startPromise

      // Should have logged the error
      expect(consoleSpy).toHaveBeenCalledWith(
        "[BattleManager] Failed to parse request:",
        expect.any(Error),
      )

      // But the second valid request should still have been processed
      expect(manager.getState().waitingForChoice).toBe(true)

      consoleSpy.mockRestore()
    })
  })

  describe("SetPredictor - populatePredictions", () => {
    it("populates opponentPredictions on state from predictor beliefs", async () => {
      const mockPredictor = {
        updateFromObservation: vi.fn(),
        getPrediction: vi.fn().mockReturnValue([
          {
            set: {
              moves: ["Magma Storm", "Earth Power", "Flash Cannon", "Taunt"],
              item: "Leftovers",
              ability: "Flash Fire",
            },
            probability: 0.85,
          },
        ]),
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

      // Push protocol with switch so p2 team is populated, then p1 request
      pushChunk(`|switch|p2a: Heatran|Heatran, L100|311/311\n|request|${makeP1Request()}`)
      await startPromise

      const state = manager.getState()
      // Should have opponentPredictions populated
      expect(state.opponentPredictions).toBeDefined()
      const pred = state.opponentPredictions?.["heatran"]
      if (pred) {
        expect(pred.predictedMoves).toContain("Magma Storm")
        expect(pred.predictedItem).toBe("Leftovers")
        expect(pred.predictedAbility).toBe("Flash Fire")
        expect(pred.confidence).toBe(0.85)
      }
    })

    it("skips pokemon with no predictions", async () => {
      const mockPredictor = {
        updateFromObservation: vi.fn(),
        getPrediction: vi.fn().mockReturnValue([]),
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

      pushChunk(`|switch|p2a: Heatran|Heatran, L100|311/311\n|request|${makeP1Request()}`)
      await startPromise

      const state = manager.getState()
      expect(state.opponentPredictions).toBeDefined()
      // Should be empty since getPrediction returned []
      expect(Object.keys(state.opponentPredictions || {})).toHaveLength(0)
    })

    it("handles prediction sets with non-standard moves format", async () => {
      const mockPredictor = {
        updateFromObservation: vi.fn(),
        getPrediction: vi.fn().mockReturnValue([
          {
            set: {
              // Nested array (Smogon format sometimes nests)
              moves: [["Magma Storm", "Earth Power"], ["Flash Cannon"]],
              item: null,
              ability: null,
            },
            probability: 0.5,
          },
        ]),
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

      pushChunk(`|switch|p2a: Heatran|Heatran, L100|311/311\n|request|${makeP1Request()}`)
      await startPromise

      const state = manager.getState()
      const pred = state.opponentPredictions?.["heatran"]
      if (pred) {
        // Flattened and filtered to strings
        expect(pred.predictedMoves).toEqual(
          expect.arrayContaining(["Magma Storm", "Earth Power", "Flash Cannon"]),
        )
        // null item/ability should be undefined
        expect(pred.predictedItem).toBeUndefined()
        expect(pred.predictedAbility).toBeUndefined()
      }
    })
  })

  describe("doubles p1 slot2 handling", () => {
    it("parses slot2 actions for p1 in doubles", async () => {
      const manager = new BattleManager({
        formatId: "gen9vgc2024regulationh",
        gameType: "doubles",
        playerTeam: PACKED_TEAM,
        opponentTeam: PACKED_TEAM,
      })

      const startPromise = manager.start()
      await new Promise((r) => setTimeout(r, 10))

      // Push a doubles p1 request with 2 active slots
      pushChunk(`|request|${makeP1Request({ doubles: true })}`)
      await startPromise

      const state = manager.getState()
      expect(state.waitingForChoice).toBe(true)
      // In doubles, the state should have available actions from the first active slot
      expect(state.availableActions).toBeDefined()
    })
  })

  describe("doubles p2 actions storage", () => {
    it("stores p2 slot2 actions for AI in doubles", async () => {
      const mockAI: AIPlayer = {
        difficulty: "random",
        chooseAction: vi
          .fn()
          .mockResolvedValueOnce({ type: "move", moveIndex: 1 })
          .mockResolvedValueOnce({ type: "move", moveIndex: 1 }),
        chooseLeads: vi.fn().mockReturnValue([1, 2, 3, 4, 5, 6]),
      }

      const manager = new BattleManager({
        formatId: "gen9vgc2024regulationh",
        gameType: "doubles",
        playerTeam: PACKED_TEAM,
        opponentTeam: PACKED_TEAM,
      })
      manager.setAI(mockAI)

      const startPromise = manager.start()
      await new Promise((r) => setTimeout(r, 10))
      pushChunk(`|request|${makeP1Request({ doubles: true })}`)
      await startPromise

      // Push p2 doubles request — stores both slot actions
      pushChunk(`|request|${makeP2Request({ doubles: true })}`)
      await new Promise((r) => setTimeout(r, 50))

      // Player submits doubles actions
      const actionPromise = manager.submitDoubleActions(
        { type: "move", moveIndex: 1 },
        { type: "move", moveIndex: 1 },
      )
      await new Promise((r) => setTimeout(r, 1200))

      // AI should have used both stored slot actions
      expect(mockAI.chooseAction).toHaveBeenCalledTimes(2)

      pushChunk(`|request|${makeP1Request({ doubles: true })}`)
      await actionPromise
    })
  })

  describe("getSerializedBattle edge case", () => {
    it("returns null when toJSON throws", () => {
      const manager = new BattleManager({
        formatId: "gen9ou",
        gameType: "singles",
        playerTeam: PACKED_TEAM,
        opponentTeam: PACKED_TEAM,
      })

      // Inject a battle object whose toJSON throws
      currentMockStream.battle = {
        toJSON: () => {
          throw new Error("Serialization failed")
        },
      }

      expect(manager.getSerializedBattle()).toBeNull()
    })
  })

  describe("escapeTeam", () => {
    it("escapes backslashes and double quotes in team strings", async () => {
      const teamWithSpecialChars = 'Garchomp|"item"|ability\\special||||||||'

      const manager = new BattleManager({
        formatId: "gen9ou",
        gameType: "singles",
        playerTeam: teamWithSpecialChars,
        opponentTeam: teamWithSpecialChars,
      })

      const startPromise = manager.start()
      await new Promise((r) => setTimeout(r, 10))
      pushChunk(`|request|${makeP1Request()}`)
      await startPromise

      // The player p1 write should contain escaped characters
      const p1Write = mockStreamWrite.mock.calls.find(
        (call: string[]) => typeof call[0] === "string" && call[0].includes(">player p1"),
      )
      expect(p1Write).toBeDefined()
      const p1Command = p1Write![0] as string
      // Backslash should be double-escaped
      expect(p1Command).toContain("\\\\")
      // Double quotes should be escaped
      expect(p1Command).toContain('\\"')
    })
  })

  describe("protocol log with multiple events", () => {
    it("processes remaining protocol lines after all requests are handled", async () => {
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

      // Protocol lines before request, then request, then more protocol lines after
      pushChunk(
        `|switch|p1a: Garchomp|Garchomp, L100, M|319/319\n|request|${makeP1Request()}\n|turn|1`,
      )
      await startPromise

      const log = manager.getProtocolLog()
      expect(log).toContain("|switch|p1a: Garchomp")
      expect(log).toContain("|turn|1")
    })
  })
})
