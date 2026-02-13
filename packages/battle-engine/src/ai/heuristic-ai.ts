import { getRawMove } from "@nasty-plot/pokemon-data"
import type {
  AIPlayer,
  BattleState,
  BattleActionSet,
  BattleAction,
  BattlePokemon,
  PredictedSet,
  DexMove,
} from "../types"
import { getTypeEffectiveness, type PokemonType, type GameType } from "@nasty-plot/core"
import {
  calculateBattleDamage,
  getSpeciesTypes,
  fallbackMove,
  HAZARD_SCORES,
  STATUS_INFLICTION_SCORES,
  SETUP_MOVE_SCORE,
  RECOVERY_SCORES,
  HAZARD_REMOVAL_BASE,
  HAZARD_REMOVAL_PER_HAZARD,
} from "./shared"

/** Matchup score below which HeuristicAI considers switching out. */
const UNFAVORABLE_MATCHUP_THRESHOLD = -0.3

const HAZARD_MOVES = new Set(["stealthrock", "spikes", "toxicspikes", "stickyweb"])
const STATUS_MOVES = new Set(["willowisp", "thunderwave", "toxic", "spore", "sleeppowder", "yawn"])
const SETUP_MOVES = new Set([
  "swordsdance",
  "nastyplot",
  "calmmind",
  "dragondance",
  "irondefense",
  "amnesia",
])
const RECOVERY_MOVES = new Set([
  "recover",
  "roost",
  "softboiled",
  "moonlight",
  "synthesis",
  "shoreup",
  "slackoff",
])
const HAZARD_REMOVAL_MOVES = new Set(["defog", "rapidspin"])

/** Early-game bonus for hazard-setting moves. */
const HAZARD_EARLY_BONUS = 5

/** Maximum layers for each hazard type, and the turn threshold for early-game bonus. */
const HAZARD_LIMITS: Record<
  string,
  { maxLayers: number; earlyTurnCutoff: number; latePenalty: number }
> = {
  stealthrock: { maxLayers: 1, earlyTurnCutoff: 3, latePenalty: 15 },
  spikes: { maxLayers: 3, earlyTurnCutoff: 5, latePenalty: 15 },
  toxicspikes: { maxLayers: 2, earlyTurnCutoff: 4, latePenalty: 13 },
  stickyweb: { maxLayers: 1, earlyTurnCutoff: 2, latePenalty: 15 },
}

/** Sum offensive type advantage for attackerTypes vs defenderTypes. Returns -1 to 1 range. */
function typeOffenseScore(attackerTypes: PokemonType[], defenderTypes: PokemonType[]): number {
  let score = 0
  for (const t of attackerTypes) {
    const eff = getTypeEffectiveness(t, defenderTypes)
    if (eff > 1) score += 0.3
    if (eff < 1) score -= 0.15
  }
  return score
}

/**
 * HeuristicAI uses type matchup awareness, switching logic, and situational
 * status move usage. Significantly smarter than GreedyAI.
 */
export class HeuristicAI implements AIPlayer {
  readonly difficulty = "heuristic" as const

  async chooseAction(state: BattleState, actions: BattleActionSet): Promise<BattleAction> {
    if (actions.forceSwitch) {
      return this.chooseBestSwitch(state, actions)
    }

    const activeSlot = actions.activeSlot ?? 0
    const myActive = state.sides.p2.active[activeSlot]
    const isDoubles = state.format === "doubles"

    // Get opponent actives
    const oppActives = isDoubles
      ? state.sides.p1.active.filter((p): p is NonNullable<typeof p> => p != null && !p.fainted)
      : [state.sides.p1.active[0]].filter((p): p is NonNullable<typeof p> => p != null)

    if (!myActive || oppActives.length === 0) {
      return fallbackMove(actions)
    }

    // Use first opponent active as primary target for matchup/switch evaluation
    const oppActive = oppActives[0]

    // Score each possible action
    const scoredActions: { action: BattleAction; score: number }[] = []

    // Score moves — in doubles, evaluate each move against each target
    for (let i = 0; i < actions.moves.length; i++) {
      const move = actions.moves[i]
      if (move.disabled) continue

      if (isDoubles) {
        // Evaluate move against each opponent active, pick best target
        let bestScore = -Infinity
        let bestTarget = 1 // 1 = left foe (p2a)

        for (let t = 0; t < oppActives.length; t++) {
          const score = this.scoreMove(move, myActive, oppActives[t], state)
          const targetSlot = t + 1 // Foe slots are positive: 1 = p2a, 2 = p2b
          if (score > bestScore) {
            bestScore = score
            bestTarget = targetSlot
          }
        }

        scoredActions.push({
          action: { type: "move", moveIndex: i + 1, targetSlot: bestTarget },
          score: bestScore,
        })
      } else {
        const score = this.scoreMove(move, myActive, oppActive, state)
        scoredActions.push({
          action: { type: "move", moveIndex: i + 1 },
          score,
        })
      }
    }

    // Score switches only if we have a bad matchup
    const matchupScore = this.evaluateMatchup(myActive, oppActive)
    const oppPrediction = state.opponentPredictions?.[oppActive.speciesId]
    if (matchupScore < UNFAVORABLE_MATCHUP_THRESHOLD) {
      for (const sw of actions.switches) {
        if (sw.fainted) continue
        const swPokemon = state.sides.p2.team.find(
          (p) => p.name === sw.name || p.speciesId === sw.speciesId,
        )
        if (!swPokemon) continue

        const switchScore = this.scoreSwitchTarget(swPokemon, oppActive, myActive, oppPrediction)
        scoredActions.push({
          action: { type: "switch", pokemonIndex: sw.index },
          score: switchScore,
        })
      }
    }

    if (scoredActions.length === 0) {
      return fallbackMove(actions)
    }

    // Pick highest scored action, with some randomness among top choices
    scoredActions.sort((a, b) => b.score - a.score)
    const bestScore = scoredActions[0].score
    const topChoices = scoredActions.filter((a) => a.score >= bestScore * 0.85)

    return topChoices[Math.floor(Math.random() * topChoices.length)].action
  }

