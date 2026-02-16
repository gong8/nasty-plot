/**
 * Lightweight browser entry point for @nasty-plot/pokemon-data.
 *
 * Exports only types and sprite URL utilities -- no @pkmn/dex import.
 * Use this from UI packages and client components that only need sprites
 * and type definitions, avoiding the heavy dex data bundle.
 */

export type * from "./types"

export { getSpriteUrl, getIconUrl } from "./sprite.service"
export type { SpriteOptions, IconData } from "./sprite.service"
