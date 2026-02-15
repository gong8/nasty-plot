import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MoveSelector } from "@nasty-plot/ui"
import type { MoveData } from "@nasty-plot/core"

const makeMoveData = (overrides: Partial<MoveData> & { name: string }): MoveData => ({
  id: overrides.name.toLowerCase().replace(/\s+/g, ""),
  type: "Normal",
  category: "Physical",
  basePower: 80,
  accuracy: 100,
  pp: 10,
  priority: 0,
  target: "normal",
  flags: {},
  ...overrides,
})

const sampleMoves: MoveData[] = [
  makeMoveData({ name: "Earthquake", type: "Ground", basePower: 100 }),
  makeMoveData({ name: "Flamethrower", type: "Fire", category: "Special", basePower: 90 }),
  makeMoveData({ name: "Ice Beam", type: "Ice", category: "Special", basePower: 90 }),
  makeMoveData({ name: "Thunderbolt", type: "Electric", category: "Special", basePower: 90 }),
  makeMoveData({ name: "Close Combat", type: "Fighting", basePower: 120 }),
]

describe("MoveSelector", () => {
  it("renders with placeholder text", () => {
    render(<MoveSelector value="" onSelect={vi.fn()} moves={sampleMoves} />)
    expect(screen.getByPlaceholderText("Select move...")).toBeInTheDocument()
  })

  it("renders with custom placeholder", () => {
    render(
      <MoveSelector value="" onSelect={vi.fn()} moves={sampleMoves} placeholder="Pick a move" />,
    )
    expect(screen.getByPlaceholderText("Pick a move")).toBeInTheDocument()
  })

  it("displays current value when not open", () => {
    render(<MoveSelector value="Earthquake" onSelect={vi.fn()} moves={sampleMoves} />)
    const input = screen.getByDisplayValue("Earthquake")
    expect(input).toBeInTheDocument()
  })

  it("opens dropdown and shows moves on focus", async () => {
    render(<MoveSelector value="" onSelect={vi.fn()} moves={sampleMoves} />)
    const input = screen.getByPlaceholderText("Select move...")
    await userEvent.click(input)
    for (const move of sampleMoves) {
      expect(screen.getByText(move.name)).toBeInTheDocument()
    }
  })

  it("filters moves as user types", async () => {
    render(<MoveSelector value="" onSelect={vi.fn()} moves={sampleMoves} />)
    const input = screen.getByPlaceholderText("Select move...")
    await userEvent.click(input)
    await userEvent.type(input, "thunder")
    expect(screen.getByText("Thunderbolt")).toBeInTheDocument()
    expect(screen.queryByText("Earthquake")).not.toBeInTheDocument()
    expect(screen.queryByText("Flamethrower")).not.toBeInTheDocument()
  })

  it("calls onSelect when a move is clicked", async () => {
    const onSelect = vi.fn()
    render(<MoveSelector value="" onSelect={onSelect} moves={sampleMoves} />)
    const input = screen.getByPlaceholderText("Select move...")
    await userEvent.click(input)
    await userEvent.click(screen.getByText("Ice Beam"))
    expect(onSelect).toHaveBeenCalledWith("Ice Beam")
  })

  it("shows move metadata (type badge, category, power)", async () => {
    render(<MoveSelector value="" onSelect={vi.fn()} moves={sampleMoves} showMetadata />)
    const input = screen.getByPlaceholderText("Select move...")
    await userEvent.click(input)
    // Multiple moves are Physical, so use getAllByText
    const physLabels = screen.getAllByText("Phys")
    expect(physLabels.length).toBeGreaterThan(0)
    expect(screen.getByText("Ground")).toBeInTheDocument()
    expect(screen.getByText("100")).toBeInTheDocument()
  })

  it("excludes moves in the excludeMoves set", async () => {
    const excluded = new Set(["earthquake"])
    render(<MoveSelector value="" onSelect={vi.fn()} moves={sampleMoves} excludeMoves={excluded} />)
    const input = screen.getByPlaceholderText("Select move...")
    await userEvent.click(input)
    expect(screen.queryByText("Earthquake")).not.toBeInTheDocument()
    expect(screen.getByText("Flamethrower")).toBeInTheDocument()
  })

  it("works with moveNames instead of full MoveData", async () => {
    render(<MoveSelector value="" onSelect={vi.fn()} moveNames={["Surf", "Fly", "Strength"]} />)
    const input = screen.getByPlaceholderText("Select move...")
    await userEvent.click(input)
    expect(screen.getByText("Surf")).toBeInTheDocument()
    expect(screen.getByText("Fly")).toBeInTheDocument()
    expect(screen.getByText("Strength")).toBeInTheDocument()
  })

  it("shows Common section when popularity data is provided", async () => {
    const popularity = [
      { name: "Earthquake", usagePercent: 85.2 },
      { name: "Close Combat", usagePercent: 60.1 },
    ]
    render(<MoveSelector value="" onSelect={vi.fn()} moves={sampleMoves} popularity={popularity} />)
    const input = screen.getByPlaceholderText("Select move...")
    await userEvent.click(input)
    expect(screen.getByText("Common")).toBeInTheDocument()
    expect(screen.getByText("85.2%")).toBeInTheDocument()
  })

  it("disables the input when disabled prop is true", () => {
    render(<MoveSelector value="" onSelect={vi.fn()} moves={sampleMoves} disabled />)
    expect(screen.getByPlaceholderText("Select move...")).toBeDisabled()
  })

  it("shows duplicate warning when value is in excludeMoves", () => {
    const excluded = new Set(["earthquake"])
    render(
      <MoveSelector
        value="Earthquake"
        onSelect={vi.fn()}
        moves={sampleMoves}
        excludeMoves={excluded}
      />,
    )
    expect(screen.getByText("Duplicate move")).toBeInTheDocument()
  })
})
