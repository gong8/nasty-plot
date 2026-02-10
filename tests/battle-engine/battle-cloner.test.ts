import { describe, it, expect, vi } from "vitest"
import {
  cloneBattle,
  getLegalChoices,
  isBattleOver,
  getBattleWinner,
} from "@nasty-plot/battle-engine"
import { applyChoices } from "#battle-engine/ai/battle-cloner"

// ---------------------------------------------------------------------------
// Mock @pkmn/sim Battle
// ---------------------------------------------------------------------------

function makeMockBattle(overrides: Record<string, unknown> = {}) {
  const battle: Record<string, unknown> = {
    ended: false,
    winner: "",
    p1: {
      name: "Player",
      pokemon: [
        { fainted: false, species: { id: "garchomp" } },
        { fainted: false, species: { id: "heatran" } },
      ],
      active: [{ fainted: false, species: { id: "garchomp" } }],
      request: null,
    },
    p2: {
      name: "Opponent",
      pokemon: [
        { fainted: false, species: { id: "ironvaliant" } },
        { fainted: true, species: { id: "greattusk" } },
      ],
      active: [{ fainted: false, species: { id: "ironvaliant" } }],
      request: null,
    },
    toJSON: vi.fn().mockReturnValue('{"mock":"json"}'),
    choose: vi.fn(),
    ...overrides,
  }
  return battle
}

// ---------------------------------------------------------------------------
// cloneBattle
// ---------------------------------------------------------------------------

