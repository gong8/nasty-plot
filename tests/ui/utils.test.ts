import { cn } from "@nasty-plot/ui"

// ---------------------------------------------------------------------------
// cn() — clsx + tailwind-merge wrapper
// ---------------------------------------------------------------------------

describe("cn", () => {
  it("returns empty string for no arguments", () => {
    expect(cn()).toBe("")
  })

  it("returns a single class unchanged", () => {
    expect(cn("px-4")).toBe("px-4")
  })

  it("merges multiple class strings", () => {
    const result = cn("px-4", "py-2")
    expect(result).toContain("px-4")
    expect(result).toContain("py-2")
  })

  it("handles conditional classes (falsy values)", () => {
    const isFalse = false
    const result = cn("px-4", isFalse && "hidden", undefined, null, "py-2")
    expect(result).toContain("px-4")
    expect(result).toContain("py-2")
    expect(result).not.toContain("hidden")
  })

  it("merges conflicting Tailwind classes (last wins)", () => {
    // tailwind-merge should resolve px-4 vs px-8 to px-8
    const result = cn("px-4", "px-8")
    expect(result).toBe("px-8")
    expect(result).not.toContain("px-4")
  })

  it("merges conflicting bg colors", () => {
    const result = cn("bg-red-500", "bg-blue-500")
    expect(result).toBe("bg-blue-500")
  })

  it("keeps non-conflicting classes intact", () => {
    const result = cn("px-4", "py-2", "bg-red-500", "text-white")
    expect(result).toContain("px-4")
    expect(result).toContain("py-2")
    expect(result).toContain("bg-red-500")
    expect(result).toContain("text-white")
  })

  it("handles array arguments via clsx", () => {
    const result = cn(["px-4", "py-2"])
    expect(result).toContain("px-4")
    expect(result).toContain("py-2")
  })

  it("handles object arguments via clsx", () => {
    const result = cn({ "px-4": true, hidden: false, "py-2": true })
    expect(result).toContain("px-4")
    expect(result).toContain("py-2")
    expect(result).not.toContain("hidden")
  })

  it("resolves conflicting responsive prefixes", () => {
    const result = cn("md:px-4", "md:px-8")
    expect(result).toBe("md:px-8")
  })
})
