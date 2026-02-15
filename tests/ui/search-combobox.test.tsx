import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SearchCombobox } from "@nasty-plot/ui"

interface TestItem {
  id: string
  name: string
}

const items: TestItem[] = [
  { id: "pikachu", name: "Pikachu" },
  { id: "charizard", name: "Charizard" },
  { id: "bulbasaur", name: "Bulbasaur" },
]

describe("SearchCombobox", () => {
  it("renders the trigger button with placeholder when no value", () => {
    render(
      <SearchCombobox
        value=""
        placeholder="Pick a Pokemon"
        onSelect={vi.fn()}
        items={items}
        renderItem={(item) => <span>{item.name}</span>}
      />,
    )
    expect(screen.getByText("Pick a Pokemon")).toBeInTheDocument()
  })

  it("renders the trigger button with the selected value", () => {
    render(
      <SearchCombobox
        value="Pikachu"
        onSelect={vi.fn()}
        items={items}
        renderItem={(item) => <span>{item.name}</span>}
      />,
    )
    expect(screen.getByText("Pikachu")).toBeInTheDocument()
  })

  it("has combobox role on the trigger", () => {
    render(
      <SearchCombobox
        value=""
        onSelect={vi.fn()}
        items={items}
        renderItem={(item) => <span>{item.name}</span>}
      />,
    )
    expect(screen.getByRole("combobox")).toBeInTheDocument()
  })

  it("opens the popover when the trigger is clicked", async () => {
    render(
      <SearchCombobox
        value=""
        onSelect={vi.fn()}
        items={items}
        renderItem={(item) => <span>{item.name}</span>}
      />,
    )
    const trigger = screen.getByRole("combobox")
    await userEvent.click(trigger)
    expect(trigger).toHaveAttribute("aria-expanded", "true")
  })

  it("disables the trigger when disabled prop is true", () => {
    render(
      <SearchCombobox
        value=""
        onSelect={vi.fn()}
        items={items}
        renderItem={(item) => <span>{item.name}</span>}
        disabled
      />,
    )
    expect(screen.getByRole("combobox")).toBeDisabled()
  })
})
