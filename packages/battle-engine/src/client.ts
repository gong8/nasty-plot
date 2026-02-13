export * from "./types"

// --- Core Battle Logic (Safe for Client) ---
export { BattleManager, createInitialState } from "./battle-manager.service"
export * from "./team-packer"
export {
  serializeBattleState,
  formatMoveStats,
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

// --- AI & Heuristics ---
export { RandomAI } from "./ai/random-ai"
export { GreedyAI } from "./ai/greedy-ai"
export { HeuristicAI } from "./ai/heuristic-ai"
export { MCTSAI } from "./ai/mcts-ai"
export { SetPredictor } from "./ai/set-predictor"
export { evaluatePosition, type EvalResult, type EvalFeature } from "./ai/evaluator"
export { getEffectiveSpeed, createAI } from "./ai/shared"
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

// --- Replay ---
export { ReplayEngine, type ReplayFrame } from "./replay/replay-engine"
export {
  parseReplayUrl,
  getShowdownReplay,
  parseProtocolLog,
  importFromReplayUrl,
  importFromRawLog,
} from "./replay/replay-import"
export type {
  ExtractedPokemonData,
  ExtractedTeamData,
  ParsedBattleImport,
} from "./replay/replay-import"

// --- Analytics & Export ---
export { formatShowdownLog, formatShowdownReplayJSON } from "./export/battle-export.service"
export type { BattleRecord } from "./export/battle-export.service"
export { computeTeamBattleAnalytics } from "./battle-history.service"
export type { TeamBattleAnalytics } from "./battle-history.service"

// --- Simulation (Safe parts) ---
export { runAutomatedBattle, type SingleBattleResult } from "./simulation/automated-battle-manager"
