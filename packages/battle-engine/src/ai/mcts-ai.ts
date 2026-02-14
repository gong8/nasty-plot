import { Battle } from "@pkmn/sim"
import { DEFAULT_FORMAT_ID, normalizeMoveName, type GameType } from "@nasty-plot/core"
import {
  calcHpPercent,
  type AIPlayer,
  type BattleState,
  type BattleActionSet,
  type BattleAction,
  type BattlePokemon,
  type PredictedSet,
} from "../types"
import { evaluatePosition } from "./evaluator.service"
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

function initActionStats(stats: Map<string, ActionStats>, choices: string[]): void {
  for (const c of choices) {
    if (!stats.has(c)) {
      stats.set(c, { visits: 0, totalValue: 0, avgValue: 0 })
    }
  }
}

function mapSimPokemon(
  p: NonNullable<(typeof Battle.prototype.p1.active)[0]>,
  isActive: boolean,
): BattlePokemon {
  const stored = p.storedStats
  return {
    pokemonId: p.species.id,
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
      atk: stored?.atk || 0,
      def: stored?.def || 0,
      spa: stored?.spa || 0,
      spd: stored?.spd || 0,
      spe: stored?.spe || 0,
    },
    boosts: isActive ? ({ ...p.boosts, accuracy: 0, evasion: 0 } as never) : ZERO_BOOSTS,
    volatiles: isActive ? Object.keys(p.volatiles) : [],
  } as BattlePokemon
}