describe("cloneBattle", () => {
  it("calls toJSON and Battle.fromJSON to clone", async () => {
    // We need to mock the Battle import. Since the module uses `Battle` from @pkmn/sim,
    // we test the actual behavior by verifying toJSON is called.
    // For a proper unit test, we mock at module level.
    const { Battle } = await import("@pkmn/sim")
    const fromJSONSpy = vi.spyOn(Battle, "fromJSON").mockReturnValue({} as never)

    const mockBattle = {
      toJSON: vi.fn().mockReturnValue("serialized-json"),
    }

    cloneBattle(mockBattle as never)

    expect(mockBattle.toJSON).toHaveBeenCalled()
    expect(fromJSONSpy).toHaveBeenCalledWith("serialized-json")

    fromJSONSpy.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// applyChoices
// ---------------------------------------------------------------------------

describe("applyChoices", () => {
  it("calls battle.choose for both players", () => {
    const mockBattle = makeMockBattle()
    const result = applyChoices(mockBattle as never, "move 1", "switch 2")

    expect(mockBattle.choose).toHaveBeenCalledTimes(2)
    expect(mockBattle.choose).toHaveBeenCalledWith("p1", "move 1")
    expect(mockBattle.choose).toHaveBeenCalledWith("p2", "switch 2")
    expect(result).toBe(mockBattle)
  })

  it("returns the same battle instance (mutated)", () => {
    const mockBattle = makeMockBattle()
    const result = applyChoices(mockBattle as never, "move 2", "move 3")
    expect(result).toBe(mockBattle)
  })
})

// ---------------------------------------------------------------------------
// getLegalChoices
// ---------------------------------------------------------------------------

describe("getLegalChoices", () => {
  it("returns empty when request is null", () => {
    const mockBattle = makeMockBattle()
    ;(mockBattle.p1 as Record<string, unknown>).request = null
    const choices = getLegalChoices(mockBattle as never, "p1")
    expect(choices).toEqual([])
  })

  it("returns empty when request.wait is true", () => {
    const mockBattle = makeMockBattle()
    ;(mockBattle.p1 as Record<string, unknown>).request = { wait: true }
    const choices = getLegalChoices(mockBattle as never, "p1")
    expect(choices).toEqual([])
  })

  it("returns switch choices on forceSwitch with non-fainted bench", () => {
    const activePokemon = { fainted: false, species: { id: "garchomp" } }
    const mockBattle = makeMockBattle()
    ;(mockBattle.p1 as Record<string, unknown>).request = {
      forceSwitch: [true],
    }
    ;(mockBattle.p1 as Record<string, unknown>).pokemon = [
      activePokemon,
      { fainted: false, species: { id: "heatran" } },
      { fainted: true, species: { id: "clefable" } },
    ]
    ;(mockBattle.p1 as Record<string, unknown>).active = [activePokemon]

    const choices = getLegalChoices(mockBattle as never, "p1")
    expect(choices).toContain("switch 2")
    expect(choices).not.toContain("switch 1") // active pokemon
    expect(choices).not.toContain("switch 3") // fainted
  })

  it("returns 'default' when forceSwitch but all bench fainted", () => {
    const activePokemon = { fainted: false, species: { id: "garchomp" } }
    const mockBattle = makeMockBattle()
    ;(mockBattle.p1 as Record<string, unknown>).request = {
      forceSwitch: [true],
    }
    ;(mockBattle.p1 as Record<string, unknown>).pokemon = [
      activePokemon,
      { fainted: true, species: { id: "heatran" } },
    ]
    ;(mockBattle.p1 as Record<string, unknown>).active = [activePokemon]

    const choices = getLegalChoices(mockBattle as never, "p1")
    expect(choices).toEqual(["default"])
  })

  it("returns move choices based on active moves (normal turn)", () => {
    const activePokemon = { fainted: false, species: { id: "garchomp" } }
    const mockBattle = makeMockBattle()
    ;(mockBattle.p1 as Record<string, unknown>).request = {
      active: [
        {
          moves: [
            { disabled: false },
            { disabled: true },
            { disabled: false },
            { disabled: false },
          ],
        },
      ],
    }
    ;(mockBattle.p1 as Record<string, unknown>).pokemon = [
      activePokemon,
      { fainted: false, species: { id: "heatran" } },
    ]
    ;(mockBattle.p1 as Record<string, unknown>).active = [activePokemon]

    const choices = getLegalChoices(mockBattle as never, "p1")
    expect(choices).toContain("move 1")
    expect(choices).not.toContain("move 2") // disabled
    expect(choices).toContain("move 3")
    expect(choices).toContain("move 4")
    expect(choices).toContain("switch 2")
  })

  it("returns 'default' when no moves or switches available", () => {
    const activePokemon = { fainted: false, species: { id: "garchomp" } }
    const mockBattle = makeMockBattle()
    ;(mockBattle.p1 as Record<string, unknown>).request = {
      active: [{ moves: [] }],
    }
    ;(mockBattle.p1 as Record<string, unknown>).pokemon = [activePokemon]
    ;(mockBattle.p1 as Record<string, unknown>).active = [activePokemon]

    const choices = getLegalChoices(mockBattle as never, "p1")
    expect(choices).toEqual(["default"])
  })

  it("works for p2 side", () => {
    const activePokemon = { fainted: false, species: { id: "ironvaliant" } }
    const mockBattle = makeMockBattle()
    ;(mockBattle.p2 as Record<string, unknown>).request = {
      active: [
        {
          moves: [{ disabled: false }, { disabled: false }],
        },
      ],
    }
    ;(mockBattle.p2 as Record<string, unknown>).pokemon = [
      activePokemon,
      { fainted: false, species: { id: "greattusk" } },
    ]
    ;(mockBattle.p2 as Record<string, unknown>).active = [activePokemon]

    const choices = getLegalChoices(mockBattle as never, "p2")
    expect(choices).toContain("move 1")
    expect(choices).toContain("move 2")
    expect(choices).toContain("switch 2")
  })

  it("returns combined choice strings for doubles battles", () => {
    const active1 = { fainted: false, species: { id: "garchomp" } }
    const active2 = { fainted: false, species: { id: "heatran" } }
    const mockBattle = makeMockBattle()
    ;(mockBattle.p1 as Record<string, unknown>).request = {
      active: [
        {
          moves: [
            { disabled: false, target: "normal" },
            { disabled: false, target: "allAdjacent" },
          ],
        },
        {
          moves: [{ disabled: false, target: "normal" }],
        },
      ],
    }
    ;(mockBattle.p1 as Record<string, unknown>).pokemon = [
      active1,
      active2,
      { fainted: false, species: { id: "clefable" } },
    ]
    ;(mockBattle.p1 as Record<string, unknown>).active = [active1, active2]

    const choices = getLegalChoices(mockBattle as never, "p1")

    // Should return combined "slot1, slot2" format
    expect(choices.length).toBeGreaterThan(0)
    // Each choice should be a comma-separated pair
    for (const choice of choices) {
      expect(choice).toMatch(/^.+, .+$/)
    }
    // Verify some expected combinations exist
    expect(choices.some((c) => c.includes("move 1 -1"))).toBe(true)
    expect(choices.some((c) => c.includes("move 2"))).toBe(true)
    expect(choices.some((c) => c.includes("switch 3"))).toBe(true)
  })

  it("returns move choices when active has no disabled moves", () => {
    const activePokemon = { fainted: false, species: { id: "garchomp" } }
    const mockBattle = makeMockBattle()
    ;(mockBattle.p1 as Record<string, unknown>).request = {
      active: [
        {
          moves: [{ disabled: false }, { disabled: false }],
        },
      ],
    }
    ;(mockBattle.p1 as Record<string, unknown>).pokemon = [activePokemon]
    ;(mockBattle.p1 as Record<string, unknown>).active = [activePokemon]

    const choices = getLegalChoices(mockBattle as never, "p1")
    expect(choices).toContain("move 1")
    expect(choices).toContain("move 2")
  })

  // --- Doubles forceSwitch coverage ---

  it("doubles forceSwitch: both slots must switch with available bench", () => {
    const active1 = { fainted: false, species: { id: "garchomp" } }
    const active2 = { fainted: false, species: { id: "heatran" } }
    const mockBattle = makeMockBattle()
    ;(mockBattle.p1 as Record<string, unknown>).request = {
      forceSwitch: [true, true],
    }
    ;(mockBattle.p1 as Record<string, unknown>).pokemon = [
      active1,
      active2,
      { fainted: false, species: { id: "clefable" } },
      { fainted: false, species: { id: "slowbro" } },
    ]
    ;(mockBattle.p1 as Record<string, unknown>).active = [active1, active2]

    const choices = getLegalChoices(mockBattle as never, "p1")
    // Should return combined "slot1, slot2" format
    expect(choices.length).toBeGreaterThan(0)
    for (const choice of choices) {
      expect(choice).toMatch(/^.+, .+$/)
    }
    // Each slot should contain switches to bench Pokemon (indices 3 and 4)
    expect(choices.some((c) => c.includes("switch 3"))).toBe(true)
    expect(choices.some((c) => c.includes("switch 4"))).toBe(true)
    // Both slots switching to the same Pokemon should be filtered out
    for (const choice of choices) {
      const parts = choice.split(", ")
      if (parts[0].startsWith("switch ") && parts[1].startsWith("switch ")) {
        expect(parts[0]).not.toBe(parts[1])
      }
    }
  })

  it("doubles forceSwitch: slot 1 must switch but slot 2 does not", () => {
    const active1 = { fainted: false, species: { id: "garchomp" } }
    const active2 = { fainted: false, species: { id: "heatran" } }
    const mockBattle = makeMockBattle()
    ;(mockBattle.p1 as Record<string, unknown>).request = {
      forceSwitch: [true, false],
    }
    ;(mockBattle.p1 as Record<string, unknown>).pokemon = [
      active1,
      active2,
      { fainted: false, species: { id: "clefable" } },
    ]
    ;(mockBattle.p1 as Record<string, unknown>).active = [active1, active2]

    const choices = getLegalChoices(mockBattle as never, "p1")
    expect(choices.length).toBeGreaterThan(0)
    // Slot 2 should pass
    for (const choice of choices) {
      const parts = choice.split(", ")
      expect(parts[1]).toBe("pass")
    }
  })

  it("doubles forceSwitch: no bench available, slots get 'pass'", () => {
    const active1 = { fainted: false, species: { id: "garchomp" } }
    const active2 = { fainted: false, species: { id: "heatran" } }
    const mockBattle = makeMockBattle()
    ;(mockBattle.p1 as Record<string, unknown>).request = {
      forceSwitch: [true, true],
    }
    // Only active Pokemon, no bench
    ;(mockBattle.p1 as Record<string, unknown>).pokemon = [active1, active2]
    ;(mockBattle.p1 as Record<string, unknown>).active = [active1, active2]

    const choices = getLegalChoices(mockBattle as never, "p1")
    expect(choices.length).toBeGreaterThan(0)
    // With no bench, both slots should pass
    expect(choices).toContain("pass, pass")
  })

  it("doubles normal turn: slot without active gets 'pass'", () => {
    const active1 = { fainted: false, species: { id: "garchomp" } }
    const mockBattle = makeMockBattle()
    ;(mockBattle.p1 as Record<string, unknown>).request = {
      active: [
        {
          moves: [{ disabled: false, target: "normal" }],
        },
        // Second slot has no active (fainted, null)
        undefined,
      ],
    }
    ;(mockBattle.p1 as Record<string, unknown>).pokemon = [
      active1,
      { fainted: true, species: { id: "heatran" } },
    ]
    ;(mockBattle.p1 as Record<string, unknown>).active = [active1, null]

    const choices = getLegalChoices(mockBattle as never, "p1")
    expect(choices.length).toBeGreaterThan(0)
    // Second slot should pass since it has no active
    for (const choice of choices) {
      const parts = choice.split(", ")
      expect(parts[1]).toBe("pass")
    }
  })

  it("doubles normal turn: move with 'any' target generates target variants", () => {
    const active1 = { fainted: false, species: { id: "garchomp" } }
    const active2 = { fainted: false, species: { id: "heatran" } }
    const mockBattle = makeMockBattle()
    ;(mockBattle.p1 as Record<string, unknown>).request = {
      active: [
        {
          moves: [{ disabled: false, target: "any" }],
        },
        {
          moves: [{ disabled: false, target: "allAdjacent" }],
        },
      ],
    }
    ;(mockBattle.p1 as Record<string, unknown>).pokemon = [active1, active2]
    ;(mockBattle.p1 as Record<string, unknown>).active = [active1, active2]

    const choices = getLegalChoices(mockBattle as never, "p1")
    expect(choices.length).toBeGreaterThan(0)
    // "any" target should generate -1 and -2 variants
    expect(choices.some((c) => c.includes("move 1 -1"))).toBe(true)
    expect(choices.some((c) => c.includes("move 1 -2"))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// isBattleOver
// ---------------------------------------------------------------------------

describe("isBattleOver", () => {
  it("returns false when battle.ended is false", () => {
    const mockBattle = makeMockBattle({ ended: false })
    expect(isBattleOver(mockBattle as never)).toBe(false)
  })

  it("returns true when battle.ended is true", () => {
    const mockBattle = makeMockBattle({ ended: true })
    expect(isBattleOver(mockBattle as never)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// getBattleWinner
// ---------------------------------------------------------------------------

describe("getBattleWinner", () => {
  it("returns null when battle has not ended", () => {
    const mockBattle = makeMockBattle({ ended: false })
    expect(getBattleWinner(mockBattle as never)).toBeNull()
  })

  it("returns 'p1' when p1 wins", () => {
    const mockBattle = makeMockBattle({ ended: true, winner: "Player" })
    expect(getBattleWinner(mockBattle as never)).toBe("p1")
  })

  it("returns 'p2' when p2 wins", () => {
    const mockBattle = makeMockBattle({ ended: true, winner: "Opponent" })
    expect(getBattleWinner(mockBattle as never)).toBe("p2")
  })

  it("returns null for a draw (ended but no winner matches)", () => {
    const mockBattle = makeMockBattle({ ended: true, winner: "" })
    expect(getBattleWinner(mockBattle as never)).toBeNull()
  })

  it("returns null when winner is an unexpected name", () => {
    const mockBattle = makeMockBattle({ ended: true, winner: "SomeOtherName" })
    expect(getBattleWinner(mockBattle as never)).toBeNull()
  })
})
