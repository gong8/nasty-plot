import { Battle } from "@pkmn/sim"
import { DEFAULT_FORMAT_ID, type GameType } from "@nasty-plot/core"
import {
  calcHpPercent,
  type AIPlayer,
  type BattleState,
  type BattleActionSet,
  type BattleAction,
  type BattlePokemon,
  type PredictedSet,
} from "../types"
import { evaluatePosition } from "./evaluator"
import {
  cloneBattle,
  applyChoices,
  getLegalChoices,
  isBattleOver,
  getBattleWinner,
} from "./battle-cloner"
import { HeuristicAI } from "./heuristic-ai"
import { fallbackMove } from "./shared"
import {
  type MCTSConfig,
  type DUCTNode,
  type ActionStats,
  type MCTSResult,
  DEFAULT_MCTS_CONFIG,
} from "./mcts-types"

const WIN = 1
const LOSS = -1
const DRAW = 0

/** Weight multiplier for predicted moves during rollouts. */
const PREDICTED_MOVE_WEIGHT = 3

const ZERO_BOOSTS = {
  atk: 0,
  def: 0,
  spa: 0,
  spd: 0,
  spe: 0,
  accuracy: 0,
  evasion: 0,
} as never

function randomPick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

function weightedRandomPick<T>(items: T[], weights: number[]): T {
  const totalWeight = weights.reduce((a, b) => a + b, 0)
  let r = Math.random() * totalWeight
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]
    if (r <= 0) return items[i]
  }
  return items[items.length - 1]
}

function outcomeValue(winner: string | null, perspective: "p1" | "p2"): number {
  if (winner === perspective) return WIN
  if (winner === null) return DRAW
  return LOSS
}

/** Map a @pkmn/sim Pokemon to a minimal BattlePokemon for the evaluator. */
function mapSimPokemon(
  p: NonNullable<(typeof Battle.prototype.p1.active)[0]>,
  isActive: boolean,
): BattlePokemon {
  return {
    speciesId: p.species.id,
    name: p.species.name,
    nickname: p.name || p.species.name,
    level: p.level,
    types: p.types.slice() as never[],
    hp: p.hp,
    maxHp: p.maxhp,
    hpPercent: calcHpPercent(p.hp, p.maxhp),
    status: (p.status || "") as never,
    fainted: p.fainted,
    item: p.item || "",
    ability: p.ability || "",
    isTerastallized: false,
    moves: [],
    stats: {
      hp: p.maxhp,
      atk: p.storedStats?.atk || 0,
      def: p.storedStats?.def || 0,
      spa: p.storedStats?.spa || 0,
      spd: p.storedStats?.spd || 0,
      spe: p.storedStats?.spe || 0,
    },
    boosts: isActive ? ({ ...p.boosts, accuracy: 0, evasion: 0 } as never) : ZERO_BOOSTS,
    volatiles: isActive ? Object.keys(p.volatiles) : [],
  } as BattlePokemon
}

function extractSideConditions(sc: Record<string, { layers?: number; duration?: number }>) {
  return {
    stealthRock: !!sc["stealthrock"],
    spikes: sc["spikes"]?.layers || 0,
    toxicSpikes: sc["toxicspikes"]?.layers || 0,
    stickyWeb: !!sc["stickyweb"],
    reflect: sc["reflect"]?.duration || 0,
    lightScreen: sc["lightscreen"]?.duration || 0,
    auroraVeil: sc["auroraveil"]?.duration || 0,
    tailwind: sc["tailwind"]?.duration || 0,
  }
}

/**
 * MCTS AI using Decoupled UCT (DUCT) for simultaneous-move games.
 *
 * In Pokemon, both players choose actions simultaneously each turn,
 * making standard UCT inapplicable. DUCT maintains separate action
 * statistics for each player and uses UCB1 independently.
 *
 * Falls back to HeuristicAI if no Battle reference is available.
 */
export class MCTSAI implements AIPlayer {
  readonly difficulty = "expert" as const
  private config: MCTSConfig
  private battleState: unknown | null = null
  private fallback = new HeuristicAI()
  private formatId = DEFAULT_FORMAT_ID
  private predictions: Record<string, PredictedSet> = {}

  constructor(config?: Partial<MCTSConfig>) {
    this.config = { ...DEFAULT_MCTS_CONFIG, ...config }
  }

  /**
   * Set the serialized battle state (from BattleManager.getSerializedBattle()).
   * Must be called before chooseAction for MCTS to work.
   */
  setBattleState(battleJson: unknown, formatId?: string) {
    this.battleState = battleJson
    if (formatId) this.formatId = formatId
  }

