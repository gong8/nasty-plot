import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { PokemonSearchSelector } from "@nasty-plot/ui"
import type { PokemonSpecies, PokemonType } from "@nasty-plot/core"

vi.mock("@nasty-plot/pokemon-data", () => ({
  getSpriteUrl: vi.fn(
    (pokemonId: string) => `https://play.pokemonshowdown.com/sprites/gen5/${pokemonId}.png`,
  ),
}))

const makeSpecies = (id: string, name: string, types: PokemonType[]): PokemonSpecies =>
  ({
    id,
    name,
    types,
    baseStats: { hp: 80, atk: 100, def: 80, spa: 60, spd: 80, spe: 100 },
    abilities: { 0: "Intimidate" },
    weightkg: 90,
  }) as PokemonSpecies

const results: PokemonSpecies[] = [
  makeSpecies("garchomp", "Garchomp", ["Dragon", "Ground"]),
  makeSpecies("gardevoir", "Gardevoir", ["Psychic", "Fairy"]),
]

describe("PokemonSearchSelector", () => {
  it("renders the search input with placeholder", () => {
    render(<PokemonSearchSelector onSelect={vi.fn()} onSearch={vi.fn()} />)
    expect(screen.getByPlaceholderText("Search Pokemon...")).toBeInTheDocument()
  })

  it("renders with custom placeholder", () => {
    render(<PokemonSearchSelector onSelect={vi.fn()} onSearch={vi.fn()} placeholder="Find a mon" />)
    expect(screen.getByPlaceholderText("Find a mon")).toBeInTheDocument()
  })

  it("does not search with fewer than 2 characters", async () => {
    const onSearch = vi.fn()
    render(<PokemonSearchSelector onSelect={vi.fn()} onSearch={onSearch} />)
    const input = screen.getByPlaceholderText("Search Pokemon...")
    await userEvent.type(input, "g")
    // Wait enough for debounce
    await new Promise((r) => setTimeout(r, 300))
    expect(onSearch).not.toHaveBeenCalled()
  })

  it("calls onSearch after typing 2+ characters and debounce", async () => {
    const onSearch = vi.fn().mockResolvedValue(results)
    render(<PokemonSearchSelector onSelect={vi.fn()} onSearch={onSearch} />)
    const input = screen.getByPlaceholderText("Search Pokemon...")
    await userEvent.type(input, "gar")
    await waitFor(() => expect(onSearch).toHaveBeenCalledWith("gar"), { timeout: 1000 })
  })

  it("displays search results", async () => {
    const onSearch = vi.fn().mockResolvedValue(results)
    render(<PokemonSearchSelector onSelect={vi.fn()} onSearch={onSearch} />)
    const input = screen.getByPlaceholderText("Search Pokemon...")
    await userEvent.type(input, "gar")
    await waitFor(() => expect(screen.getByText("Garchomp")).toBeInTheDocument(), {
      timeout: 1000,
    })
    expect(screen.getByText("Gardevoir")).toBeInTheDocument()
  })

  it("calls onSelect when a result is clicked", async () => {
    const onSelect = vi.fn()
    const onSearch = vi.fn().mockResolvedValue(results)
    render(<PokemonSearchSelector onSelect={onSelect} onSearch={onSearch} />)
    const input = screen.getByPlaceholderText("Search Pokemon...")
    await userEvent.type(input, "gar")
    await waitFor(() => expect(screen.getByText("Garchomp")).toBeInTheDocument(), {
      timeout: 1000,
    })
    await userEvent.click(screen.getByText("Garchomp"))
    expect(onSelect).toHaveBeenCalledWith(results[0])
  })

  it("shows 'No Pokemon found' when search returns empty", async () => {
    const onSearch = vi.fn().mockResolvedValue([])
    render(<PokemonSearchSelector onSelect={vi.fn()} onSearch={onSearch} />)
    const input = screen.getByPlaceholderText("Search Pokemon...")
    await userEvent.type(input, "zzz")
    await waitFor(() => expect(screen.getByText("No Pokemon found")).toBeInTheDocument(), {
      timeout: 1000,
    })
  })

  it("displays BST for each result", async () => {
    const onSearch = vi.fn().mockResolvedValue(results)
    render(<PokemonSearchSelector onSelect={vi.fn()} onSearch={onSearch} />)
    const input = screen.getByPlaceholderText("Search Pokemon...")
    await userEvent.type(input, "gar")
    // BST = 80+100+80+60+80+100 = 500
    await waitFor(() => expect(screen.getAllByText("BST 500")).toHaveLength(2), { timeout: 1000 })
  })
})
