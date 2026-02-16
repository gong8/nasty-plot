import { render, screen } from "@testing-library/react"
import { PokemonSprite } from "@nasty-plot/ui"

vi.mock("@nasty-plot/pokemon-data/browser", () => ({
  getSpriteUrl: vi.fn(
    (pokemonId: string) => `https://play.pokemonshowdown.com/sprites/gen5/${pokemonId}.png`,
  ),
}))

describe("PokemonSprite", () => {
  it("renders an image with the pokemon id as alt text", () => {
    render(<PokemonSprite pokemonId="greatTusk" />)
    const img = screen.getByAltText("greatTusk")
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute("src", expect.stringContaining("greatTusk"))
  })

  it("applies default size of 96", () => {
    render(<PokemonSprite pokemonId="ironValiant" />)
    const img = screen.getByAltText("ironValiant")
    expect(img).toHaveAttribute("width", "96")
    expect(img).toHaveAttribute("height", "96")
  })

  it("applies custom size", () => {
    render(<PokemonSprite pokemonId="garchomp" size={64} />)
    const img = screen.getByAltText("garchomp")
    expect(img).toHaveAttribute("width", "64")
    expect(img).toHaveAttribute("height", "64")
  })

  it("applies fainted styles when fainted prop is true", () => {
    const { container } = render(<PokemonSprite pokemonId="pikachu" fainted />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain("grayscale")
    expect(wrapper.className).toContain("opacity-40")
  })

  it("does not apply fainted styles by default", () => {
    const { container } = render(<PokemonSprite pokemonId="pikachu" />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).not.toContain("grayscale")
  })
})