  async chooseAction(state: BattleState, actions: BattleActionSet): Promise<BattleAction> {
    // Store predictions from state for use in rollouts
    this.predictions = state.opponentPredictions ?? {}

    // If no battle state available, fall back to heuristic
    if (!this.battleState) {
      return this.fallback.chooseAction(state, actions)
    }

    try {
      const result = this.runSearch("p2") // AI is always p2
      return this.convertChoiceToAction(result.bestAction, actions)
    } catch (err) {
      console.error("[MCTSAI] Search failed, falling back:", err)
      return this.fallback.chooseAction(state, actions)
    }
  }

  chooseLeads(teamSize: number, _gameType: GameType): number[] {
    // Use default ordering for now; could be improved with search
    return Array.from({ length: teamSize }, (_, i) => i + 1)
  }

  /**
   * Run the MCTS search loop.
   */
  private runSearch(perspective: "p1" | "p2"): MCTSResult {
    const startTime = Date.now()
    const root = this.createNode()

    let battle: Battle
    try {
      battle = Battle.fromJSON(this.battleState as string)
    } catch {
      throw new Error("Failed to deserialize battle state")
    }

    let iterations = 0

    while (
      iterations < this.config.maxIterations &&
      Date.now() - startTime < this.config.maxTimeMs
    ) {
      const cloned = cloneBattle(battle)
      this.iterate(cloned, root, perspective)
      iterations++
    }

    // Select best action by visit count (most robust)
    const myStats = perspective === "p1" ? root.p1Stats : root.p2Stats
    const actionScores: MCTSResult["actionScores"] = Array.from(myStats, ([action, stats]) => ({
      action,
      visits: stats.visits,
      avgValue: stats.avgValue,
    })).sort((a, b) => b.visits - a.visits)

    const bestAction = actionScores[0]?.action ?? "default"

    // Estimate win probability from the best action's average value: map [-1,1] to [0,100]
    const bestAvgValue = myStats.get(bestAction)?.avgValue ?? 0
    const winProbability = Math.round(((bestAvgValue + 1) / 2) * 1000) / 10

    return {
      bestAction,
      actionScores,
      winProbability,
      iterations,
      timeMs: Date.now() - startTime,
    }
  }

  /**
   * One MCTS iteration: select, expand, simulate, backpropagate.
   */
  private iterate(battle: Battle, node: DUCTNode, perspective: "p1" | "p2"): number {
    if (isBattleOver(battle)) {
      return outcomeValue(getBattleWinner(battle), perspective)
    }

    node.visits++

    // Get legal choices for both sides
    const p1Choices = getLegalChoices(battle, "p1")
    const p2Choices = getLegalChoices(battle, "p2")

    if (p1Choices.length === 0 || p2Choices.length === 0) {
      return DRAW
    }

    // Initialize stats for unseen actions
    for (const c of p1Choices) {
      if (!node.p1Stats.has(c)) {
        node.p1Stats.set(c, { visits: 0, totalValue: 0, avgValue: 0 })
      }
    }
    for (const c of p2Choices) {
      if (!node.p2Stats.has(c)) {
        node.p2Stats.set(c, { visits: 0, totalValue: 0, avgValue: 0 })
      }
    }

    // UCB1 selection for each player independently
    const p1Choice = this.selectUCB1(node.p1Stats, p1Choices, node.visits, perspective === "p1")
    const p2Choice = this.selectUCB1(node.p2Stats, p2Choices, node.visits, perspective === "p2")

    // Apply joint action
    try {
      applyChoices(battle, p1Choice, p2Choice)
    } catch {
      return DRAW
    }

    // Rollout from this position
    const value = this.rollout(battle, perspective, this.config.rolloutDepth)

    // Backpropagate
    this.backpropagateStats(node.p1Stats, p1Choice, value, perspective === "p1")
    this.backpropagateStats(node.p2Stats, p2Choice, value, perspective === "p2")

    // Joint stats
    const jointKey = `${p1Choice}|${p2Choice}`
    const joint = node.jointStats.get(jointKey) || { visits: 0, totalValue: 0 }
    joint.visits++
    joint.totalValue += value
    node.jointStats.set(jointKey, joint)

    return value
  }

  private backpropagateStats(
    stats: Map<string, ActionStats>,
    choice: string,
    value: number,
    isOurPerspective: boolean,
  ): void {
    const stat = stats.get(choice)!
    stat.visits++
    stat.totalValue += isOurPerspective ? value : -value
    stat.avgValue = stat.totalValue / stat.visits
  }

  /**
   * UCB1 action selection.
   */
  private selectUCB1(
    stats: Map<string, ActionStats>,
    choices: string[],
    parentVisits: number,
    maximize: boolean,
  ): string {
    // First, play any unvisited action
    for (const c of choices) {
      const s = stats.get(c)
      if (!s || s.visits === 0) return c
    }

    let bestScore = -Infinity
    let bestAction = choices[0]
    const explorationConstant = this.config.explorationConstant
    const logParent = Math.log(parentVisits + 1)

    for (const c of choices) {
      const s = stats.get(c)!
      const exploit = maximize ? s.avgValue : -s.avgValue
      const explore = explorationConstant * Math.sqrt(logParent / (s.visits + 1))
      const ucb = exploit + explore

      if (ucb > bestScore) {
        bestScore = ucb
        bestAction = c
      }
    }

    return bestAction
  }

