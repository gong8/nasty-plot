export * from "./types"
export * from "./battle-manager"
export {
  serializeBattleState,
  formatBoosts,
  formatFieldState,
  formatSideConditions,
} from "./battle-state-serializer"
export {
  processLine,
  processChunk,
  parseRequest,
  parseRequestForSlot,
  updateSideFromRequest,
} from "./protocol-parser"
export * from "./team-packer"
export { RandomAI } from "./ai/random-ai"
export { GreedyAI } from "./ai/greedy-ai"
export { HeuristicAI } from "./ai/heuristic-ai"
export { MCTSAI } from "./ai/mcts-ai"
export { SetPredictor } from "./ai/set-predictor"
export { evaluatePosition, type EvalResult, type EvalFeature } from "./ai/evaluator"
export { getEffectiveSpeed } from "./ai/shared"
export {
  estimateWinProbability,
  winProbabilityDelta,
  type WinProbability,
} from "./ai/win-probability"
export {
  generateHints,
  type HintResult,
  type MoveHint,
  type MoveClassification,
} from "./ai/hint-engine"
export { cloneBattle, getLegalChoices, isBattleOver, getBattleWinner } from "./ai/battle-cloner"
export { type MCTSConfig, type MCTSResult, DEFAULT_MCTS_CONFIG } from "./ai/mcts-types"
export { ReplayEngine, type ReplayFrame } from "./replay/replay-engine"
export {
  parseReplayUrl,
  fetchShowdownReplay,
  parseProtocolLog,
  importFromReplayUrl,
  importFromRawLog,
} from "./replay/replay-import"
export type {
  ShowdownReplayJson,
  ExtractedPokemonData,
  ExtractedTeamData,
  ParsedBattleImport,
} from "./replay/replay-import"
export { formatShowdownLog, formatShowdownReplayJSON } from "./export/battle-export.service"
export type { BattleRecord } from "./export/battle-export.service"
export { computeTeamBattleAnalytics } from "./battle-history.service"
export type { TeamBattleAnalytics } from "./battle-history.service"
export {
  listBattles,
  createBattle,
  getBattle,
  deleteBattle,
  getBattleReplay,
  getBattleForExport,
  getBattleCommentary,
  updateBattleCommentary,
  createBatchSimulation,
  getBatchSimulation,
  deleteBatchSimulation,
  updateBatchProgress,
  completeBatchSimulation,
  failBatchSimulation,
  getTeamBattleStats,
} from "./battle.service"
export type { ListBattlesOptions, CreateBattleData, CreateBatchData } from "./battle.service"
export { runAutomatedBattle, type SingleBattleResult } from "./simulation/automated-battle-manager"
export {
  runBatchSimulation,
  type BatchSimConfig,
  type BatchAnalytics,
  type BatchSimProgress,
  type PokemonStats,
} from "./simulation/batch-simulator"
