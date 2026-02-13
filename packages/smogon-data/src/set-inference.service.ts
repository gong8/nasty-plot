import type {
  SmogonSetData,
  NatureName,
  StatsTable,
  ExtractedPokemonData,
  ExtractedTeamData,
} from "@nasty-plot/core"
import { getFormatFallbacks } from "@nasty-plot/formats"
import { getAllSetsForFormat } from "./smogon-sets.service"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** @deprecated Use ExtractedPokemonData from @nasty-plot/core */
export type ExtractedPokemon = ExtractedPokemonData

/** @deprecated Use ExtractedTeamData from @nasty-plot/core */
export type ExtractedTeam = ExtractedTeamData

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
 * Find the best matching format that has sets.
 * Tries the format itself, then falls back to related formats (e.g. earlier VGC years).
 * Returns sets from the *single* best match.
 */
async function resolveFormatWithSets(
  formatId: string,
): Promise<{ resolvedFormat: string; sets: Record<string, SmogonSetData[]> }> {
  const fallbacks = getFormatFallbacks(formatId)

  for (const candidate of fallbacks) {
    const sets = await getAllSetsForFormat(candidate)
    if (Object.keys(sets).length > 0) {
      return { resolvedFormat: candidate, sets }
    }
  }

  return { resolvedFormat: formatId, sets: {} }
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

const SCORE_WEIGHT_ABILITY = 0.3
const SCORE_WEIGHT_ITEM = 0.3
const SCORE_WEIGHT_TERA = 0.2
const SCORE_WEIGHT_MOVES = 0.2
const BASE_SCORE_NO_DATA = 0.1

/**
 * Score how well extracted replay data matches a candidate Smogon set.
 * Unmatched moves heavily penalize (but don't fully disqualify) a set,
 * so limited/outdated data can still provide partial inference.
 */
export function scoreSetMatch(extracted: ExtractedPokemon, set: SmogonSetData): SetMatchScore {
  const matchedMoves: string[] = []
  let unmatchedMoves = 0

  for (const move of extracted.moves) {
    const norm = normalize(move)
    if (set.moves.some((slot) => moveSlotContains(slot, norm))) {
      matchedMoves.push(move)
    } else {
      unmatchedMoves++
    }
  }

  if (unmatchedMoves > 0) {
    return { set, score: 0, matchedMoves }
  }

  let score = 0
  let maxScore = 0

  if (extracted.ability) {
    maxScore += SCORE_WEIGHT_ABILITY
    if (normalize(extracted.ability) === normalize(set.ability)) {
      score += SCORE_WEIGHT_ABILITY
    }
  }

  if (extracted.item) {
    maxScore += SCORE_WEIGHT_ITEM
    if (normalize(extracted.item) === normalize(set.item)) {
      score += SCORE_WEIGHT_ITEM
    }
  }

  if (extracted.teraType && set.teraType) {
    maxScore += SCORE_WEIGHT_TERA
    if (extracted.teraType.toLowerCase() === set.teraType.toLowerCase()) {
      score += SCORE_WEIGHT_TERA
    }
  }

  if (extracted.moves.length > 0) {
    maxScore += SCORE_WEIGHT_MOVES
    if (set.moves.length > 0) {
      score += SCORE_WEIGHT_MOVES * (matchedMoves.length / set.moves.length)
    }
  }

  const normalized = maxScore > 0 ? score / maxScore : BASE_SCORE_NO_DATA
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
  const usedNorms = new Set<string>()

  for (const slot of setMoves) {
    if (Array.isArray(slot)) {
      // Slash option — pick revealed move if one matches and isn't already used
      const matchingRevealed = slot.find(
        (opt) => revealedNorms.has(normalize(opt)) && !usedNorms.has(normalize(opt)),
      )
      // Fall back to first non-duplicate option
      const pick = matchingRevealed ?? slot.find((opt) => !usedNorms.has(normalize(opt))) ?? slot[0]
      resolved.push(pick)
      usedNorms.add(normalize(pick))
    } else {
      resolved.push(slot)
      usedNorms.add(normalize(slot))
    }
  }

  return resolved
}

// ---------------------------------------------------------------------------
// Inference
// ---------------------------------------------------------------------------

const EMPTY_INFERENCE: InferredSetResult = {
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

/**
 * Score all candidate sets for a pokemon and return inference result.
 * Pure sync function — revealed data always takes priority.
 */
export function inferFromSets(
  extracted: ExtractedPokemon,
  sets: SmogonSetData[],
): InferredSetResult {
  if (sets.length === 0) return EMPTY_INFERENCE

  const scored = sets
    .map((set) => scoreSetMatch(extracted, set))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)

  if (scored.length === 0) return EMPTY_INFERENCE

  const best = scored[0]
  return {
    bestMatch: best,
    confidence: Math.round(best.score * 100),
    setName: best.set.setName,
    nature: best.set.nature,
    evs: best.set.evs,
    ivs: best.set.ivs ?? null,
    moves: resolveMoves(extracted.moves, best.set.moves),
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
  const { sets: allSets } = await resolveFormatWithSets(formatId)

  const enrichedPokemon: EnrichedPokemon[] = team.pokemon.map((pokemon) => {
    const candidateSets = allSets[pokemon.pokemonId] ?? []
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
