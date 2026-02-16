export * from "./types"
export * from "./battle-manager.service"
export {
  actionToChoice,
  buildPartialDoublesChoice,
  escapeTeam,
  pasteToPackedTeam,
} from "./battle-utils"
export { updateSetPredictorFromChunk, populatePredictions } from "./set-prediction.service"
export { parseProtocolFromChunk, processDeduplicatedProtocol } from "./protocol-handler"
export {
  serializeBattleState,
  formatMoveStats,
  formatBoosts,
  formatFieldState,
  formatSideConditions,
} from "./battle-state-serializer.service"
export {
  processLine,
  processChunk,
  parseRequest,
  parseRequestForSlot,
  updateSideFromRequest,
} from "./protocol-parser.service"
export * from "./team-packer.service"
export { RandomAI } from "./ai/random-ai"
export { GreedyAI } from "./ai/greedy-ai"
export { HeuristicAI } from "./ai/heuristic-ai"
export { MCTSAI } from "./ai/mcts-ai"
export { SetPredictor } from "./ai/set-predictor"
export { evaluatePosition } from "./ai/evaluator.service"
export { getEffectiveSpeed } from "./ai/shared"
export {
  estimateWinProbability,
  winProbabilityDelta,
  type WinProbability,
} from "./ai/win-probability.service"
export {
  generateHints,
  type HintResult,
  type MoveHint,
  type MoveClassification,
} from "./ai/hint-engine.service"
export { cloneBattle, getLegalChoices, isBattleOver, getBattleWinner } from "./ai/battle-cloner"
export { type MCTSResult, DEFAULT_MCTS_CONFIG } from "./ai/mcts-types"
export { ReplayEngine, type ReplayFrame } from "./replay/replay-engine"
export {
  parseReplayUrl,
  getShowdownReplay,
  parseProtocolLog,
  importFromReplayUrl,
  importFromRawLog,
} from "./replay/replay-import"
export type { ExtractedPokemonData, ExtractedTeamData } from "./replay/replay-import"
export { formatShowdownLog, formatShowdownReplayJSON } from "./export/battle-export.service"
export type { BattleRecord } from "./export/battle-export.service"
export { computeTeamBattleAnalytics } from "./battle-history.service"
export type { TeamBattleAnalytics } from "./battle-history.service"
export { runAutomatedBattle, type SingleBattleResult } from "./simulation/automated-battle-manager"
export {
  runBatchSimulation,
  type BatchSimConfig,
  type BatchAnalytics,
  type BatchSimProgress,
} from "./simulation/batch-simulator"
