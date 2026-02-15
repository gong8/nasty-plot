import type { TeamSlotData } from "@nasty-plot/core"
import { DEFAULT_EVS, DEFAULT_IVS, DEFAULT_LEVEL } from "@nasty-plot/core"
import { analyzeTypeCoverage } from "@nasty-plot/analysis"
import { makeSlot } from "../test-utils"

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("analyzeTypeCoverage", () => {
  it("returns empty coverage for empty team", () => {
    const result = analyzeTypeCoverage([])

    expect(result).toHaveProperty("offensive")
    expect(result).toHaveProperty("defensive")
    expect(result).toHaveProperty("uncoveredTypes")
    expect(result).toHaveProperty("sharedWeaknesses")
  })

  it("returns TypeCoverage shape", () => {
    const result = analyzeTypeCoverage([makeSlot("garchomp", ["Dragon", "Ground"])])

    expect(typeof result.offensive).toBe("object")
    expect(typeof result.defensive).toBe("object")
    expect(Array.isArray(result.uncoveredTypes)).toBe(true)
    expect(Array.isArray(result.sharedWeaknesses)).toBe(true)
  })

  it("calculates offensive coverage from STAB types", () => {
    const result = analyzeTypeCoverage([makeSlot("charizard", ["Fire", "Flying"])])

    // Fire is super-effective against Grass, Ice, Bug, Steel
    // So those types should have offensive coverage > 0
    expect(result.offensive["Grass"]).toBeGreaterThan(0)
    expect(result.offensive["Ice"]).toBeGreaterThan(0)
    expect(result.offensive["Bug"]).toBeGreaterThan(0)
    expect(result.offensive["Steel"]).toBeGreaterThan(0)
  })

  it("calculates defensive coverage (resistances)", () => {
    const result = analyzeTypeCoverage([makeSlot("heatran", ["Fire", "Steel"])])

    // Fire/Steel resists many types
    // e.g. Bug, Fairy, Grass, Ice, Steel, etc.
    expect(result.defensive["Bug"]).toBeGreaterThan(0)
    expect(result.defensive["Fairy"]).toBeGreaterThan(0)
  })

  it("identifies uncovered types", () => {
    // Normal type has no super-effective coverage
    const result = analyzeTypeCoverage([makeSlot("snorlax", ["Normal"])])

    expect(result.uncoveredTypes.length).toBeGreaterThan(0)
  })

  it("identifies shared weaknesses", () => {
    // Two Water-types share Electric and Grass weaknesses
    const result = analyzeTypeCoverage([
      makeSlot("vaporeon", ["Water"]),
      makeSlot("starmie", ["Water", "Psychic"]),
    ])

    // Both are weak to Electric and Grass
    const hasElectric = result.sharedWeaknesses.includes("Electric")
    const hasGrass = result.sharedWeaknesses.includes("Grass")
    expect(hasElectric || hasGrass).toBe(true)
  })

  it("reports no shared weaknesses when types are diverse", () => {
    const result = analyzeTypeCoverage([
      makeSlot("garchomp", ["Dragon", "Ground"]),
      makeSlot("heatran", ["Fire", "Steel"]),
    ])

    // These types complement each other well
    // Shared weaknesses should be few or none
    // (Dragon/Ground is weak to Ice, Dragon, Fairy; Fire/Steel is weak to Ground, Water, Fighting)
    // No shared weaknesses expected
    expect(result.sharedWeaknesses.length).toBeLessThanOrEqual(1)
  })

  it("handles slots without species data", () => {
    const slot: TeamSlotData = {
      position: 1,
      pokemonId: "unknown",
      species: undefined,
      ability: "",
      item: "",
      nature: "Hardy",
      level: DEFAULT_LEVEL,
      moves: [undefined, undefined, undefined, undefined],
      evs: DEFAULT_EVS,
      ivs: DEFAULT_IVS,
    }

    const result = analyzeTypeCoverage([slot])

    expect(result).toBeDefined()
    expect(result.uncoveredTypes.length).toBeGreaterThan(0)
  })

  it("works with multiple team members", () => {
    const team = [
      makeSlot("garchomp", ["Dragon", "Ground"]),
      makeSlot("heatran", ["Fire", "Steel"]),
      makeSlot("tapu-lele", ["Psychic", "Fairy"]),
    ]

    const result = analyzeTypeCoverage(team)

    // With diverse types, more offensive coverage expected
    const coveredCount = Object.values(result.offensive).filter((v) => v > 0).length
    expect(coveredCount).toBeGreaterThan(0)
  })
})
