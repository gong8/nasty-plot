/**
 * Showdown Replay Import
 *
 * Parses Showdown replay URLs and raw protocol logs to extract
 * battle data for import into the system.
 */

import {
  DEFAULT_FORMAT_ID,
  DEFAULT_LEVEL,
  toId,
  type ExtractedPokemonData,
  type ExtractedTeamData,
} from "@nasty-plot/core"
import type { ShowdownReplayJSON } from "../types"

export type { ExtractedPokemonData, ExtractedTeamData } from "@nasty-plot/core"

/** @deprecated Use ShowdownReplayJSON from ../types */
export type ShowdownReplayJson = ShowdownReplayJSON

export interface ParsedBattleImport {
  source: "replay-url" | "raw-log"
  replayId: string | null
  formatId: string
  gameType: "singles" | "doubles"
  playerNames: [string, string]
  winnerId: "p1" | "p2" | "draw" | null
  turnCount: number
  protocolLog: string
  team1: ExtractedTeamData
  team2: ExtractedTeamData
  uploadTime: number | null
  rating: number | null
}

/** Extract replay ID from a Showdown replay URL */
export function parseReplayUrl(url: string): string | null {
  // Handle URLs like:
  // https://replay.pokemonshowdown.com/gen9ou-12345
  // replay.pokemonshowdown.com/gen9ou-12345
  const match = url.match(/replay\.pokemonshowdown\.com\/([a-z0-9-]+)/i)
  return match ? match[1] : null
}

