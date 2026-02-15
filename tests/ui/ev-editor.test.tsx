import { render, screen } from "@testing-library/react"
import { EvEditor } from "@nasty-plot/ui"
import { STAT_LABELS, MAX_TOTAL_EVS } from "@nasty-plot/core"
import type { StatsTable } from "@nasty-plot/core"

const defaultEvs: StatsTable = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }

describe("EvEditor", () => {
  it("renders all 6 stat labels", () => {
    render(<EvEditor evs={defaultEvs} onChange={vi.fn()} />)
    for (const label of Object.values(STAT_LABELS)) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it("displays current EV values for each stat", () => {
    const evs: StatsTable = { hp: 252, atk: 0, def: 4, spa: 252, spd: 0, spe: 0 }
    render(<EvEditor evs={evs} onChange={vi.fn()} />)
    const matches252 = screen.getAllByText("252")
    expect(matches252).toHaveLength(2)
    expect(screen.getByText("4")).toBeInTheDocument()
  })

  it("shows remaining EVs counter", () => {
    const evs: StatsTable = { hp: 252, atk: 0, def: 4, spa: 252, spd: 0, spe: 0 }
    render(<EvEditor evs={evs} onChange={vi.fn()} />)
    const total = 252 + 4 + 252
    const remaining = MAX_TOTAL_EVS - total
    expect(
      screen.getByText(`${total} / ${MAX_TOTAL_EVS} (${remaining} remaining)`),
    ).toBeInTheDocument()
  })

  it("shows negative remaining in destructive style when over 510", () => {
    const evs: StatsTable = { hp: 252, atk: 252, def: 252, spa: 0, spd: 0, spe: 0 }
    render(<EvEditor evs={evs} onChange={vi.fn()} />)
    const total = 252 + 252 + 252
    const remaining = MAX_TOTAL_EVS - total
    const counter = screen.getByText(`${total} / ${MAX_TOTAL_EVS} (${remaining} remaining)`)
    expect(counter.className).toContain("text-destructive")
  })

  it("hides remaining counter when showRemaining is false", () => {
    const evs: StatsTable = { hp: 252, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }
    render(<EvEditor evs={evs} onChange={vi.fn()} showRemaining={false} />)
    expect(screen.queryByText(/remaining/)).not.toBeInTheDocument()
  })

  it("renders a slider for each stat", () => {
    const { container } = render(<EvEditor evs={defaultEvs} onChange={vi.fn()} />)
    const sliders = container.querySelectorAll("[role='slider']")
    expect(sliders).toHaveLength(6)
  })

  it("displays zero total for default EVs", () => {
    render(<EvEditor evs={defaultEvs} onChange={vi.fn()} />)
    expect(
      screen.getByText(`0 / ${MAX_TOTAL_EVS} (${MAX_TOTAL_EVS} remaining)`),
    ).toBeInTheDocument()
  })
})
