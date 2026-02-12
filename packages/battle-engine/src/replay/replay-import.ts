/**
 * Showdown Replay Import
 *
 * Parses Showdown replay URLs and raw protocol logs to extract
 * battle data for import into the system.
 */

import type { ExtractedPokemonData, ExtractedTeamData } from "@nasty-plot/core"
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

/** Convert a display name to a species ID */
function toSpeciesId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "")
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

  // Track pokemon by side
  const teams: Record<"p1" | "p2", Map<string, ExtractedPokemonData>> = {
    p1: new Map(),
    p2: new Map(),
  }

  // Map nicknames to species for each side
  const nicknameToSpecies: Record<"p1" | "p2", Map<string, string>> = {
    p1: new Map(),
    p2: new Map(),
  }

  for (const line of lines) {
    const parts = line.split("|")
    if (parts.length < 2) continue
    const cmd = parts[1]
    const args = parts.slice(2)

    switch (cmd) {
      case "player": {
        const side = args[0] as "p1" | "p2"
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
          const format = genMatch[2].toLowerCase().replace(/[^a-z0-9]/g, "")
          formatId = `gen${gen}${format}`
        } else {
          formatId = tier.toLowerCase().replace(/[^a-z0-9]/g, "")
        }
        break
      }

      case "poke": {
        // |poke|p1|Garchomp, L100, M|
        const side = args[0] as "p1" | "p2"
        if (side !== "p1" && side !== "p2") break
        const detailParts = (args[1] || "").split(",").map((s) => s.trim())
        const species = detailParts[0]
        let level = 100
        for (let i = 1; i < detailParts.length; i++) {
          if (detailParts[i].startsWith("L")) {
            level = parseInt(detailParts[i].slice(1), 10)
          }
        }
        const speciesId = toSpeciesId(species)
        if (!teams[side].has(speciesId)) {
          teams[side].set(speciesId, {
            speciesId,
            species,
            level,
            moves: [],
          })
        }
        break
      }

      case "switch":
      case "drag":
      case "replace": {
        // |switch|p1a: Garchomp|Garchomp, L100, M|319/319
        const identMatch = args[0]?.match(/^(p[12])[a-d]?:\s*(.+)$/)
        if (!identMatch) break
        const side = identMatch[1] as "p1" | "p2"
        const nickname = identMatch[2].trim()
        const detailParts = (args[1] || "").split(",").map((s) => s.trim())
        const species = detailParts[0]
        const speciesId = toSpeciesId(species)

        // Map nickname → species
        nicknameToSpecies[side].set(nickname, speciesId)

        let level = 100
        for (let i = 1; i < detailParts.length; i++) {
          if (detailParts[i].startsWith("L")) {
            level = parseInt(detailParts[i].slice(1), 10)
          }
        }

        if (!teams[side].has(speciesId)) {
          teams[side].set(speciesId, {
            speciesId,
            species,
            level,
            moves: [],
          })
        }
        const pokemon = teams[side].get(speciesId)!
        if (nickname !== species) {
          pokemon.nickname = nickname
        }
        break
      }

      case "move": {
        // |move|p1a: Garchomp|Earthquake|p2a: Heatran
        const moveIdentMatch = args[0]?.match(/^(p[12])[a-d]?:\s*(.+)$/)
        if (!moveIdentMatch) break
        const side = moveIdentMatch[1] as "p1" | "p2"
        const nickname = moveIdentMatch[2].trim()
        const moveName = args[1]
        if (!moveName) break

        // Resolve nickname to species
        const speciesId = nicknameToSpecies[side].get(nickname)
        if (speciesId) {
          const pokemon = teams[side].get(speciesId)
          if (pokemon && !pokemon.moves.includes(moveName)) {
            pokemon.moves.push(moveName)
          }
        }
        break
      }

      case "-ability": {
        const abilityIdentMatch = args[0]?.match(/^(p[12])[a-d]?:\s*(.+)$/)
        if (!abilityIdentMatch) break
        const side = abilityIdentMatch[1] as "p1" | "p2"
        const nickname = abilityIdentMatch[2].trim()
        const abilityName = args[1]

        const speciesId = nicknameToSpecies[side].get(nickname)
        if (speciesId && abilityName) {
          const pokemon = teams[side].get(speciesId)
          if (pokemon) pokemon.ability = abilityName
        }
        break
      }

      case "-item": {
        const itemIdentMatch = args[0]?.match(/^(p[12])[a-d]?:\s*(.+)$/)
        if (!itemIdentMatch) break
        const side = itemIdentMatch[1] as "p1" | "p2"
        const nickname = itemIdentMatch[2].trim()
        const itemName = args[1]

        const speciesId = nicknameToSpecies[side].get(nickname)
        if (speciesId && itemName) {
          const pokemon = teams[side].get(speciesId)
          if (pokemon) pokemon.item = itemName
        }
        break
      }

      case "-enditem": {
        const endItemIdentMatch = args[0]?.match(/^(p[12])[a-d]?:\s*(.+)$/)
        if (!endItemIdentMatch) break
        const side = endItemIdentMatch[1] as "p1" | "p2"
        const nickname = endItemIdentMatch[2].trim()
        const itemName = args[1]

        const speciesId = nicknameToSpecies[side].get(nickname)
        if (speciesId && itemName) {
          const pokemon = teams[side].get(speciesId)
          // Only set item if not already set (first reveal is more reliable)
          if (pokemon && !pokemon.item) pokemon.item = itemName
        }
        break
      }

      case "-terastallize": {
        const teraIdentMatch = args[0]?.match(/^(p[12])[a-d]?:\s*(.+)$/)
        if (!teraIdentMatch) break
        const side = teraIdentMatch[1] as "p1" | "p2"
        const nickname = teraIdentMatch[2].trim()
        const teraType = args[1]

        const speciesId = nicknameToSpecies[side].get(nickname)
        if (speciesId && teraType) {
          const pokemon = teams[side].get(speciesId)
          if (pokemon) pokemon.teraType = teraType
        }
        break
      }

      case "turn": {
        turnCount = parseInt(args[0], 10) || turnCount
        break
      }

      case "win": {
        const winnerName = args[0]
        if (winnerName === playerNames[0]) {
          winnerId = "p1"
        } else if (winnerName === playerNames[1]) {
          winnerId = "p2"
        }
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
    formatId: formatId || "gen9ou",
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
