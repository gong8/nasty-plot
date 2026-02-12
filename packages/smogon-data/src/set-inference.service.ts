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
 * Build a prioritized list of format IDs to try for set lookup.
 * Handles VGC regulation suffixes (e.g. gen9vgc2026regfbo3 → gen9vgc2025 → gen9doublesou)
 * and other format variations.
 */
function buildFormatFallbacks(formatId: string): string[] {
  const candidates = [formatId]
  const lower = formatId.toLowerCase()

  // Strip bo3/bo5 suffix
  const stripped1 = lower.replace(/bo\d+$/, "")
  if (stripped1 !== lower) candidates.push(stripped1)

  // Strip regulation suffix (regf, regg, etc.)
  const stripped2 = stripped1.replace(/reg[a-z]$/, "")
  if (stripped2 !== stripped1) candidates.push(stripped2)

  // For VGC: try previous years
  const vgcMatch = stripped2.match(/^(gen\d+vgc)(\d{4})$/)
  if (vgcMatch) {
    const base = vgcMatch[1]
    const year = parseInt(vgcMatch[2], 10)
    for (let y = year - 1; y >= year - 3; y--) {
      candidates.push(`${base}${y}`)
    }
  }

  // Game type fallbacks
  if (
    lower.includes("vgc") ||
    lower.includes("doubles") ||
    lower.includes("battlestadiumdoubles")
  ) {
    candidates.push("gen9doublesou", "gen9battlestadiumdoubles")
  } else if (lower.includes("nationaldex")) {
    candidates.push("gen9nationaldex")
  } else {
    // Singles fallback
    candidates.push("gen9ou")
  }

  // Deduplicate while preserving order
  return [...new Set(candidates)]
}

/**
 * Find the best matching format that has sets.
 * Tries the format itself, then falls back to related formats (e.g. earlier VGC years).
 * Returns sets from the *single* best match.
 */
async function resolveFormatWithSets(
  formatId: string,
): Promise<{ resolvedFormat: string; sets: Record<string, SmogonSetData[]> }> {
  const fallbacks = buildFormatFallbacks(formatId)

  for (const candidate of fallbacks) {
    const sets = await getAllSetsForFormat(candidate)
    if (Object.keys(sets).length > 0) {
      return { resolvedFormat: candidate, sets }
    }
  }

  // No sets found in any fallback
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
    const found = set.moves.some((slot) => moveSlotContains(slot, norm))
    if (found) {
      matchedMoves.push(move)
    } else {
      unmatchedMoves++
    }
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

  // Move coverage (weight 0.2) — only counts when moves were actually revealed
  if (extracted.moves.length > 0) {
    maxScore += 0.2
    if (set.moves.length > 0) {
      score += 0.2 * (matchedMoves.length / set.moves.length)
    }
  }

  // Heavy penalty for unmatched moves — if any move is not found, the set is disqualified
  // This strictness is appropriate now that we have accurate generation-specific data
  if (unmatchedMoves > 0) {
    return { set, score: 0, matchedMoves }
  }

  // When nothing is revealed, the species match alone gives a low base score
  // so the first (most popular) set is still selected
  const normalized = maxScore > 0 ? score / maxScore : 0.1

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
  const { sets: allSets } = await resolveFormatWithSets(formatId)

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
