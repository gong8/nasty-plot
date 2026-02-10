import type { SmogonSetData } from "@nasty-plot/core";

interface PredictedSet {
  set: SmogonSetData;
  probability: number;
}

export class SetPredictor {
  private predictions: Map<string, PredictedSet[]> = new Map();

  async initialize(
    formatId: string,
    opponentPokemonIds: string[]
  ): Promise<void> {
    for (const pokemonId of opponentPokemonIds) {
      try {
        const res = await fetch(
          `/api/pokemon/${pokemonId}/sets?formatId=${formatId}`
        );
        if (!res.ok) continue;
        const sets: SmogonSetData[] = await res.json();
        if (sets.length === 0) continue;
        const prob = 1 / sets.length;
        this.predictions.set(
          pokemonId,
          sets.map((set) => ({ set, probability: prob }))
        );
      } catch {
        // Failed to fetch, skip
      }
    }
  }

  initializeFromSets(pokemonId: string, sets: SmogonSetData[]): void {
    if (sets.length === 0) return;
    const prob = 1 / sets.length;
    this.predictions.set(
      pokemonId,
      sets.map((set) => ({ set, probability: prob }))
    );
  }

  updateFromObservation(
    pokemonId: string,
    observation: {
      moveUsed?: string;
      itemRevealed?: string;
      abilityRevealed?: string;
    }
  ): void {
    const preds = this.predictions.get(pokemonId);
    if (!preds) return;

    for (const pred of preds) {
      if (observation.moveUsed) {
        const moves = Array.isArray(pred.set.moves)
          ? pred.set.moves.flat()
          : [];
        const hasMove = moves.some(
          (m) =>
            typeof m === "string" &&
            m.toLowerCase().replace(/\s/g, "") ===
              observation.moveUsed!.toLowerCase().replace(/\s/g, "")
        );
        if (!hasMove) pred.probability *= 0.01; // Near-zero but not zero
      }
      if (observation.itemRevealed) {
        if (
          pred.set.item.toLowerCase() !==
          observation.itemRevealed.toLowerCase()
        ) {
          pred.probability *= 0.01;
        }
      }
      if (observation.abilityRevealed) {
        if (
          pred.set.ability.toLowerCase() !==
          observation.abilityRevealed.toLowerCase()
        ) {
          pred.probability *= 0.01;
        }
      }
    }

    // Re-normalize
    const total = preds.reduce((s, p) => s + p.probability, 0);
    if (total > 0) {
      for (const p of preds) p.probability /= total;
    }
  }

  getPrediction(pokemonId: string): PredictedSet[] {
    const preds = this.predictions.get(pokemonId);
    if (!preds) return [];
    return [...preds].sort((a, b) => b.probability - a.probability);
  }

  sampleSet(pokemonId: string): SmogonSetData | null {
    const preds = this.predictions.get(pokemonId);
    if (!preds || preds.length === 0) return null;
    const r = Math.random();
    let cumulative = 0;
    for (const pred of preds) {
      cumulative += pred.probability;
      if (r <= cumulative) return pred.set;
    }
    return preds[preds.length - 1].set;
  }

  hasPredictions(pokemonId: string): boolean {
    return (this.predictions.get(pokemonId)?.length ?? 0) > 0;
  }
}
