import { describe, expect, it } from "vitest"

import { getFormat, resolveFormatId } from "../../packages/formats/src"

describe("Format Resolver", () => {
  it("resolves exact matches", () => {
    expect(resolveFormatId("gen9ou")).toBe("gen9ou")
    expect(resolveFormatId("gen9vgc2026")).toBe("gen9vgc2026")
  })

  it("resolves VGC variants with regulation suffixes", () => {
    // The specific case requested by the user
    expect(resolveFormatId("gen9vgc2026regfbo3")).toBe("gen9vgc2026")

    // Reg I explicit check
    expect(resolveFormatId("gen9vgc2026regi")).toBe("gen9vgc2026regi")

    // Other realistic variants
    expect(resolveFormatId("gen9vgc2026regf")).toBe("gen9vgc2026")
    expect(resolveFormatId("gen9vgc2025regg")).toBe("gen9vgc2025")
    expect(resolveFormatId("gen9vgc2024regh")).toBe("gen9vgc2024")
  })

  it("resolves Battle Stadium variants", () => {
    expect(resolveFormatId("gen9battlestadiumsinglesregf")).toBe("gen9battlestadiumsingles")
    expect(resolveFormatId("gen9battlestadiumdoublesregf")).toBe("gen9battlestadiumdoubles")
  })

  it("resolves Doubles OU aliases", () => {
    expect(resolveFormatId("gen9doublesou")).toBe("gen9doublesou")
    // If suffixes were added
    expect(resolveFormatId("gen9doublesoubeta")).toBe("gen9doublesou")
  })

  it("returns null for completely unknown formats", () => {
    expect(resolveFormatId("gen1ou")).toBe(null) // Not supported yet
    expect(resolveFormatId("randombattle")).toBe(null)
  })

  it("integration with getFormat", () => {
    const format = getFormat("gen9vgc2026regfbo3")
    expect(format).toBeDefined()
    expect(format?.id).toBe("gen9vgc2026")
    expect(format?.name).toBe("VGC 2026")
  })
})
