import type { NatureName, PokemonType, StatsTable, StatusName } from "@nasty-plot/core"

export interface PokemonConfig {
  pokemonId: string
  pokemonName: string
  level: number
  ability: string
  item: string
  nature: NatureName
  evs: StatsTable
  ivs: StatsTable
  boosts: StatsTable
  teraType: PokemonType | ""
  status: StatusName | ""
}
