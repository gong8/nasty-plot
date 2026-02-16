export {
  getDex,
  getSpecies,
  listSpecies,
  listSpeciesByName,
  listSpeciesByBst,
  getTypeIndex,
  getMove,
  listMoves,
  getAbility,
  getItem,
  listItems,
  searchItems,
  getLearnset,
  searchSpecies,
  getTypeChart,
  isMegaStone,
  getGen9,
  getRawMove,
  getRawSpecies,
  getType,
  resolveSpeciesName,
  enrichWithSpeciesData,
} from "./dex.service"

export type * from "./types"

export { getSpriteUrl, getIconUrl } from "./sprite.service"
export type { SpriteOptions } from "./sprite.service"
