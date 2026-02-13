import { resolveSpeciesName } from "@nasty-plot/pokemon-data"
import { DEFAULT_IVS, DEFAULT_LEVEL, DEFAULT_NATURE, PERFECT_IV, STATS } from "@nasty-plot/core"
import type { TeamSlotData, StatsTable } from "@nasty-plot/core"

/**
 * Convert a TeamSlotData[] into the packed team string that @pkmn/sim expects.
 *
 * Packed format per Pokemon (pipe-delimited):
 *   nickname|species|item|ability|moves(,separated)|nature|evs(,separated)|gender|ivs(,separated)|shiny|level|happiness,,pokeball,hiddenpowertype,gigantamax,dynamaxlevel,teratype
 *
 * We use the Teams.pack utility from @pkmn/sim when possible, but also provide
 * a manual packer for cases where we need direct control.
 */

function serializeStats(stats: StatsTable): string {
  return STATS.map((s) => stats[s]).join(",")
}

function formatIvs(ivs: StatsTable): string {
  const allMax = Object.values(ivs).every((v) => v === PERFECT_IV)
  if (allMax) return ""
  return serializeStats(ivs)
}

function formatMoves(moves: TeamSlotData["moves"]): string {
  return moves.filter(Boolean).join(",")
}

/**
 * Pack a single TeamSlotData into @pkmn/sim packed format.
 */
export function packOneSlot(slot: TeamSlotData): string {
  const speciesName = resolveSpeciesName(slot.pokemonId)
  const nickname = slot.nickname || ""
  const displayNickname = nickname === speciesName ? "" : nickname

  const parts = [
    displayNickname, // 0: nickname
    speciesName, // 1: species
    slot.item || "", // 2: item
    slot.ability || "", // 3: ability
    formatMoves(slot.moves), // 4: moves
    slot.nature || DEFAULT_NATURE, // 5: nature
    serializeStats(slot.evs), // 6: evs
    "", // 7: gender
    formatIvs(slot.ivs ?? DEFAULT_IVS), // 8: ivs
    "", // 9: shiny
    slot.level === DEFAULT_LEVEL ? "" : String(slot.level), // 10: level (omit if default)
    "", // 11: happiness
  ]

  let packed = parts.join("|")

  if (slot.teraType) {
    packed += `,,,,${slot.teraType}`
  }

  return packed
}

/**
 * Pack a full team of TeamSlotData[] into @pkmn/sim packed team string.
 * Slots are separated by `]`.
 */
export function packTeam(slots: TeamSlotData[]): string {
  return slots.map(packOneSlot).join("]")
}
