import { Sprites, Icons } from "@pkmn/img"

type SpriteGen =
  | "gen1"
  | "gen1rg"
  | "gen1rb"
  | "gen2"
  | "gen2g"
  | "gen2s"
  | "gen3"
  | "gen3rs"
  | "gen3frlg"
  | "gen3-2"
  | "gen4"
  | "gen4dp"
  | "gen4dp-2"
  | "gen5"
  | "gen5ani"
  | "ani"
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9

export interface SpriteOptions {
  gen?: SpriteGen
  side?: "front" | "back"
  shiny?: boolean
}

export function getSpriteUrl(pokemon: string, options?: SpriteOptions): string {
  const gen: SpriteGen = options?.gen ?? "gen5"
  const side = options?.side === "back" ? ("p1" as const) : ("p2" as const)
  const shiny = options?.shiny ?? false

  const spriteData = Sprites.getPokemon(pokemon, { gen, side, shiny })
  return spriteData.url
}

export interface IconData {
  url: string
  left: number
  top: number
}

export function getIconUrl(pokemon: string): IconData {
  const icon = Icons.getPokemon(pokemon)
  return { url: icon.url, left: icon.left, top: icon.top }
}
