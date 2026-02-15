import { render, screen } from "@testing-library/react"
import { CalculatedStatsDisplay } from "@nasty-plot/ui"
import { STAT_LABELS } from "@nasty-plot/core"
import type { StatsTable } from "@nasty-plot/core"

describe("CalculatedStatsDisplay", () => {
  const stats: StatsTable = { hp: 341, atk: 284, def: 196, spa: 152, spd: 196, spe: 262 }

  it("renders all 6 stat labels", () => {
    render(<CalculatedStatsDisplay stats={stats} />)
    for (const label of Object.values(STAT_LABELS)) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it("displays all stat values", () => {
    render(<CalculatedStatsDisplay stats={stats} />)
    expect(screen.getByText("341")).toBeInTheDocument()
    expect(screen.getByText("284")).toBeInTheDocument()
    // 196 appears twice (def and spd)
    expect(screen.getAllByText("196")).toHaveLength(2)
    expect(screen.getByText("152")).toBeInTheDocument()
    expect(screen.getByText("262")).toBeInTheDocument()
  })

  it("renders 6 stat cards", () => {
    const { container } = render(<CalculatedStatsDisplay stats={stats} />)
    const grid = container.firstChild as HTMLElement
    expect(grid.children).toHaveLength(6)
  })

  it("applies custom className", () => {
    const { container } = render(<CalculatedStatsDisplay stats={stats} className="mt-4" />)
    const grid = container.firstChild as HTMLElement
    expect(grid.className).toContain("mt-4")
  })
})
