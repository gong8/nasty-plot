import { DEFAULT_EVS, DEFAULT_IVS, DEFAULT_LEVEL } from "./constants"
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

function parseFirstLine(firstLine: string): {
  pokemonId: string
  nickname?: string
  item: string
} {
  const atSplit = firstLine.split(" @ ")
  const item = atSplit.length === 2 ? atSplit[1].trim() : ""
  const namePart = atSplit[0].trim()

  // Check for "(Pokemon)" pattern, optionally followed by "(M)" or "(F)"
  const parenMatch = namePart.match(/\(([^)]+)\)\s*(\([MF]\))?$/)
  if (parenMatch && !/^[MF]$/.test(parenMatch[1].trim())) {
    const nicknameRaw = namePart.slice(0, namePart.indexOf("(")).trim()
    return {
      pokemonId: toId(parenMatch[1]),
      nickname: nicknameRaw || undefined,
      item,
    }
  }

  return {
    pokemonId: toId(namePart.replace(/\s*\([MF]\)\s*$/, "")),
    item,
  }
}

export function deduplicateMoves(moves: string[]): [string, string?, string?, string?] {
  const seen = new Set<string>()
  const unique: string[] = []
  for (const move of moves) {
    const lower = move.toLowerCase()
    if (!seen.has(lower)) {
      seen.add(lower)
      unique.push(move)
    }
  }
  return [unique[0] || "", unique[1] || undefined, unique[2] || undefined, unique[3] || undefined]
}

function parseOneSlot(block: string, position: number): Partial<TeamSlotData> | null {
  const lines = block
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length === 0) return null

  const { pokemonId, nickname, item } = parseFirstLine(lines[0])

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
    level: DEFAULT_LEVEL,
  }

  const moves: string[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]

    if (line.startsWith("Ability: ")) {
      slot.ability = line.slice("Ability: ".length).trim()
    } else if (line.startsWith("Level: ")) {
      slot.level = parseInt(line.slice("Level: ".length), 10)
    } else if (line.startsWith("Tera Type: ")) {
      slot.teraType = line.slice("Tera Type: ".length).trim() as PokemonType
    } else if (line.startsWith("EVs: ")) {
      slot.evs = parseStatSpread(line.slice("EVs: ".length), DEFAULT_EVS)
    } else if (line.startsWith("IVs: ")) {
      slot.ivs = parseStatSpread(line.slice("IVs: ".length), DEFAULT_IVS)
    } else if (line.endsWith(" Nature")) {
      slot.nature = line.replace(" Nature", "").trim() as NatureName
    } else if (line.startsWith("- ")) {
      moves.push(line.slice(2).trim())
    }
  }

  slot.moves = deduplicateMoves(moves)

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
  if (slot.level !== DEFAULT_LEVEL) lines.push(`Level: ${slot.level}`)
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
