import { normalizeMoveName, type SmogonSetData } from "@nasty-plot/core"

/** Near-zero probability for sets that contradict observations */
const MISMATCH_PROBABILITY_FACTOR = 0.01

interface PredictedSet {
  set: SmogonSetData
  probability: number
}

export class SetPredictor {
  private predictions: Map<string, PredictedSet[]> = new Map()

  async initialize(formatId: string, opponentPokemonIds: string[]): Promise<void> {
    for (const pokemonId of opponentPokemonIds) {
      try {
        const res = await fetch(`/api/pokemon/${pokemonId}/sets?formatId=${formatId}`)
        if (!res.ok) continue
        const sets: SmogonSetData[] = await res.json()
        this.initializeFromSets(pokemonId, sets)
      } catch {
        // Failed to fetch, skip
      }
    }
  }

  initializeFromSets(pokemonId: string, sets: SmogonSetData[]): void {
    if (sets.length === 0) return
    const prob = 1 / sets.length
    this.predictions.set(
      pokemonId,
      sets.map((set) => ({ set, probability: prob })),
    )
  }

  updateFromObservation(
    pokemonId: string,
    observation: {
      moveUsed?: string
      itemRevealed?: string
      abilityRevealed?: string
    },
  ): void {
    const preds = this.predictions.get(pokemonId)
    if (!preds) return

    const { moveUsed, itemRevealed, abilityRevealed } = observation
    for (const pred of preds) {
      if (moveUsed && !setContainsMove(pred.set, moveUsed)) {
        pred.probability *= MISMATCH_PROBABILITY_FACTOR
      }
      if (itemRevealed && !matchesIgnoreCase(pred.set.item, itemRevealed)) {
        pred.probability *= MISMATCH_PROBABILITY_FACTOR
      }
      if (abilityRevealed && !matchesIgnoreCase(pred.set.ability, abilityRevealed)) {
        pred.probability *= MISMATCH_PROBABILITY_FACTOR
      }
    }

    // Re-normalize
    const total = preds.reduce((s, p) => s + p.probability, 0)
    if (total > 0) {
      for (const p of preds) p.probability /= total
    }
  }

  getPrediction(pokemonId: string): PredictedSet[] {
    const preds = this.predictions.get(pokemonId)
    if (!preds) return []
    return [...preds].sort((a, b) => b.probability - a.probability)
  }

  sampleSet(pokemonId: string): SmogonSetData | null {
    const preds = this.predictions.get(pokemonId)
    if (!preds || preds.length === 0) return null
    const roll = Math.random()
    let cumulative = 0
    for (const pred of preds) {
      cumulative += pred.probability
      if (roll <= cumulative) return pred.set
    }
    return preds[preds.length - 1].set
  }

  hasPredictions(pokemonId: string): boolean {
    return (this.predictions.get(pokemonId)?.length ?? 0) > 0
  }
}

function matchesIgnoreCase(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase()
}

function setContainsMove(set: SmogonSetData, moveName: string): boolean {
  const moves = Array.isArray(set.moves) ? set.moves.flat() : []
  const normalized = normalizeMoveName(moveName)
  return moves.some((m) => typeof m === "string" && normalizeMoveName(m) === normalized)
}
