import { isLightTypeColor, TYPE_COLORS, NATURE_DATA, TYPE_CHART } from "@nasty-plot/core"

// ---------------------------------------------------------------------------
// isLightTypeColor
// ---------------------------------------------------------------------------

describe("isLightTypeColor", () => {
  it("returns true for Electric (bright yellow)", () => {
    expect(isLightTypeColor(TYPE_COLORS.Electric)).toBe(true)
  })

  it("returns true for Normal (light gray)", () => {
    expect(isLightTypeColor(TYPE_COLORS.Normal)).toBe(true)
  })

  it("returns false for Fighting (dark red)", () => {
    expect(isLightTypeColor(TYPE_COLORS.Fighting)).toBe(false)
  })

  it("returns false for Ghost (dark purple)", () => {
    expect(isLightTypeColor(TYPE_COLORS.Ghost)).toBe(false)
  })

  it("returns false for Dark (dark brown)", () => {
    expect(isLightTypeColor(TYPE_COLORS.Dark)).toBe(false)
  })

  it("returns true for Ice (light cyan)", () => {
    expect(isLightTypeColor(TYPE_COLORS.Ice)).toBe(true)
  })

  it("handles pure white (#FFFFFF)", () => {
    expect(isLightTypeColor("#FFFFFF")).toBe(true)
  })

  it("handles pure black (#000000)", () => {
    expect(isLightTypeColor("#000000")).toBe(false)
  })

  it("handles mid-gray (#808080)", () => {
    // luminance = (0.299*128 + 0.587*128 + 0.114*128) / 255
    // = 128 / 255 ≈ 0.502 => < 0.55 => false
    expect(isLightTypeColor("#808080")).toBe(false)
  })

  it("returns true for Grass type color", () => {
    expect(isLightTypeColor(TYPE_COLORS.Grass)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// NATURE_DATA
// ---------------------------------------------------------------------------

describe("NATURE_DATA", () => {
  it("has 25 natures", () => {
    expect(Object.keys(NATURE_DATA)).toHaveLength(25)
  })

  it("Adamant boosts atk and lowers spa", () => {
    expect(NATURE_DATA.Adamant.plus).toBe("atk")
    expect(NATURE_DATA.Adamant.minus).toBe("spa")
  })

  it("Hardy is neutral (no plus or minus)", () => {
    expect(NATURE_DATA.Hardy.plus).toBeUndefined()
    expect(NATURE_DATA.Hardy.minus).toBeUndefined()
  })

  it("every nature has a name property matching its key", () => {
    for (const [key, value] of Object.entries(NATURE_DATA)) {
      expect(value.name).toBe(key)
    }
  })

  it("natures with plus also have minus (and vice versa)", () => {
    for (const [, value] of Object.entries(NATURE_DATA)) {
      if (value.plus) {
        expect(value.minus).toBeDefined()
      }
      if (value.minus) {
        expect(value.plus).toBeDefined()
      }
    }
  })
})

// ---------------------------------------------------------------------------
// TYPE_CHART
// ---------------------------------------------------------------------------

describe("TYPE_CHART", () => {
  it("has 18 attacking types", () => {
    expect(Object.keys(TYPE_CHART)).toHaveLength(18)
  })

  it("Fire is super effective against Grass", () => {
    expect(TYPE_CHART.Fire.Grass).toBe(2)
  })

  it("Normal is immune to Ghost", () => {
    expect(TYPE_CHART.Normal.Ghost).toBe(0)
  })

  it("Water resists itself", () => {
    expect(TYPE_CHART.Water.Water).toBe(0.5)
  })

  it("undefined matchups are implicitly neutral (1x)", () => {
    // Fire vs Normal — not listed, means 1x
    expect(TYPE_CHART.Fire.Normal).toBeUndefined()
  })

  it("Dragon is immune to Fairy (attacking)", () => {
    expect(TYPE_CHART.Dragon.Fairy).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// TYPE_COLORS
// ---------------------------------------------------------------------------

describe("TYPE_COLORS", () => {
  it("has 18 types", () => {
    expect(Object.keys(TYPE_COLORS)).toHaveLength(18)
  })

  it("all values are hex color strings", () => {
    for (const color of Object.values(TYPE_COLORS)) {
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/)
    }
  })
})