/** Fetch replay JSON from Showdown */
export async function fetchShowdownReplay(replayId: string): Promise<ShowdownReplayJson> {
  const res = await fetch(`https://replay.pokemonshowdown.com/${replayId}.json`)
  if (!res.ok) {
    throw new Error(`Failed to fetch replay: ${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<ShowdownReplayJson>
}

type SideId = "p1" | "p2"

const IDENT_RE = /^(p[12])[a-d]?:\s*(.+)$/

function parseIdentifier(raw: string | undefined): { side: SideId; nickname: string } | null {
  const match = raw?.match(IDENT_RE)
  if (!match) return null
  return { side: match[1] as SideId, nickname: match[2].trim() }
}

function parseLevelFromDetails(detailParts: string[]): number {
  for (let i = 1; i < detailParts.length; i++) {
    if (detailParts[i].startsWith("L")) {
      return parseInt(detailParts[i].slice(1), 10)
    }
  }
  return DEFAULT_LEVEL
}

/**
 * Parse a raw protocol log to extract battle data.
 * Single-pass extraction of teams, format, players, winner, turn count.
 */
export function parseProtocolLog(log: string): ParsedBattleImport {
  const lines = log.split("\n")

  let formatId = ""
  let gameType: "singles" | "doubles" = "singles"
  const playerNames: [string, string] = ["Player 1", "Player 2"]
  let winnerId: "p1" | "p2" | "draw" | null = null
  let turnCount = 0

  const teams: Record<SideId, Map<string, ExtractedPokemonData>> = {
    p1: new Map(),
    p2: new Map(),
  }

  const nicknameToSpecies: Record<SideId, Map<string, string>> = {
    p1: new Map(),
    p2: new Map(),
  }

  function ensurePokemon(
    side: SideId,
    pokemonId: string,
    pokemonName: string,
    level: number,
  ): ExtractedPokemonData {
    let pokemon = teams[side].get(pokemonId)
    if (!pokemon) {
      pokemon = { pokemonId, pokemonName, level, moves: [] }
      teams[side].set(pokemonId, pokemon)
    }
    return pokemon
  }

  function resolvePokemon(side: SideId, nickname: string): ExtractedPokemonData | null {
    const speciesId = nicknameToSpecies[side].get(nickname)
    if (!speciesId) return null
    return teams[side].get(speciesId) ?? null
  }

  for (const line of lines) {
    const parts = line.split("|")
    if (parts.length < 2) continue
    const cmd = parts[1]
    const args = parts.slice(2)

    switch (cmd) {
      case "player": {
        const side = args[0] as SideId
        if ((side === "p1" || side === "p2") && args[1]) {
          playerNames[side === "p1" ? 0 : 1] = args[1]
        }
        break
      }

      case "gametype": {
        if (args[0] === "doubles") gameType = "doubles"
        break
      }

      case "tier": {
        // |tier|[Gen 9] OU
        const tier = args[0] || ""
        // Extract format ID: "[Gen 9] OU" → "gen9ou"
        const genMatch = tier.match(/\[Gen\s*(\d+)\]\s*(.+)/i)
        if (genMatch) {
          const gen = genMatch[1]
          const format = toId(genMatch[2])
          formatId = `gen${gen}${format}`
        } else {
          formatId = toId(tier)
        }
        break
      }

      case "poke": {
        const side = args[0] as SideId
        if (side !== "p1" && side !== "p2") break
        const detailParts = (args[1] || "").split(",").map((s) => s.trim())
        const species = detailParts[0]
        ensurePokemon(side, toId(species), species, parseLevelFromDetails(detailParts))
        break
      }

      case "switch":
      case "drag":
      case "replace": {
        const ident = parseIdentifier(args[0])
        if (!ident) break
        const detailParts = (args[1] || "").split(",").map((s) => s.trim())
        const species = detailParts[0]
        const speciesId = toId(species)

        nicknameToSpecies[ident.side].set(ident.nickname, speciesId)

        const pokemon = ensurePokemon(
          ident.side,
          speciesId,
          species,
          parseLevelFromDetails(detailParts),
        )
        if (ident.nickname !== species) {
          pokemon.nickname = ident.nickname
        }
        break
      }

      case "move": {
        const ident = parseIdentifier(args[0])
        if (!ident) break
        const moveName = args[1]
        if (!moveName) break

        const pokemon = resolvePokemon(ident.side, ident.nickname)
        if (pokemon && !pokemon.moves.includes(moveName)) {
          pokemon.moves.push(moveName)
        }
        break
      }

      case "-ability": {
        const ident = parseIdentifier(args[0])
        if (!ident) break

        const pokemon = resolvePokemon(ident.side, ident.nickname)
        if (pokemon && args[1]) pokemon.ability = args[1]
        break
      }

      case "-item": {
        const ident = parseIdentifier(args[0])
        if (!ident) break

        const pokemon = resolvePokemon(ident.side, ident.nickname)
        if (pokemon && args[1]) pokemon.item = args[1]
        break
      }

      case "-enditem": {
        const ident = parseIdentifier(args[0])
        if (!ident) break

        const pokemon = resolvePokemon(ident.side, ident.nickname)
        // Only set item if not already set (first reveal is more reliable)
        if (pokemon && !pokemon.item && args[1]) pokemon.item = args[1]
        break
      }

      case "-terastallize": {
        const ident = parseIdentifier(args[0])
        if (!ident) break

        const pokemon = resolvePokemon(ident.side, ident.nickname)
        if (pokemon && args[1]) pokemon.teraType = args[1]
        break
      }

      case "turn": {
        turnCount = parseInt(args[0], 10) || turnCount
        break
      }

      case "win": {
        if (args[0] === playerNames[0]) winnerId = "p1"
        else if (args[0] === playerNames[1]) winnerId = "p2"
        break
      }

      case "tie": {
        winnerId = "draw"
        break
      }
    }
  }

  return {
    source: "raw-log",
    replayId: null,
    formatId: formatId || DEFAULT_FORMAT_ID,
    gameType,
    playerNames,
    winnerId,
    turnCount,
    protocolLog: log,
    team1: {
      playerName: playerNames[0],
      pokemon: Array.from(teams.p1.values()),
    },
    team2: {
      playerName: playerNames[1],
      pokemon: Array.from(teams.p2.values()),
    },
    uploadTime: null,
    rating: null,
  }
}

/** Import from a Showdown replay URL */
export async function importFromReplayUrl(url: string): Promise<ParsedBattleImport> {
  const replayId = parseReplayUrl(url)
  if (!replayId) {
    throw new Error("Invalid Showdown replay URL")
  }

  const replay = await fetchShowdownReplay(replayId)
  const parsed = parseProtocolLog(replay.log)

  return {
    ...parsed,
    source: "replay-url",
    replayId,
    formatId: replay.formatid || parsed.formatId,
    playerNames: [
      replay.players[0] || parsed.playerNames[0],
      replay.players[1] || parsed.playerNames[1],
    ],
    team1: {
      ...parsed.team1,
      playerName: replay.players[0] || parsed.team1.playerName,
    },
    team2: {
      ...parsed.team2,
      playerName: replay.players[1] || parsed.team2.playerName,
    },
    uploadTime: replay.uploadtime || null,
    rating: replay.rating || null,
  }
}

/** Import from a raw protocol log paste */
export function importFromRawLog(log: string): ParsedBattleImport {
  return parseProtocolLog(log)
}
