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
  pickHealthiestSwitch,
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

function findTeamPokemon(
  team: BattlePokemon[],
  sw: { name: string; pokemonId?: string },
): BattlePokemon | undefined {
  return team.find((p) => p.name === sw.name || p.pokemonId === sw.pokemonId)
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
    if (actions.forceSwitch) return this.chooseBestSwitch(state, actions)

    const myActive = state.sides.p2.active[actions.activeSlot ?? 0]
    const isDoubles = state.gameType === "doubles"
    const oppActives = isDoubles
      ? state.sides.p1.active.filter((p): p is NonNullable<typeof p> => p != null && !p.fainted)
      : [state.sides.p1.active[0]].filter((p): p is NonNullable<typeof p> => p != null)

    if (!myActive || oppActives.length === 0) return fallbackMove(actions)

    const primaryOpponent = oppActives[0]
    const scoredActions: { action: BattleAction; score: number }[] = []

    for (let i = 0; i < actions.moves.length; i++) {
      const move = actions.moves[i]
      if (move.disabled) continue

      if (isDoubles) {
        let bestScore = -Infinity
        let bestTarget = 1

        for (let t = 0; t < oppActives.length; t++) {
          const score = this.scoreMove(move, myActive, oppActives[t], state)
          if (score > bestScore) {
            bestScore = score
            bestTarget = t + 1
          }
        }

        scoredActions.push({
          action: { type: "move", moveIndex: i + 1, targetSlot: bestTarget },
          score: bestScore,
        })
      } else {
        scoredActions.push({
          action: { type: "move", moveIndex: i + 1 },
          score: this.scoreMove(move, myActive, primaryOpponent, state),
        })
      }
    }

    const matchupScore = this.evaluateMatchup(myActive, primaryOpponent)
    if (matchupScore < UNFAVORABLE_MATCHUP_THRESHOLD) {
      const oppPrediction = state.opponentPredictions?.[primaryOpponent.pokemonId]
      for (const sw of actions.switches) {
        if (sw.fainted) continue
        const swPokemon = findTeamPokemon(state.sides.p2.team, sw)
        if (!swPokemon) continue

        scoredActions.push({
          action: { type: "switch", pokemonIndex: sw.index },
          score: this.scoreSwitchTarget(swPokemon, primaryOpponent, myActive, oppPrediction),
        })
      }
    }

    if (scoredActions.length === 0) return fallbackMove(actions)

    scoredActions.sort((a, b) => b.score - a.score)
    const topChoices = scoredActions.filter((a) => a.score >= scoredActions[0].score * 0.85)
    return topChoices[Math.floor(Math.random() * topChoices.length)].action
  }

  chooseLeads(teamSize: number, _gameType: GameType): number[] {
    return Array.from({ length: teamSize }, (_, i) => i + 1)
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
      const { minPercent, maxPercent } = calculateBattleDamage(myPokemon, oppPokemon, moveName)
      score += (minPercent + maxPercent) / 2

      if (maxPercent >= oppPokemon.hpPercent) score += 50

      const myTypes = getSpeciesTypes(myPokemon.name)
      if (myTypes.includes(moveData.type as PokemonType)) score += 5

      if (moveData.priority > 0 && oppPokemon.hpPercent < 30) score += 20
    } catch {
      const oppTypes = getSpeciesTypes(oppPokemon.name)
      score += getTypeEffectiveness(moveData.type as PokemonType, oppTypes) * 20
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

    if (HAZARD_MOVES.has(moveName)) return this.scoreHazardMove(moveName, state)
    if (STATUS_MOVES.has(moveName)) return this.scoreStatusInfliction(moveName, oppPokemon)

    if (SETUP_MOVES.has(moveName)) {
      const matchup = this.evaluateMatchup(myPokemon, oppPokemon)
      return matchup > 0.2 && myPokemon.hpPercent > 70 ? SETUP_MOVE_SCORE : 0
    }

    if (RECOVERY_MOVES.has(moveName)) {
      if (myPokemon.hpPercent < 50) return RECOVERY_SCORES.low
      if (myPokemon.hpPercent < 75) return RECOVERY_SCORES.moderate
      return 0
    }

    if (HAZARD_REMOVAL_MOVES.has(moveName)) return this.scoreHazardRemoval(state)

    return 5
  }

  private scoreHazardRemoval(state: BattleState): number {
    const mySide = state.sides.p2.sideConditions
    const hazardCount =
      (mySide.stealthRock ? 1 : 0) + mySide.spikes + mySide.toxicSpikes + (mySide.stickyWeb ? 1 : 0)
    if (hazardCount === 0) return 0
    return HAZARD_REMOVAL_BASE + HAZARD_REMOVAL_PER_HAZARD + hazardCount * HAZARD_REMOVAL_PER_HAZARD
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
    const matchup = this.evaluateMatchup(switchTarget, opponent)
    let score = matchup * 40 + (switchTarget.hpPercent / 100) * 10

    if (matchup < UNFAVORABLE_MATCHUP_THRESHOLD) score -= 30

    const oppTypes = getSpeciesTypes(opponent.name)
    const switchTypes = getSpeciesTypes(switchTarget.name)
    for (const t of oppTypes) {
      const eff = getTypeEffectiveness(t, switchTypes)
      if (eff < 1) score += 10
      if (eff === 0) score += 20
    }

    if (prediction?.predictedMoves.length) {
      for (const moveName of prediction.predictedMoves) {
        const moveData = getRawMove(moveName)
        if (!moveData?.exists || moveData.category === "Status") continue
        const eff = getTypeEffectiveness(moveData.type as PokemonType, switchTypes)
        if (eff > 1) score -= 15 * prediction.confidence
      }
    }

    return score
  }

  private chooseBestSwitch(state: BattleState, actions: BattleActionSet): BattleAction {
    const available = actions.switches.filter((s) => !s.fainted)
    if (available.length === 0) {
      return { type: "switch", pokemonIndex: actions.switches[0]?.index || 1 }
    }

    const oppActive = state.sides.p1.active.find(
      (p): p is NonNullable<typeof p> => p != null && !p.fainted,
    )
    if (!oppActive) return pickHealthiestSwitch(actions)

    const myActive = state.sides.p2.active[actions.activeSlot ?? 0]
    const oppPrediction = state.opponentPredictions?.[oppActive.pokemonId]

    let bestScore = -Infinity
    let bestIndex = available[0].index

    for (const sw of available) {
      const pokemon = findTeamPokemon(state.sides.p2.team, sw)
      if (!pokemon) continue

      const score = this.scoreSwitchTarget(pokemon, oppActive, myActive || pokemon, oppPrediction)
      if (score > bestScore) {
        bestScore = score
        bestIndex = sw.index
      }
    }

    return { type: "switch", pokemonIndex: bestIndex }
  }
}
