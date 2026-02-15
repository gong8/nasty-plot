export { FORMAT_DEFINITIONS } from "./data/format-definitions"
export { resolveFormatId, getFormatFallbacks } from "./format-resolver.service"
export {
  getFormat,
  listFormats,
  getActiveFormats,
  getFormatPokemon,
  isLegalInFormat,
  getFormatItems,
  getFormatMoves,
  getFormatLearnset,
} from "./format.service"
// ensureFormatExists is server-only (imports @nasty-plot/db).
// Import it from "@nasty-plot/formats/db" to avoid pulling Prisma into client bundles.
export type * from "./types"
