import { Battle } from "@pkmn/sim"
import type {
  AIPlayer,
  BattleState,
  BattleActionSet,
  BattleAction,
  BattleFormat,
  PredictedSet,
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
import {
  type MCTSConfig,
  type DUCTNode,
  type ActionStats,
  type MCTSResult,
  DEFAULT_MCTS_CONFIG,
} from "./mcts-types"

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
  private formatId = "gen9ou"
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

  chooseLeads(teamSize: number, _gameType: BattleFormat): number[] {
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
    let bestAction = "default"
    let bestVisits = -1

    const actionScores: MCTSResult["actionScores"] = []

    for (const [action, stats] of myStats) {
      actionScores.push({
        action,
        visits: stats.visits,
        avgValue: stats.avgValue,
      })
      if (stats.visits > bestVisits) {
        bestVisits = stats.visits
        bestAction = action
      }
    }

    actionScores.sort((a, b) => b.visits - a.visits)

    // Estimate win probability from the best action's average value
    const bestStats = myStats.get(bestAction)
    const winProb = bestStats
      ? ((bestStats.avgValue + 1) / 2) * 100 // Map [-1,1] to [0,100]
      : 50

    return {
      bestAction,
      actionScores,
      winProbability: Math.round(winProb * 10) / 10,
      iterations,
      timeMs: Date.now() - startTime,
    }
  }

  /**
   * One MCTS iteration: select → expand → simulate → backpropagate
   */
  private iterate(battle: Battle, node: DUCTNode, perspective: "p1" | "p2"): number {
    if (isBattleOver(battle)) {
      const winner = getBattleWinner(battle)
      if (winner === perspective) return 1
      if (winner === null) return 0
      return -1
    }

    node.visits++

    // Get legal choices for both sides
    const p1Choices = getLegalChoices(battle, "p1")
    const p2Choices = getLegalChoices(battle, "p2")

    if (p1Choices.length === 0 || p2Choices.length === 0) {
      return 0
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
      return 0
    }

    // Rollout from this position
    const value = this.rollout(battle, perspective, this.config.rolloutDepth)

    // Backpropagate
    const p1Stat = node.p1Stats.get(p1Choice)!
    p1Stat.visits++
    p1Stat.totalValue += perspective === "p1" ? value : -value
    p1Stat.avgValue = p1Stat.totalValue / p1Stat.visits

    const p2Stat = node.p2Stats.get(p2Choice)!
    p2Stat.visits++
    p2Stat.totalValue += perspective === "p2" ? value : -value
    p2Stat.avgValue = p2Stat.totalValue / p2Stat.visits

    // Joint stats
    const jointKey = `${p1Choice}|${p2Choice}`
    const joint = node.jointStats.get(jointKey) || { visits: 0, totalValue: 0 }
    joint.visits++
    joint.totalValue += value
    node.jointStats.set(jointKey, joint)

    return value
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
    const C = this.config.explorationConstant
    const logParent = Math.log(parentVisits + 1)

    for (const c of choices) {
      const s = stats.get(c)!
      const exploit = maximize ? s.avgValue : -s.avgValue
      const explore = C * Math.sqrt(logParent / (s.visits + 1))
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
        const winner = getBattleWinner(battle)
        if (winner === perspective) return 1
        if (winner === null) return 0
        return -1
      }

      const p1Choices = getLegalChoices(battle, "p1")
      const p2Choices = getLegalChoices(battle, "p2")

      if (p1Choices.length === 0 || p2Choices.length === 0) break

      const p1 = p1Choices[Math.floor(Math.random() * p1Choices.length)]
      const p2 = this.weightedRolloutChoice(p2Choices, battle)

      try {
        applyChoices(battle, p1, p2)
      } catch {
        break
      }
    }

    // Evaluate leaf position
    if (isBattleOver(battle)) {
      const winner = getBattleWinner(battle)
      if (winner === perspective) return 1
      if (winner === null) return 0
      return -1
    }

    // Use static evaluation
    const state = this.battleToState(battle, perspective)
    if (state) {
      const eval_ = evaluatePosition(state, perspective)
      return eval_.score
    }

    return 0
  }

  /**
   * Convert a @pkmn/sim Battle to a minimal BattleState for the evaluator.
   */
  private battleToState(battle: Battle, _perspective: "p1" | "p2"): BattleState | null {
    try {
      const gameType = battle.gameType === "doubles" ? "doubles" : "singles"
      const makeSide = (side: typeof battle.p1) => {
        const hasTerastallized = side.pokemon.some(
          (p) => !!(p as unknown as { terastallized: string }).terastallized,
        )
        return {
          active: side.active.map((p) => {
            if (!p) return null
            return {
              speciesId: p.species.id,
              name: p.species.name,
              nickname: p.name || p.species.name,
              level: p.level,
              types: p.types.slice() as never[],
              hp: p.hp,
              maxHp: p.maxhp,
              hpPercent: p.maxhp > 0 ? Math.round((p.hp / p.maxhp) * 100) : 0,
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
              boosts: { ...p.boosts, accuracy: 0, evasion: 0 } as never,
              volatiles: Object.keys(p.volatiles),
            }
          }),
          team: side.pokemon.map((p) => ({
            speciesId: p.species.id,
            name: p.species.name,
            nickname: p.name || p.species.name,
            level: p.level,
            types: p.types.slice() as never[],
            hp: p.hp,
            maxHp: p.maxhp,
            hpPercent: p.maxhp > 0 ? Math.round((p.hp / p.maxhp) * 100) : 0,
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
            boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 } as never,
            volatiles: [],
          })),
          name: side.name,
          sideConditions: {
            stealthRock: !!side.sideConditions["stealthrock"],
            spikes: side.sideConditions["spikes"]?.layers || 0,
            toxicSpikes: side.sideConditions["toxicspikes"]?.layers || 0,
            stickyWeb: !!side.sideConditions["stickyweb"],
            reflect: side.sideConditions["reflect"]?.duration || 0,
            lightScreen: side.sideConditions["lightscreen"]?.duration || 0,
            auroraVeil: side.sideConditions["auroraveil"]?.duration || 0,
            tailwind: side.sideConditions["tailwind"]?.duration || 0,
          },
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
   * Choice strings may contain target slots like "move 1 -1".
   */
  private convertChoiceToAction(choice: string, actions: BattleActionSet): BattleAction {
    if (choice.startsWith("move ")) {
      const parts = choice.split(" ")
      const idx = parseInt(parts[1], 10)
      // Parse optional target slot (e.g., "move 1 -1")
      const targetSlot = parts.length > 2 ? parseInt(parts[2], 10) : undefined
      return {
        type: "move",
        moveIndex: idx,
        targetSlot: targetSlot != null && !isNaN(targetSlot) ? targetSlot : undefined,
      }
    }
    if (choice.startsWith("switch ")) {
      const idx = parseInt(choice.split(" ")[1], 10)
      return { type: "switch", pokemonIndex: idx }
    }
    // Default: first available move
    const firstEnabled = actions.moves.findIndex((m) => !m.disabled)
    return { type: "move", moveIndex: (firstEnabled >= 0 ? firstEnabled : 0) + 1 }
  }

  /**
   * Pick a rollout choice for p2, weighting predicted moves 3x higher.
   */
  private weightedRolloutChoice(choices: string[], battle: Battle): string {
    if (choices.length <= 1) return choices[0]

    // Get the active p2 Pokemon's species ID from the battle
    const active = battle.p2?.active?.[0]
    if (!active) return choices[Math.floor(Math.random() * choices.length)]

    const speciesId = active.species?.id
    const prediction = speciesId ? this.predictions[speciesId] : undefined
    if (!prediction || prediction.predictedMoves.length === 0) {
      return choices[Math.floor(Math.random() * choices.length)]
    }

    // Build weights: 3x for moves matching predicted moves, 1x otherwise
    const predictedSet = new Set(
      prediction.predictedMoves.map((m) => m.toLowerCase().replace(/\s/g, "")),
    )
    const weights: number[] = choices.map((choice) => {
      if (!choice.startsWith("move ")) return 1
      // Try to resolve the move index to a move name from the sim
      const moveIdx = parseInt(choice.split(" ")[1], 10) - 1
      const moveSlot = active.moves?.[moveIdx]
      if (moveSlot && predictedSet.has(moveSlot)) {
        return 3
      }
      return 1
    })

    const totalWeight = weights.reduce((a, b) => a + b, 0)
    let r = Math.random() * totalWeight
    for (let i = 0; i < choices.length; i++) {
      r -= weights[i]
      if (r <= 0) return choices[i]
    }
    return choices[choices.length - 1]
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