  chooseLeads(teamSize: number, gameType: GameType): number[] {
    const order = Array.from({ length: teamSize }, (_, i) => i + 1)
    if (gameType !== "doubles") return order

    // For doubles, prioritize Fake Out and speed control users as leads
    // This is a simple heuristic — real VGC lead selection is much more nuanced
    // For now, just return default order since we don't have team data here
    return order
  }

  private scoreMove(
    move: BattleActionSet["moves"][0],
    myPokemon: BattlePokemon,
    oppPokemon: BattlePokemon,
    state: BattleState,
  ): number {
    const moveData = getRawMove(move.name)
    if (!moveData?.exists) return 0

    if (moveData.category === "Status") {
      return this.scoreStatusMove(moveData, myPokemon, oppPokemon, state)
    }

    return this.scoreDamagingMove(moveData, move.name, myPokemon, oppPokemon)
  }

  private scoreDamagingMove(
    moveData: DexMove,
    moveName: string,
    myPokemon: BattlePokemon,
    oppPokemon: BattlePokemon,
  ): number {
    let score = 0

    try {
      const { damage, result } = calculateBattleDamage(myPokemon, oppPokemon, moveName)
      const avgDamage = damage.reduce((a, b) => a + b, 0) / damage.length
      const maxDamage = Math.max(...damage)

      // Base score from damage percentage
      const defMaxHP = result.defender.maxHP()
      const dmgPercent = defMaxHP > 0 ? avgDamage / defMaxHP : 0
      score += dmgPercent * 100

      // Bonus for KO potential
      if (maxDamage >= oppPokemon.hp) {
        score += 50
      }

      // Slight preference for STAB moves
      const myTypes = getSpeciesTypes(myPokemon.name)
      if (myTypes.includes(moveData.type as PokemonType)) {
        score += 5
      }

      // Priority move bonus when opponent is low
      if (moveData.priority > 0 && oppPokemon.hpPercent < 30) {
        score += 20
      }
    } catch {
      // Calc failed, fall back to type effectiveness estimate
      const oppTypes = getSpeciesTypes(oppPokemon.name)
      const eff = getTypeEffectiveness(moveData.type, oppTypes)
      score += eff * 20
    }

    return score
  }

  private scoreStatusMove(
    moveData: DexMove,
    myPokemon: BattlePokemon,
    oppPokemon: BattlePokemon,
    state: BattleState,
  ): number {
    const moveName = moveData.id

    if (HAZARD_MOVES.has(moveName)) {
      return this.scoreHazardMove(moveName, state)
    }

    if (STATUS_MOVES.has(moveName)) {
      return this.scoreStatusInfliction(moveName, oppPokemon)
    }

    if (SETUP_MOVES.has(moveName)) {
      const matchup = this.evaluateMatchup(myPokemon, oppPokemon)
      if (matchup > 0.2 && myPokemon.hpPercent > 70) {
        return SETUP_MOVE_SCORE
      }
      return 0
    }

    if (RECOVERY_MOVES.has(moveName)) {
      if (myPokemon.hpPercent < 50) return RECOVERY_SCORES.low
      if (myPokemon.hpPercent < 75) return RECOVERY_SCORES.moderate
      return 0
    }

    if (HAZARD_REMOVAL_MOVES.has(moveName)) {
      const mySide = state.sides.p2.sideConditions
      const hazardCount =
        (mySide.stealthRock ? 1 : 0) +
        mySide.spikes +
        mySide.toxicSpikes +
        (mySide.stickyWeb ? 1 : 0)
      if (hazardCount > 0) {
        return (
          HAZARD_REMOVAL_BASE + HAZARD_REMOVAL_PER_HAZARD + hazardCount * HAZARD_REMOVAL_PER_HAZARD
        )
      }
      return 0
    }

    // Default: small score for unknown status moves
    return 5
  }

