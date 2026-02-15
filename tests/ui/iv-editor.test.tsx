import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { IvEditor } from "@nasty-plot/ui"
import { STAT_LABELS } from "@nasty-plot/core"
import type { StatsTable } from "@nasty-plot/core"

const defaultIvs: StatsTable = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }

describe("IvEditor", () => {
  it("renders all 6 stat labels", () => {
    render(<IvEditor ivs={defaultIvs} onChange={vi.fn()} />)
    for (const label of Object.values(STAT_LABELS)) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it("renders 6 number inputs", () => {
    render(<IvEditor ivs={defaultIvs} onChange={vi.fn()} />)
    const inputs = screen.getAllByRole("spinbutton")
    expect(inputs).toHaveLength(6)
  })

  it("displays current IV values in the inputs", () => {
    const ivs: StatsTable = { hp: 31, atk: 0, def: 31, spa: 31, spd: 31, spe: 31 }
    render(<IvEditor ivs={ivs} onChange={vi.fn()} />)
    const inputs = screen.getAllByRole("spinbutton")
    // atk is the second stat (index 1), should have value 0
    expect(inputs[1]).toHaveValue(0)
    // hp is the first stat (index 0), should have value 31
    expect(inputs[0]).toHaveValue(31)
  })

  it("calls onChange when a value is changed", async () => {
    const onChange = vi.fn()
    render(<IvEditor ivs={defaultIvs} onChange={onChange} />)
    const inputs = screen.getAllByRole("spinbutton")
    // Clear and type new value in the HP input (first one)
    await userEvent.clear(inputs[0])
    await userEvent.type(inputs[0], "0")
    expect(onChange).toHaveBeenCalledWith("hp", 0)
  })

  it("sets min=0 and max=31 on inputs", () => {
    render(<IvEditor ivs={defaultIvs} onChange={vi.fn()} />)
    const inputs = screen.getAllByRole("spinbutton")
    for (const input of inputs) {
      expect(input).toHaveAttribute("min", "0")
      expect(input).toHaveAttribute("max", "31")
    }
  })
})
