import { render, screen } from "@testing-library/react"
import { StatBar } from "@nasty-plot/ui"

describe("StatBar", () => {
  it("renders the stat label and value", () => {
    render(<StatBar stat="hp" value={100} />)
    expect(screen.getByText("HP")).toBeInTheDocument()
    expect(screen.getByText("100")).toBeInTheDocument()
  })

  it("renders correct stat labels for each stat", () => {
    const stats = [
      { stat: "atk" as const, label: "Atk" },
      { stat: "def" as const, label: "Def" },
      { stat: "spa" as const, label: "SpA" },
      { stat: "spd" as const, label: "SpD" },
      { stat: "spe" as const, label: "Spe" },
    ]

    for (const { stat, label } of stats) {
      const { unmount } = render(<StatBar stat={stat} value={50} />)
      expect(screen.getByText(label)).toBeInTheDocument()
      unmount()
    }
  })

  it("calculates bar width as percentage of max", () => {
    const { container } = render(<StatBar stat="atk" value={128} max={256} />)
    const bar = container.querySelector("[style*='width']") as HTMLElement
    expect(bar.style.width).toBe("50%")
  })

  it("caps bar width at 100%", () => {
    const { container } = render(<StatBar stat="spe" value={300} max={255} />)
    const bar = container.querySelector("[style*='width']") as HTMLElement
    expect(bar.style.width).toBe("100%")
  })

  it("uses default max of 255", () => {
    const { container } = render(<StatBar stat="hp" value={255} />)
    const bar = container.querySelector("[style*='width']") as HTMLElement
    expect(bar.style.width).toBe("100%")
  })
})