  private scoreHazardMove(moveName: string, state: BattleState): number {
    const oppSide = state.sides.p1.sideConditions
    const base = HAZARD_SCORES[moveName as keyof typeof HAZARD_SCORES] ?? 0
    const limits = HAZARD_LIMITS[moveName]
    if (!limits) return 0

    const currentLayers = this.getHazardLayers(moveName, oppSide)
    if (currentLayers >= limits.maxLayers) return 0

    return state.turn <= limits.earlyTurnCutoff
      ? base + HAZARD_EARLY_BONUS
      : base - limits.latePenalty
  }

  private getHazardLayers(
    moveName: string,
    side: BattleState["sides"]["p1"]["sideConditions"],
  ): number {
    switch (moveName) {
      case "stealthrock":
        return side.stealthRock ? 1 : 0
      case "spikes":
        return side.spikes
      case "toxicspikes":
        return side.toxicSpikes
      case "stickyweb":
        return side.stickyWeb ? 1 : 0
      default:
        return 0
    }
  }

  private scoreStatusInfliction(moveName: string, oppPokemon: BattlePokemon): number {
    if (oppPokemon.status !== "") return 0
    return STATUS_INFLICTION_SCORES[moveName as keyof typeof STATUS_INFLICTION_SCORES] ?? 0
  }

  private evaluateMatchup(myPokemon: BattlePokemon, oppPokemon: BattlePokemon): number {
    const myTypes = getSpeciesTypes(myPokemon.name)
    const oppTypes = getSpeciesTypes(oppPokemon.name)
    return typeOffenseScore(myTypes, oppTypes) - typeOffenseScore(oppTypes, myTypes)
  }

  private scoreSwitchTarget(
    switchTarget: BattlePokemon,
    opponent: BattlePokemon,
    _current: BattlePokemon,
    prediction?: PredictedSet,
  ): number {
    let score = 0

    // Good type matchup against opponent
    const matchup = this.evaluateMatchup(switchTarget, opponent)
    score += matchup * 40

    // Health factor
    score += (switchTarget.hpPercent / 100) * 10

    // Penalty for switching into a bad matchup
    if (matchup < UNFAVORABLE_MATCHUP_THRESHOLD) {
      score -= 30
    }

    // Bonus for resisting the opponent's STAB types
    const oppTypes = getSpeciesTypes(opponent.name)
    const switchTypes = getSpeciesTypes(switchTarget.name)
    for (const t of oppTypes) {
      const eff = getTypeEffectiveness(t, switchTypes)
      if (eff < 1) score += 10
      if (eff === 0) score += 20
    }

    // Penalize switching into predicted coverage moves
    if (prediction && prediction.predictedMoves.length > 0) {
      for (const moveName of prediction.predictedMoves) {
        const moveData = getRawMove(moveName)
        if (!moveData?.exists || moveData.category === "Status") continue
        const eff = getTypeEffectiveness(moveData.type, switchTypes)
        if (eff > 1) {
          score -= 15 * prediction.confidence
        }
      }
    }

    return score
  }

  private chooseBestSwitch(state: BattleState, actions: BattleActionSet): BattleAction {
    const activeSlot = actions.activeSlot ?? 0
    // In doubles, pick the first non-fainted opponent active as reference
    const oppActives = state.sides.p1.active.filter(
      (p): p is NonNullable<typeof p> => p != null && !p.fainted,
    )
    const oppActive = oppActives[0] ?? null
    const available = actions.switches.filter((s) => !s.fainted)

    if (available.length === 0) {
      return { type: "switch", pokemonIndex: actions.switches[0]?.index || 1 }
    }

    if (!oppActive) {
      // No info about opponent, pick healthiest
      const best = available.reduce((a, b) => (a.hp / a.maxHp > b.hp / b.maxHp ? a : b))
      return { type: "switch", pokemonIndex: best.index }
    }

    // Score each switch target
    let bestScore = -Infinity
    let bestIndex = available[0].index
    const oppPrediction = state.opponentPredictions?.[oppActive.speciesId]

    for (const sw of available) {
      const pokemon = state.sides.p2.team.find(
        (p) => p.name === sw.name || p.speciesId === sw.speciesId,
      )
      if (!pokemon) continue

      const myActive = state.sides.p2.active[activeSlot]
      const score = this.scoreSwitchTarget(pokemon, oppActive, myActive || pokemon, oppPrediction)

      if (score > bestScore) {
        bestScore = score
        bestIndex = sw.index
      }
    }

    return { type: "switch", pokemonIndex: bestIndex }
  }
}
