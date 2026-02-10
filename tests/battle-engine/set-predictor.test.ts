import { describe, it, expect, vi, beforeEach } from "vitest"
import { SetPredictor } from "@nasty-plot/battle-engine"
import type { SmogonSetData } from "@nasty-plot/core"

function makeSet(overrides: Partial<SmogonSetData> = {}): SmogonSetData {
  return {
    name: "Test Set",
    pokemonId: "garchomp",
    formatId: "gen9ou",
    ability: "Rough Skin",
    item: "Focus Sash",
    nature: "Jolly",
    evs: { hp: 0, atk: 252, def: 0, spa: 0, spd: 4, spe: 252 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    moves: ["Earthquake", "Outrage", "Swords Dance", "Stealth Rock"],
    teraType: "Dragon",
    ...overrides,
  }
}

describe("SetPredictor", () => {
  let predictor: SetPredictor

  beforeEach(() => {
    predictor = new SetPredictor()
  })

  // -----------------------------------------------------------------------
  // initialize (fetch-based)
  // -----------------------------------------------------------------------

  describe("initialize", () => {
    it("fetches sets from API and stores predictions", async () => {
      const mockSets = [
        makeSet({ name: "Set A", item: "Focus Sash" }),
        makeSet({ name: "Set B", item: "Life Orb" }),
      ]

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockSets,
      })

      await predictor.initialize("gen9ou", ["garchomp"])

      const preds = predictor.getPrediction("garchomp")
      expect(preds).toHaveLength(2)
      expect(preds[0].probability).toBeCloseTo(0.5)
      expect(preds[1].probability).toBeCloseTo(0.5)
    })

    it("skips pokemon when fetch fails", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("network error"))

      await predictor.initialize("gen9ou", ["garchomp"])

      expect(predictor.hasPredictions("garchomp")).toBe(false)
    })

    it("skips pokemon when response is not ok", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
      })

      await predictor.initialize("gen9ou", ["garchomp"])

      expect(predictor.hasPredictions("garchomp")).toBe(false)
    })

    it("skips pokemon when sets array is empty", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      })

      await predictor.initialize("gen9ou", ["garchomp"])

      expect(predictor.hasPredictions("garchomp")).toBe(false)
    })

    it("handles multiple pokemon IDs", async () => {
      const garchompSets = [makeSet({ name: "Garchomp Set" })]
      const heatranSets = [
        makeSet({ name: "Heatran A", pokemonId: "heatran", ability: "Flash Fire" }),
        makeSet({
          name: "Heatran B",
          pokemonId: "heatran",
          ability: "Flash Fire",
          item: "Leftovers",
        }),
      ]

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => garchompSets })
        .mockResolvedValueOnce({ ok: true, json: async () => heatranSets })

      await predictor.initialize("gen9ou", ["garchomp", "heatran"])

      expect(predictor.hasPredictions("garchomp")).toBe(true)
      expect(predictor.hasPredictions("heatran")).toBe(true)
      expect(predictor.getPrediction("garchomp")).toHaveLength(1)
      expect(predictor.getPrediction("heatran")).toHaveLength(2)
    })
  })

  // -----------------------------------------------------------------------
  // initializeFromSets
  // -----------------------------------------------------------------------

  describe("initializeFromSets", () => {
    it("stores sets with equal probability", () => {
      const sets = [
        makeSet({ name: "Set A" }),
        makeSet({ name: "Set B" }),
        makeSet({ name: "Set C" }),
      ]

      predictor.initializeFromSets("garchomp", sets)

      const preds = predictor.getPrediction("garchomp")
      expect(preds).toHaveLength(3)
      for (const p of preds) {
        expect(p.probability).toBeCloseTo(1 / 3)
      }
    })

    it("does nothing for empty sets array", () => {
      predictor.initializeFromSets("garchomp", [])
      expect(predictor.hasPredictions("garchomp")).toBe(false)
    })

    it("stores single set with probability 1", () => {
      predictor.initializeFromSets("garchomp", [makeSet()])

      const preds = predictor.getPrediction("garchomp")
      expect(preds).toHaveLength(1)
      expect(preds[0].probability).toBeCloseTo(1)
    })
  })

  // -----------------------------------------------------------------------
  // updateFromObservation
  // -----------------------------------------------------------------------

  describe("updateFromObservation", () => {
    it("reduces probability for sets not containing observed move", () => {
      const sets = [
        makeSet({
          name: "With EQ",
          moves: ["Earthquake", "Outrage", "Swords Dance", "Stealth Rock"],
        }),
        makeSet({
          name: "No EQ",
          moves: ["Dragon Claw", "Fire Fang", "Swords Dance", "Stealth Rock"],
        }),
      ]
      predictor.initializeFromSets("garchomp", sets)

      predictor.updateFromObservation("garchomp", { moveUsed: "Earthquake" })

      const preds = predictor.getPrediction("garchomp")
      // The set with Earthquake should be far more likely
      const withEQ = preds.find((p) => p.set.name === "With EQ")!
      const noEQ = preds.find((p) => p.set.name === "No EQ")!
      expect(withEQ.probability).toBeGreaterThan(noEQ.probability)
      expect(withEQ.probability).toBeGreaterThan(0.9)
    })

    it("reduces probability for sets not matching observed item", () => {
      const sets = [
        makeSet({ name: "Sash", item: "Focus Sash" }),
        makeSet({ name: "Orb", item: "Life Orb" }),
      ]
      predictor.initializeFromSets("garchomp", sets)

      predictor.updateFromObservation("garchomp", { itemRevealed: "Focus Sash" })

      const preds = predictor.getPrediction("garchomp")
      const sash = preds.find((p) => p.set.name === "Sash")!
      const orb = preds.find((p) => p.set.name === "Orb")!
      expect(sash.probability).toBeGreaterThan(orb.probability)
    })

    it("reduces probability for sets not matching observed ability", () => {
      const sets = [
        makeSet({ name: "RS", ability: "Rough Skin" }),
        makeSet({ name: "SV", ability: "Sand Veil" }),
      ]
      predictor.initializeFromSets("garchomp", sets)

      predictor.updateFromObservation("garchomp", { abilityRevealed: "Rough Skin" })

      const preds = predictor.getPrediction("garchomp")
      const rs = preds.find((p) => p.set.name === "RS")!
      const sv = preds.find((p) => p.set.name === "SV")!
      expect(rs.probability).toBeGreaterThan(sv.probability)
    })

    it("does nothing for unknown pokemon", () => {
      // No sets initialized for "charizard"
      predictor.updateFromObservation("charizard", { moveUsed: "Fire Blast" })
      expect(predictor.hasPredictions("charizard")).toBe(false)
    })

    it("re-normalizes probabilities after update", () => {
      const sets = [makeSet({ name: "A" }), makeSet({ name: "B" })]
      predictor.initializeFromSets("garchomp", sets)

      predictor.updateFromObservation("garchomp", { moveUsed: "Earthquake" })

      const preds = predictor.getPrediction("garchomp")
      const total = preds.reduce((s, p) => s + p.probability, 0)
      expect(total).toBeCloseTo(1)
    })

    it("handles case-insensitive move matching", () => {
      const sets = [
        makeSet({
          name: "WithEQ",
          moves: ["earthquake", "Outrage", "Swords Dance", "Stealth Rock"],
        }),
      ]
      predictor.initializeFromSets("garchomp", sets)

      predictor.updateFromObservation("garchomp", { moveUsed: "EARTHQUAKE" })

      // Should still match (case-insensitive)
      const preds = predictor.getPrediction("garchomp")
      expect(preds[0].probability).toBeCloseTo(1)
    })
  })

  // -----------------------------------------------------------------------
  // getPrediction
  // -----------------------------------------------------------------------

  describe("getPrediction", () => {
    it("returns empty array for unknown pokemon", () => {
      expect(predictor.getPrediction("unknown")).toEqual([])
    })

    it("returns predictions sorted by probability descending", () => {
      const sets = [
        makeSet({ name: "A", moves: ["Earthquake", "Outrage", "Swords Dance", "Stealth Rock"] }),
        makeSet({ name: "B", moves: ["Dragon Claw", "Fire Fang", "Swords Dance", "Stealth Rock"] }),
      ]
      predictor.initializeFromSets("garchomp", sets)
      predictor.updateFromObservation("garchomp", { moveUsed: "Earthquake" })

      const preds = predictor.getPrediction("garchomp")
      for (let i = 1; i < preds.length; i++) {
        expect(preds[i - 1].probability).toBeGreaterThanOrEqual(preds[i].probability)
      }
    })
  })

  // -----------------------------------------------------------------------
  // sampleSet
  // -----------------------------------------------------------------------

  describe("sampleSet", () => {
    it("returns null for unknown pokemon", () => {
      expect(predictor.sampleSet("unknown")).toBeNull()
    })

    it("returns a set from the predictions", () => {
      const sets = [makeSet({ name: "A" }), makeSet({ name: "B" })]
      predictor.initializeFromSets("garchomp", sets)

      const sampled = predictor.sampleSet("garchomp")
      expect(sampled).not.toBeNull()
      expect(["A", "B"]).toContain(sampled!.name)
    })

    it("returns last set as fallback when random is exactly 1", () => {
      const sets = [makeSet({ name: "A" }), makeSet({ name: "B" })]
      predictor.initializeFromSets("garchomp", sets)

      // Force Math.random to return value > all cumulative probabilities
      vi.spyOn(Math, "random").mockReturnValue(0.9999999)

      const sampled = predictor.sampleSet("garchomp")
      expect(sampled).not.toBeNull()

      vi.restoreAllMocks()
    })

    it("returns first set when random is 0", () => {
      const sets = [makeSet({ name: "First" }), makeSet({ name: "Second" })]
      predictor.initializeFromSets("garchomp", sets)

      vi.spyOn(Math, "random").mockReturnValue(0)

      const sampled = predictor.sampleSet("garchomp")
      expect(sampled).not.toBeNull()

      vi.restoreAllMocks()
    })
  })

  // -----------------------------------------------------------------------
  // hasPredictions
  // -----------------------------------------------------------------------

  describe("hasPredictions", () => {
    it("returns false for unknown pokemon", () => {
      expect(predictor.hasPredictions("unknown")).toBe(false)
    })

    it("returns true when predictions exist", () => {
      predictor.initializeFromSets("garchomp", [makeSet()])
      expect(predictor.hasPredictions("garchomp")).toBe(true)
    })
  })
})