function mapSimSide(side: typeof Battle.prototype.p1) {
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

function extractSideConditions(sc: Record<string, { layers?: number; duration?: number }>) {
  const layers = (key: string) => sc[key]?.layers ?? 0
  const duration = (key: string) => sc[key]?.duration ?? 0
  return {
    stealthRock: !!sc["stealthrock"],
    spikes: layers("spikes"),
    toxicSpikes: layers("toxicspikes"),
    stickyWeb: !!sc["stickyweb"],
    reflect: duration("reflect"),
    lightScreen: duration("lightscreen"),
    auroraVeil: duration("auroraveil"),
    tailwind: duration("tailwind"),
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
    this.predictions = state.opponentPredictions ?? {}

    if (!this.battleState) {
      return this.fallback.chooseAction(state, actions)
    }

    try {
      const result = this.runSearch("p2")
      return this.convertChoiceToAction(result.bestAction, actions)
    } catch (err) {
      console.error("[MCTSAI] Search failed, falling back:", err)
      return this.fallback.chooseAction(state, actions)
    }
  }

  chooseLeads(teamSize: number, _gameType: GameType): number[] {
    return Array.from({ length: teamSize }, (_, i) => i + 1)
  }

  private runSearch(perspective: "p1" | "p2"): MCTSResult {
    const startTime = Date.now()
    const root = this.createNode()
    const battle = Battle.fromJSON(this.battleState as string)
    const { maxIterations, maxTimeMs } = this.config

    let iterations = 0
    while (iterations < maxIterations && Date.now() - startTime < maxTimeMs) {
      this.iterate(cloneBattle(battle), root, perspective)
      iterations++
    }

    return this.buildResult(root, perspective, iterations, Date.now() - startTime)
  }

  private buildResult(
    root: DUCTNode,
    perspective: "p1" | "p2",
    iterations: number,
    timeMs: number,
  ): MCTSResult {
    const myStats = perspective === "p1" ? root.p1Stats : root.p2Stats
    const actionScores = Array.from(myStats, ([action, stats]) => ({
      action,
      visits: stats.visits,
      avgValue: stats.avgValue,
    })).sort((a, b) => b.visits - a.visits)

    const bestAction = actionScores[0]?.action ?? "default"
    const bestAvgValue = myStats.get(bestAction)?.avgValue ?? 0
    const winProbability = Math.round(((bestAvgValue + 1) / 2) * 1000) / 10

    return { bestAction, actionScores, winProbability, iterations, timeMs }
  }

  private iterate(battle: Battle, node: DUCTNode, perspective: "p1" | "p2"): number {
    if (isBattleOver(battle)) {
      return outcomeValue(getBattleWinner(battle), perspective)
    }

    node.visits++

    const p1Choices = getLegalChoices(battle, "p1")
    const p2Choices = getLegalChoices(battle, "p2")
    if (p1Choices.length === 0 || p2Choices.length === 0) return DRAW

    initActionStats(node.p1Stats, p1Choices)
    initActionStats(node.p2Stats, p2Choices)

    const p1Choice = this.selectUCB1(node.p1Stats, p1Choices, node.visits, perspective === "p1")
    const p2Choice = this.selectUCB1(node.p2Stats, p2Choices, node.visits, perspective === "p2")

    try {
      applyChoices(battle, p1Choice, p2Choice)
    } catch {
      return DRAW
    }

    const value = this.rollout(battle, perspective, this.config.rolloutDepth)

    this.backpropagateStats(node.p1Stats, p1Choice, value, perspective === "p1")
    this.backpropagateStats(node.p2Stats, p2Choice, value, perspective === "p2")
    this.updateJointStats(node.jointStats, p1Choice, p2Choice, value)

    return value
  }

  private updateJointStats(
    jointStats: Map<string, { visits: number; totalValue: number }>,
    p1Choice: string,
    p2Choice: string,
    value: number,
  ): void {
    const key = `${p1Choice}|${p2Choice}`
    const joint = jointStats.get(key) || { visits: 0, totalValue: 0 }
    joint.visits++
    joint.totalValue += value
    jointStats.set(key, joint)
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

  private selectUCB1(
    stats: Map<string, ActionStats>,
    choices: string[],
    parentVisits: number,
    maximize: boolean,
  ): string {
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

  private rollout(battle: Battle, perspective: "p1" | "p2", depth: number): number {
    for (let d = 0; d < depth; d++) {
      if (isBattleOver(battle)) {
        return outcomeValue(getBattleWinner(battle), perspective)
      }

      const p1Choices = getLegalChoices(battle, "p1")
      const p2Choices = getLegalChoices(battle, "p2")
      if (p1Choices.length === 0 || p2Choices.length === 0) break

      try {
        applyChoices(battle, randomPick(p1Choices), this.weightedRolloutChoice(p2Choices, battle))
      } catch {
        break
      }
    }

    if (isBattleOver(battle)) {
      return outcomeValue(getBattleWinner(battle), perspective)
    }

    const state = this.battleToState(battle)
    return state ? evaluatePosition(state, perspective).score : DRAW
  }

  private battleToState(battle: Battle): BattleState | null {
    try {
      return {
        phase: "battle",
        gameType: battle.gameType === "doubles" ? "doubles" : "singles",
        turn: battle.turn,
        sides: {
          p1: mapSimSide(battle.p1),
          p2: mapSimSide(battle.p2),
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

  private convertChoiceToAction(choice: string, actions: BattleActionSet): BattleAction {
    const [command, rawIndex, rawTarget] = choice.split(" ")
    const index = parseInt(rawIndex, 10)

    if (isNaN(index)) return fallbackMove(actions)

    if (command === "move") {
      const targetSlot = rawTarget != null ? parseInt(rawTarget, 10) : NaN
      return {
        type: "move",
        moveIndex: index,
        targetSlot: !isNaN(targetSlot) ? targetSlot : undefined,
      }
    }

    if (command === "switch") {
      return { type: "switch", pokemonIndex: index }
    }

    return fallbackMove(actions)
  }

  private weightedRolloutChoice(choices: string[], battle: Battle): string {
    if (choices.length <= 1) return choices[0]

    const active = battle.p2?.active?.[0]
    const pokemonId = active?.species?.id
    const prediction = pokemonId ? this.predictions[pokemonId] : undefined

    if (!active || !prediction || prediction.predictedMoves.length === 0) {
      return randomPick(choices)
    }

    const predictedMoveIds = new Set(prediction.predictedMoves.map((m) => normalizeMoveName(m)))
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
