/**
 * Team Matcher Service
 *
 * Fingerprint-based team matching for linking imported battles
 * to existing teams.
 */

import { prisma } from "@nasty-plot/db"
import type { TeamSlotData } from "@nasty-plot/core"
import { parseShowdownPaste } from "@nasty-plot/core"

export interface TeamFingerprint {
  /** Sorted species IDs */
  speciesIds: string[]
  /** Map of speciesId → sorted move names (lowercased) */
  movesBySpecies: Record<string, string[]>
}

export type MatchLevel = "exact" | "pokemon-match" | "none"

export interface TeamMatchResult {
  teamId: string
  teamName: string
  matchLevel: MatchLevel
  confidence: number
}

/** Build a fingerprint from a Showdown paste string */
export function fingerprintFromPaste(paste: string): TeamFingerprint {
  const parsed = parseShowdownPaste(paste)
  const slots = parsed
    .filter((slot) => slot.pokemonId)
    .map((slot) => ({
      speciesId: slot.pokemonId!,
      moves: (slot.moves ?? []).filter(Boolean) as string[],
    }))
  return buildFingerprint(slots)
}

/** Build a fingerprint from TeamSlotData[] */
export function fingerprintFromSlots(slots: TeamSlotData[]): TeamFingerprint {
  return buildFingerprint(
    slots.map((slot) => ({
      speciesId: slot.pokemonId,
      moves: slot.moves.filter(Boolean) as string[],
    })),
  )
}

/** Build a fingerprint from extracted Pokemon data (replays) */
export function fingerprintFromExtracted(
  pokemon: { speciesId: string; moves: string[] }[],
): TeamFingerprint {
  return buildFingerprint(pokemon)
}

function buildFingerprint(pokemon: { speciesId: string; moves: string[] }[]): TeamFingerprint {
  const speciesIds: string[] = []
  const movesBySpecies: Record<string, string[]> = {}

  for (const p of pokemon) {
    speciesIds.push(p.speciesId)
    movesBySpecies[p.speciesId] = p.moves.map((m) => m.toLowerCase()).sort()
  }

  return {
    speciesIds: speciesIds.sort(),
    movesBySpecies,
  }
}

/** Compare two fingerprints */
export function compareFingerprints(a: TeamFingerprint, b: TeamFingerprint): MatchLevel {
  // Check if species sets match
  if (a.speciesIds.length !== b.speciesIds.length) return "none"

  const aSet = new Set(a.speciesIds)
  const bSet = new Set(b.speciesIds)
  for (const id of aSet) {
    if (!bSet.has(id)) return "none"
  }

  // Species match — check moves
  let allMovesMatch = true
  for (const speciesId of a.speciesIds) {
    const aMoves = a.movesBySpecies[speciesId] || []
    const bMoves = b.movesBySpecies[speciesId] || []
    // Exact move lists match
    if (aMoves.length !== bMoves.length || !aMoves.every((m, i) => m === bMoves[i])) {
      allMovesMatch = false
      break
    }
  }

  return allMovesMatch ? "exact" : "pokemon-match"
}

/**
 * Check if extracted moves are a subset of team moves.
 * Replays only reveal moves that were used, so we check subset.
 * Returns a score from 0-1 representing move compatibility.
 */
function moveSubsetScore(
  extractedMoves: Record<string, string[]>,
  teamMoves: Record<string, string[]>,
): number {
  let totalRevealed = 0
  let totalMatched = 0

  for (const [speciesId, revealed] of Object.entries(extractedMoves)) {
    const teamMovesForSpecies = teamMoves[speciesId] || []
    const teamMoveSet = new Set(teamMovesForSpecies)
    for (const move of revealed) {
      totalRevealed++
      if (teamMoveSet.has(move)) totalMatched++
    }
  }

  if (totalRevealed === 0) return 1 // No moves revealed = no penalty
  return totalMatched / totalRevealed
}

function fingerprintFromDbSlots(
  slots: {
    pokemonId: string
    move1: string
    move2: string | null
    move3: string | null
    move4: string | null
  }[],
): TeamFingerprint {
  return buildFingerprint(
    slots.map((slot) => ({
      speciesId: slot.pokemonId,
      moves: [slot.move1, slot.move2, slot.move3, slot.move4].filter(Boolean) as string[],
    })),
  )
}

const SPECIES_MATCH_BASE_CONFIDENCE = 60
const MOVE_MATCH_MAX_BONUS = 40

/**
 * Find teams matching the extracted team data.
 * Returns matches sorted by confidence.
 */
export async function findMatchingTeams(
  extracted: { speciesId: string; moves: string[] }[],
  formatId?: string,
): Promise<TeamMatchResult[]> {
  const where: Record<string, unknown> = { isArchived: false }
  if (formatId) where.formatId = formatId

  const teams = await prisma.team.findMany({
    where,
    include: { slots: { orderBy: { position: "asc" } } },
  })

  const extractedFp = fingerprintFromExtracted(extracted)
  const extractedSpecies = new Set(extractedFp.speciesIds)
  const results: TeamMatchResult[] = []

  for (const team of teams) {
    if (team.slots.length === 0) continue

    const teamFp = fingerprintFromDbSlots(team.slots)

    if (extractedFp.speciesIds.length !== teamFp.speciesIds.length) continue
    if (!teamFp.speciesIds.every((id) => extractedSpecies.has(id))) continue

    const moveScore = moveSubsetScore(extractedFp.movesBySpecies, teamFp.movesBySpecies)
    const confidence = SPECIES_MATCH_BASE_CONFIDENCE + moveScore * MOVE_MATCH_MAX_BONUS

    results.push({
      teamId: team.id,
      teamName: team.name,
      matchLevel: moveScore === 1 ? "exact" : "pokemon-match",
      confidence,
    })
  }

  return results.sort((a, b) => b.confidence - a.confidence)
}
