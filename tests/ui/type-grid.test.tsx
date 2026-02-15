import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { TypeGrid } from "@nasty-plot/ui"
import type { PokemonType } from "@nasty-plot/core"

const SAMPLE_TYPES: PokemonType[] = ["Fire", "Water", "Grass", "Electric"]

describe("TypeGrid", () => {
  it("renders all provided types", () => {
    render(<TypeGrid types={SAMPLE_TYPES} />)
    for (const type of SAMPLE_TYPES) {
      expect(screen.getByText(type)).toBeInTheDocument()
    }
  })

  it("renders a grid with correct column count", () => {
    const { container } = render(<TypeGrid types={SAMPLE_TYPES} columns={4} />)
    const grid = container.firstChild as HTMLElement
    expect(grid.style.gridTemplateColumns).toBe("repeat(4, minmax(0, 1fr))")
  })

  it("defaults to 6 columns", () => {
    const { container } = render(<TypeGrid types={SAMPLE_TYPES} />)
    const grid = container.firstChild as HTMLElement
    expect(grid.style.gridTemplateColumns).toBe("repeat(6, minmax(0, 1fr))")
  })

  it("calls onSelect with the clicked type", async () => {
    const onSelect = vi.fn()
    render(<TypeGrid types={SAMPLE_TYPES} onSelect={onSelect} />)
    await userEvent.click(screen.getByText("Water"))
    expect(onSelect).toHaveBeenCalledWith("Water")
  })

  it("highlights the selected type", () => {
    render(<TypeGrid types={SAMPLE_TYPES} selectedType="Fire" />)
    const fireBadge = screen.getByText("Fire")
    expect(fireBadge.className).toContain("ring-2")
    expect(fireBadge.className).toContain("scale-105")
  })

  it("dims non-selected types when a type is selected", () => {
    render(<TypeGrid types={SAMPLE_TYPES} selectedType="Fire" />)
    const waterBadge = screen.getByText("Water")
    expect(waterBadge.className).toContain("opacity-70")
  })

  it("applies weakness status style from statusMap", () => {
    const statusMap: Partial<Record<PokemonType, string>> = {
      Fire: "weakness",
      Water: "covered",
      Grass: "neutral",
    }
    render(<TypeGrid types={SAMPLE_TYPES} statusMap={statusMap} />)

    const fireBadge = screen.getByText("Fire")
    expect(fireBadge.className).toContain("ring-red-400/50")

    const waterBadge = screen.getByText("Water")
    expect(waterBadge.className).toContain("ring-green-400/50")

    const grassBadge = screen.getByText("Grass")
    expect(grassBadge.className).toContain("opacity-40")
  })

  it("applies neutral opacity to types not in statusMap", () => {
    const statusMap: Partial<Record<PokemonType, string>> = {
      Fire: "covered",
    }
    render(<TypeGrid types={SAMPLE_TYPES} statusMap={statusMap} />)
    const electricBadge = screen.getByText("Electric")
    expect(electricBadge.className).toContain("opacity-40")
  })
})
