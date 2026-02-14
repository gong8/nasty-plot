/**
 * MCTS (Monte Carlo Tree Search) type definitions for Decoupled UCT variant.
 */

export interface MCTSConfig {
  /** Maximum number of iterations (tree expansions). Default: 10000 */
  maxIterations: number
  /** Maximum thinking time in ms. Default: 5000 */
  maxTimeMs: number
  /** UCB1 exploration constant. Default: 0.7 */
  explorationConstant: number
  /** Maximum rollout depth in turns. Default: 4 */
  rolloutDepth: number
  /** Whether to group damage rolls near KO threshold. Default: true */
  damageRollGrouping: boolean
  /** Number of determinizations for hidden info. Default: 4 */
  determinizations: number
}

export const DEFAULT_MCTS_CONFIG: MCTSConfig = {
  maxIterations: 10000,
  maxTimeMs: 5000,
  explorationConstant: 0.7,
  rolloutDepth: 4,
  damageRollGrouping: true,
  determinizations: 4,
}

/**
 * A node in the DUCT (Decoupled UCT) tree.
 * Each node tracks statistics for each player's actions independently.
 */
export interface DUCTNode {
  /** Visit count for this node */
  visits: number
  /** Per-action statistics for p1 */
  p1Stats: Map<string, ActionStats>
  /** Per-action statistics for p2 */
  p2Stats: Map<string, ActionStats>
  /** Joint action statistics: Map<"p1action|p2action", JointStats> */
  jointStats: Map<string, JointStats>
  /** Whether this is a terminal node */
  terminal: boolean
  /** Cached terminal value (1 = p1 wins, -1 = p2 wins, 0 = draw) */
  terminalValue?: number
}

export interface ActionStats {
  /** Number of times this action was selected */
  visits: number
  /** Sum of evaluation values from this action */
  totalValue: number
  /** Average value (totalValue / visits) */
  avgValue: number
}

export interface JointStats {
  visits: number
  totalValue: number
}

export interface MCTSResult {
  /** Best action choice string (e.g. "move 1", "switch 3") */
  bestAction: string
  /** Visit counts per action for display */
  actionScores: { action: string; visits: number; avgValue: number }[]
  /** Estimated win probability from MCTS */
  winProbability: number
  /** Number of iterations completed */
  iterations: number
  /** Time spent in ms */
  timeMs: number
}
