import { DEFAULT_EVS, DEFAULT_IVS } from "./constants"
import { STATS } from "./types"
import type { NatureName, PokemonType, StatsTable, TeamSlotData } from "./types"

const STAT_SHOWDOWN_MAP: Record<string, keyof StatsTable> = {
  HP: "hp",
  Atk: "atk",
  Def: "def",
  SpA: "spa",
  SpD: "spd",
  Spe: "spe",
}

const STAT_TO_SHOWDOWN: Record<keyof StatsTable, string> = {
  hp: "HP",
  atk: "Atk",
  def: "Def",
  spa: "SpA",
  spd: "SpD",
  spe: "Spe",
}

/**
 * Parse a Showdown paste (one or more Pokemon) into TeamSlotData[].
 */
export function parseShowdownPaste(paste: string): Partial<TeamSlotData>[] {
  const blocks = paste.trim().split(/\n\s*\n/)
  return blocks
    .map((block, i) => parseOneSlot(block.trim(), i + 1))
    .filter(Boolean) as Partial<TeamSlotData>[]
}

function parseOneSlot(block: string, position: number): Partial<TeamSlotData> | null {
  const lines = block
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length === 0) return null

  // First line: "Nickname (Pokemon) (F) @ Item" or "Pokemon @ Item"
  const firstLine = lines[0]
  let pokemonId = ""
  let item = ""

  const atSplit = firstLine.split(" @ ")
  if (atSplit.length === 2) item = atSplit[1].trim()

  const namePart = atSplit[0].trim()
  let nickname: string | undefined
  // Check for "(Pokemon)" pattern, optionally followed by "(M)" or "(F)"
  const parenMatch = namePart.match(/\(([^)]+)\)\s*(\([MF]\))?$/)
  if (parenMatch && !/^[MF]$/.test(parenMatch[1].trim())) {
    // Parenthesized content is a species name (not just a gender marker)
    pokemonId = toId(parenMatch[1])
    // Everything before the first "(" is the nickname
    const nicknameRaw = namePart.slice(0, namePart.indexOf("(")).trim()
    if (nicknameRaw) nickname = nicknameRaw
  } else {
    // No species in parens — strip any trailing gender marker
    pokemonId = toId(namePart.replace(/\s*\([MF]\)\s*$/, ""))
  }

  const slot: Partial<TeamSlotData> = {
    position,
    pokemonId,
    nickname,
    item,
    ability: "",
    nature: "Hardy" as NatureName,
    moves: ["", undefined, undefined, undefined],
    evs: { ...DEFAULT_EVS },
    ivs: { ...DEFAULT_IVS },
    level: 100,
  }

  const moves: string[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]

    if (line.startsWith("Ability: ")) {
      slot.ability = line.slice(9).trim()
    } else if (line.startsWith("Level: ")) {
      slot.level = parseInt(line.slice(7), 10)
    } else if (line.startsWith("Tera Type: ")) {
      slot.teraType = line.slice(11).trim() as PokemonType
    } else if (line.startsWith("EVs: ")) {
      slot.evs = parseStatSpread(line.slice(5), DEFAULT_EVS)
    } else if (line.startsWith("IVs: ")) {
      slot.ivs = parseStatSpread(line.slice(5), DEFAULT_IVS)
    } else if (line.endsWith(" Nature")) {
      slot.nature = line.replace(" Nature", "").trim() as NatureName
    } else if (line.startsWith("- ")) {
      moves.push(line.slice(2).trim())
    }
  }

  // Deduplicate moves (case-insensitive)
  const seen = new Set<string>()
  const uniqueMoves: string[] = []
  for (const move of moves) {
    const lower = move.toLowerCase()
    if (!seen.has(lower)) {
      seen.add(lower)
      uniqueMoves.push(move)
    }
  }

  slot.moves = [
    uniqueMoves[0] || "",
    uniqueMoves[1] || undefined,
    uniqueMoves[2] || undefined,
    uniqueMoves[3] || undefined,
  ]

  return slot
}

function parseStatSpread(str: string, defaults: StatsTable): StatsTable {
  const result = { ...defaults }
  const parts = str.split("/").map((s) => s.trim())
  for (const part of parts) {
    const match = part.match(/^(\d+)\s+(HP|Atk|Def|SpA|SpD|Spe)$/)
    if (match) {
      const stat = STAT_SHOWDOWN_MAP[match[2]]
      if (stat) result[stat] = parseInt(match[1], 10)
    }
  }
  return result
}

/**
 * Serialize a team into Showdown paste format.
 */
export function serializeShowdownPaste(slots: TeamSlotData[]): string {
  return slots.map(serializeOneSlot).join("\n\n")
}

function serializeOneSlot(slot: TeamSlotData): string {
  const lines: string[] = []

  // First line: Nickname (Pokemon) @ Item  or  Pokemon @ Item
  const speciesName = slot.species?.name || slot.pokemonId
  const displayName = slot.nickname ? `${slot.nickname} (${speciesName})` : speciesName
  if (slot.item) {
    lines.push(`${displayName} @ ${slot.item}`)
  } else {
    lines.push(displayName)
  }

  if (slot.ability) lines.push(`Ability: ${slot.ability}`)
  if (slot.level !== 100) lines.push(`Level: ${slot.level}`)
  if (slot.teraType) lines.push(`Tera Type: ${slot.teraType}`)

  // EVs
  const evParts = formatStatSpread(slot.evs, DEFAULT_EVS)
  if (evParts) lines.push(`EVs: ${evParts}`)

  // Nature
  lines.push(`${slot.nature} Nature`)

  // IVs
  const ivParts = formatStatSpread(slot.ivs, DEFAULT_IVS)
  if (ivParts) lines.push(`IVs: ${ivParts}`)

  // Moves
  for (const move of slot.moves) {
    if (move) lines.push(`- ${move}`)
  }

  return lines.join("\n")
}

function formatStatSpread(stats: StatsTable, defaults: StatsTable): string | null {
  const parts: string[] = []
  for (const stat of STATS) {
    if (stats[stat] !== defaults[stat]) {
      parts.push(`${stats[stat]} ${STAT_TO_SHOWDOWN[stat]}`)
    }
  }
  return parts.length > 0 ? parts.join(" / ") : null
}

/**
 * Convert a display name to a Showdown-style ID (lowercase, no spaces/special chars).
 */
export function toId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "")
}
