import { resolveSpeciesName } from "@nasty-plot/pokemon-data"
import { DEFAULT_IVS, STATS, serializeShowdownPaste } from "@nasty-plot/core"
import type { TeamSlotData, StatsTable } from "@nasty-plot/core"

/**
 * Convert team data to Showdown paste format.
 * Hydrates species display names via @pkmn/dex before delegating to core's serializer.
 * @deprecated Prefer `serializeShowdownPaste` from `@nasty-plot/core` with hydrated species.
 */
export function teamToShowdownPaste(slots: TeamSlotData[]): string {
  const hydrated = slots.map((slot) => {
    if (slot.species?.name) return slot
    const name = resolveSpeciesName(slot.pokemonId)
    return { ...slot, species: { name } }
  })
  return serializeShowdownPaste(hydrated as TeamSlotData[])
}

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

function formatEvs(evs: StatsTable): string {
  return serializeStats(evs)
}

function formatIvs(ivs: StatsTable): string {
  const allMax = Object.values(ivs).every((v) => v === 31)
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
    slot.nature || "Hardy", // 5: nature
    formatEvs(slot.evs), // 6: evs
    "", // 7: gender
    formatIvs(slot.ivs ?? DEFAULT_IVS), // 8: ivs
    "", // 9: shiny
    slot.level === 100 ? "" : String(slot.level), // 10: level (omit if 100)
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
