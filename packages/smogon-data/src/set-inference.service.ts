import type { SmogonSetData, NatureName, StatsTable } from "@nasty-plot/core"
import { getAllSetsForFormat } from "./smogon-sets.service"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal pokemon data extracted from a replay — matches battle-engine's ExtractedPokemonData. */
export interface ExtractedPokemon {
  speciesId: string
  species: string
  level: number
  moves: string[]
  ability?: string
  item?: string
  teraType?: string
}

/** Minimal team data extracted from a replay — matches battle-engine's ExtractedTeamData. */
export interface ExtractedTeam {
  playerName: string
  pokemon: ExtractedPokemon[]
}

export interface SetMatchScore {
  set: SmogonSetData
  score: number
  matchedMoves: string[]
}

export interface InferredSetResult {
  bestMatch: SetMatchScore | null
  confidence: number
  setName: string | null
  nature: NatureName | null
  evs: Partial<StatsTable> | null
  ivs: Partial<StatsTable> | null
  moves: string[] | null
  ability: string | null
  item: string | null
  teraType: string | null
}

/** Enriched pokemon — original fields plus inferred nature/evs/ivs. */
export type EnrichedPokemon = ExtractedPokemon & {
  nature?: NatureName
  evs?: Partial<StatsTable>
  ivs?: Partial<StatsTable>
}

export interface EnrichedTeam {
  playerName: string
  pokemon: EnrichedPokemon[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalize a name for comparison: lowercase, strip spaces. */
function normalize(name: string): string {
  return name.toLowerCase().replace(/\s/g, "")
}

/**
 * Check if a revealed move exists in a set's move slot (which may be a
 * string or a slash-option array).
 */
function moveSlotContains(slot: string | string[], revealedNorm: string): boolean {
  if (Array.isArray(slot)) {
    return slot.some((opt) => normalize(opt) === revealedNorm)
  }
  return normalize(slot) === revealedNorm
}

// ---------------------------------------------------------------------------
// Core scoring
// ---------------------------------------------------------------------------

/**
 * Score how well extracted replay data matches a candidate Smogon set.
 * Returns 0 if any revealed move is not present in the set.
 */
export function scoreSetMatch(extracted: ExtractedPokemon, set: SmogonSetData): SetMatchScore {
  const matchedMoves: string[] = []

  // All revealed moves must be a subset of the set's moves
  for (const move of extracted.moves) {
    const norm = normalize(move)
    const found = set.moves.some((slot) => moveSlotContains(slot, norm))
    if (!found) {
      return { set, score: 0, matchedMoves: [] }
    }
    matchedMoves.push(move)
  }

  // Weighted scoring — only count fields that were actually revealed
  let score = 0
  let maxScore = 0

  // Ability match (weight 0.3)
  if (extracted.ability) {
    maxScore += 0.3
    if (normalize(extracted.ability) === normalize(set.ability)) {
      score += 0.3
    }
  }

  // Item match (weight 0.3)
  if (extracted.item) {
    maxScore += 0.3
    if (normalize(extracted.item) === normalize(set.item)) {
      score += 0.3
    }
  }

  // Tera type match (weight 0.2)
  if (extracted.teraType && set.teraType) {
    maxScore += 0.2
    if (extracted.teraType.toLowerCase() === set.teraType.toLowerCase()) {
      score += 0.2
    }
  }

  // Move coverage (weight 0.2) — fraction of set's moves that were revealed
  maxScore += 0.2
  if (set.moves.length > 0) {
    score += 0.2 * (matchedMoves.length / set.moves.length)
  }

  // Normalize to 0-1 range based on max possible score
  const normalized = maxScore > 0 ? score / maxScore : 0

  return { set, score: normalized, matchedMoves }
}

// ---------------------------------------------------------------------------
// Move resolution
// ---------------------------------------------------------------------------

/**
 * Produce a concrete 4-move list from a set's moves (which may contain
 * slash options), preferring revealed moves.
 */
export function resolveMoves(revealedMoves: string[], setMoves: (string | string[])[]): string[] {
  const revealedNorms = new Set(revealedMoves.map(normalize))
  const resolved: string[] = []

  for (const slot of setMoves) {
    if (Array.isArray(slot)) {
      // Slash option — pick revealed move if one matches, else first option
      const matchingRevealed = slot.find((opt) => revealedNorms.has(normalize(opt)))
      resolved.push(matchingRevealed ?? slot[0])
    } else {
      resolved.push(slot)
    }
  }

  return resolved
}

// ---------------------------------------------------------------------------
// Inference
// ---------------------------------------------------------------------------

/**
 * Score all candidate sets for a pokemon and return inference result.
 * Pure sync function — revealed data always takes priority.
 */
export function inferFromSets(
  extracted: ExtractedPokemon,
  sets: SmogonSetData[],
): InferredSetResult {
  if (sets.length === 0) {
    return {
      bestMatch: null,
      confidence: 0,
      setName: null,
      nature: null,
      evs: null,
      ivs: null,
      moves: null,
      ability: null,
      item: null,
      teraType: null,
    }
  }

  const scored = sets
    .map((set) => scoreSetMatch(extracted, set))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)

  if (scored.length === 0) {
    return {
      bestMatch: null,
      confidence: 0,
      setName: null,
      nature: null,
      evs: null,
      ivs: null,
      moves: null,
      ability: null,
      item: null,
      teraType: null,
    }
  }

  const best = scored[0]
  const resolvedMoves = resolveMoves(extracted.moves, best.set.moves)

  return {
    bestMatch: best,
    confidence: Math.round(best.score * 100),
    setName: best.set.setName,
    nature: best.set.nature,
    evs: best.set.evs,
    ivs: best.set.ivs ?? null,
    moves: resolvedMoves,
    ability: extracted.ability ?? best.set.ability,
    item: extracted.item ?? best.set.item,
    teraType: extracted.teraType ?? best.set.teraType ?? null,
  }
}

// ---------------------------------------------------------------------------
// Team-level enrichment
// ---------------------------------------------------------------------------

/**
 * Enrich an extracted team by matching each pokemon against Smogon sets.
 * Fetches all sets for the format once, then enriches each pokemon.
 * Revealed data always takes priority over inferred data.
 */
export async function enrichExtractedTeam(
  team: ExtractedTeam,
  formatId: string,
): Promise<EnrichedTeam> {
  const allSets = await getAllSetsForFormat(formatId)

  const enrichedPokemon: EnrichedPokemon[] = team.pokemon.map((pokemon) => {
    const candidateSets = allSets[pokemon.speciesId] ?? []
    const result = inferFromSets(pokemon, candidateSets)

    if (!result.bestMatch) {
      return pokemon
    }

    return {
      ...pokemon,
      moves: result.moves ?? pokemon.moves,
      ability: pokemon.ability ?? result.ability ?? undefined,
      item: pokemon.item ?? result.item ?? undefined,
      teraType: pokemon.teraType ?? result.teraType ?? undefined,
      nature: result.nature ?? undefined,
      evs: result.evs ?? undefined,
      ivs: result.ivs ?? undefined,
    }
  })

  return {
    ...team,
    pokemon: enrichedPokemon,
  }
}