  /**
   * Random rollout for a fixed number of turns, then evaluate.
   */
  private rollout(battle: Battle, perspective: "p1" | "p2", depth: number): number {
    for (let d = 0; d < depth; d++) {
      if (isBattleOver(battle)) {
        return outcomeValue(getBattleWinner(battle), perspective)
      }

      const p1Choices = getLegalChoices(battle, "p1")
      const p2Choices = getLegalChoices(battle, "p2")

      if (p1Choices.length === 0 || p2Choices.length === 0) break

      const p1 = randomPick(p1Choices)
      const p2 = this.weightedRolloutChoice(p2Choices, battle)

      try {
        applyChoices(battle, p1, p2)
      } catch {
        break
      }
    }

    // Evaluate leaf position
    if (isBattleOver(battle)) {
      return outcomeValue(getBattleWinner(battle), perspective)
    }

    // Use static evaluation
    const state = this.battleToState(battle)
    if (state) {
      return evaluatePosition(state, perspective).score
    }

    return DRAW
  }

  /**
   * Convert a @pkmn/sim Battle to a minimal BattleState for the evaluator.
   */
  private battleToState(battle: Battle): BattleState | null {
    try {
      const gameType = battle.gameType === "doubles" ? "doubles" : "singles"
      const makeSide = (side: typeof battle.p1) => {
        const hasTerastallized = side.pokemon.some(
          (p) => !!(p as unknown as { terastallized: string }).terastallized,
        )
        return {
          active: side.active.map((p) => (p ? mapSimPokemon(p, true) : null)),
          team: side.pokemon.map((p) => mapSimPokemon(p, false)),
          name: side.name,
          sideConditions: extractSideConditions(side.sideConditions),
          canTera: !hasTerastallized,
          hasTerastallized,
        }
      }

      return {
        phase: "battle",
        format: gameType as "singles" | "doubles",
        turn: battle.turn,
        sides: {
          p1: makeSide(battle.p1),
          p2: makeSide(battle.p2),
        },
        field: {
          weather: (battle.field.weather || "") as never,
          weatherTurns: 0,
          terrain: (battle.field.terrain || "") as never,
          terrainTurns: 0,
          trickRoom: battle.field.pseudoWeather["trickroom"] ? 1 : 0,
        },
        winner: null,
        log: [],
        fullLog: [],
        waitingForChoice: false,
        availableActions: null,
        id: "mcts-eval",
      }
    } catch {
      return null
    }
  }

  /**
   * Convert an MCTS choice string back to a BattleAction.
   * Choice strings may contain target slots like "move 1 1" (foe) or "move 1 -2" (ally).
   */
  private convertChoiceToAction(choice: string, actions: BattleActionSet): BattleAction {
    if (choice.startsWith("move ")) {
      const [, moveIndexStr, targetSlotStr] = choice.split(" ")
      const moveIndex = parseInt(moveIndexStr, 10)
      const targetSlot = targetSlotStr != null ? parseInt(targetSlotStr, 10) : undefined
      return {
        type: "move",
        moveIndex,
        targetSlot: targetSlot != null && !isNaN(targetSlot) ? targetSlot : undefined,
      }
    }
    if (choice.startsWith("switch ")) {
      const pokemonIndex = parseInt(choice.split(" ")[1], 10)
      return { type: "switch", pokemonIndex }
    }
    return fallbackMove(actions)
  }

  /**
   * Pick a rollout choice for p2, weighting predicted moves higher.
   */
  private weightedRolloutChoice(choices: string[], battle: Battle): string {
    if (choices.length <= 1) return choices[0]

    const active = battle.p2?.active?.[0]
    const speciesId = active?.species?.id
    const prediction = speciesId ? this.predictions[speciesId] : undefined

    if (!active || !prediction || prediction.predictedMoves.length === 0) {
      return randomPick(choices)
    }

    const predictedMoveIds = new Set(
      prediction.predictedMoves.map((m) => m.toLowerCase().replace(/\s/g, "")),
    )
    const weights = choices.map((choice) => {
      if (!choice.startsWith("move ")) return 1
      const moveIdx = parseInt(choice.split(" ")[1], 10) - 1
      const moveSlot = active.moves?.[moveIdx]
      return moveSlot && predictedMoveIds.has(moveSlot) ? PREDICTED_MOVE_WEIGHT : 1
    })

    return weightedRandomPick(choices, weights)
  }

  private createNode(): DUCTNode {
    return {
      visits: 0,
      p1Stats: new Map(),
      p2Stats: new Map(),
      jointStats: new Map(),
      terminal: false,
    }
  }
}
