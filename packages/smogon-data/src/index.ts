export {
  fetchUsageStats,
  getUsageStats,
  getUsageStatsCount,
  getTopPokemon,
  getTeammates,
  getMoveUsage,
  getItemUsage,
  getAbilityUsage,
} from "./usage-stats.service"

export {
  fetchSmogonSets,
  getSetsForPokemon,
  getAllSetsForFormat,
  getNatureUsage,
} from "./smogon-sets.service"

export {
  scoreSetMatch,
  inferFromSets,
  resolveMoves,
  enrichExtractedTeam,
} from "./set-inference.service"
export type {
  ExtractedPokemon,
  ExtractedTeam,
  SetMatchScore,
  InferredSetResult,
  EnrichedPokemon,
  EnrichedTeam,
} from "./set-inference.service"
