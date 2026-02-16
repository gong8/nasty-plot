import { toId } from "@nasty-plot/core"
import type { SetPredictor } from "./ai/set-predictor"
import type { BattleState, PredictedSet } from "./types"

/** Protocol commands that produce observations for the SetPredictor. */
const OBSERVATION_COMMANDS: Record<string, string> = {
  move: "moveUsed",
  "-item": "itemRevealed",
  "-ability": "abilityRevealed",
}

/** Scan protocol lines for p2 observations and update the SetPredictor. */
export function updateSetPredictorFromChunk(predictor: SetPredictor, chunk: string): void {
  for (const line of chunk.split("\n")) {
    const parts = line.split("|")
    if (parts.length < 3) continue

    const observationKey = OBSERVATION_COMMANDS[parts[1]]
    if (!observationKey || !parts[3]) continue

    const ident = parts[2] || ""
    if (!ident.startsWith("p2")) continue

    const pokemonName = ident.replace(/^p2[a-d]?:\s*/, "").trim()
    predictor.updateFromObservation(toId(pokemonName), { [observationKey]: parts[3] })
  }
}

/** Build opponentPredictions on state from the SetPredictor's current beliefs. */
export function populatePredictions(predictor: SetPredictor, state: BattleState): void {
  const predictions: Record<string, PredictedSet> = {}
  for (const pokemon of state.sides.p2.team) {
    const preds = predictor.getPrediction(pokemon.pokemonId)
    if (preds.length === 0) continue

    // Use the most likely prediction
    const top = preds[0]
    const moves = Array.isArray(top.set.moves)
      ? top.set.moves.flat().filter((m): m is string => typeof m === "string")
      : []

    predictions[pokemon.pokemonId] = {
      pokemonId: pokemon.pokemonId,
      predictedMoves: moves,
      predictedItem: top.set.item || undefined,
      predictedAbility: top.set.ability || undefined,
      confidence: top.probability,
    }
  }
  state.opponentPredictions = predictions
}
