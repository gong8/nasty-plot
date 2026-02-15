import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { TypeBadge } from "@nasty-plot/ui"
import { TYPE_COLORS } from "@nasty-plot/core"

describe("TypeBadge", () => {
  it("renders the type name by default", () => {
    render(<TypeBadge type="Fire" />)
    expect(screen.getByText("Fire")).toBeInTheDocument()
  })

  it("renders a custom label when provided", () => {
    render(<TypeBadge type="Water" label="Tera" />)
    expect(screen.getByText("Tera")).toBeInTheDocument()
    expect(screen.queryByText("Water")).not.toBeInTheDocument()
  })

  it("applies the correct background color", () => {
    render(<TypeBadge type="Grass" />)
    const badge = screen.getByText("Grass")
    expect(badge).toHaveStyle({ backgroundColor: TYPE_COLORS.Grass })
  })

  it("renders as a button when onClick is provided", async () => {
    const onClick = vi.fn()
    render(<TypeBadge type="Electric" onClick={onClick} />)
    const badge = screen.getByRole("button")
    await userEvent.click(badge)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it("does not render button role without onClick", () => {
    render(<TypeBadge type="Psychic" />)
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("applies sm size classes", () => {
    render(<TypeBadge type="Dark" size="sm" />)
    const badge = screen.getByText("Dark")
    expect(badge.className).toContain("min-w-[48px]")
  })
})
