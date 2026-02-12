import { Dex } from "@pkmn/dex"
import { Generations } from "@pkmn/data"
import { calculate, Pokemon, Move, Field } from "@smogon/calc"
import type {
  AIPlayer,
  BattleState,
  BattleActionSet,
  BattleAction,
  BattlePokemon,
  PredictedSet,
  DexMove,
} from "../types"
import type { PokemonType, GameType } from "@nasty-plot/core"
import {
  flattenDamage,
  getSpeciesTypes,
  getTypeEffectiveness,
  fallbackMove,
  HAZARD_SCORES,
  STATUS_INFLICTION_SCORES,
  SETUP_MOVE_SCORE,
  RECOVERY_SCORES,
  HAZARD_REMOVAL_BASE,
  HAZARD_REMOVAL_PER_HAZARD,
} from "./shared"

const gens = new Generations(Dex)
const gen = gens.get(9)

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
    if (matchupScore < -0.3) {
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
    const moveData = Dex.moves.get(move.name)
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
      const attacker = new Pokemon(gen, myPokemon.name, {
        level: myPokemon.level,
        ability: myPokemon.ability || undefined,
        item: myPokemon.item || undefined,
      })
      const defender = new Pokemon(gen, oppPokemon.name, {
        level: oppPokemon.level,
        ability: oppPokemon.ability || undefined,
        item: oppPokemon.item || undefined,
        curHP: oppPokemon.hp,
      })
      const calcMove = new Move(gen, moveName)
      const result = calculate(gen, attacker, defender, calcMove, new Field())
      const damage = flattenDamage(result.damage)
      const avgDamage = damage.reduce((a, b) => a + b, 0) / damage.length
      const maxDamage = Math.max(...damage)

      // Base score from damage percentage
      const dmgPercent = defender.maxHP() > 0 ? avgDamage / defender.maxHP() : 0
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
      const eff = getTypeEffectiveness(moveData.type, oppTypes as string[])
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

    // Hazard moves: high value early game
    if (["stealthrock", "spikes", "toxicspikes", "stickyweb"].includes(moveName)) {
      return this.scoreHazardMove(moveName, state)
    }

    // Status inflicting moves
    if (["willowisp", "thunderwave", "toxic", "spore", "sleeppowder", "yawn"].includes(moveName)) {
      return this.scoreStatusInfliction(moveName, oppPokemon)
    }

    // Setup moves
    if (
      ["swordsdance", "nastyplot", "calmmind", "dragondance", "irondefense", "amnesia"].includes(
        moveName,
      )
    ) {
      const matchup = this.evaluateMatchup(myPokemon, oppPokemon)
      if (matchup > 0.2 && myPokemon.hpPercent > 70) {
        return SETUP_MOVE_SCORE
      }
      return 0
    }

    // Recovery moves
    if (
      ["recover", "roost", "softboiled", "moonlight", "synthesis", "shoreup", "slackoff"].includes(
        moveName,
      )
    ) {
      if (myPokemon.hpPercent < 50) return RECOVERY_SCORES.low
      if (myPokemon.hpPercent < 75) return RECOVERY_SCORES.moderate
      return 0
    }

    // Hazard removal
    if (moveName === "defog" || moveName === "rapidspin") {
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
    const earlyBonus = 5 // extra score for setting hazards early

    switch (moveName) {
      case "stealthrock":
        return !oppSide.stealthRock ? (state.turn <= 3 ? base + earlyBonus : base - 15) : 0
      case "spikes":
        return oppSide.spikes < 3 ? (state.turn <= 5 ? base + earlyBonus : base - 15) : 0
      case "toxicspikes":
        return oppSide.toxicSpikes < 2 ? (state.turn <= 4 ? base + earlyBonus : base - 13) : 0
      case "stickyweb":
        return !oppSide.stickyWeb ? (state.turn <= 2 ? base + earlyBonus : base - 15) : 0
      default:
        return 0
    }
  }

  private scoreStatusInfliction(moveName: string, oppPokemon: BattlePokemon): number {
    if (oppPokemon.status !== "") return 0
    return STATUS_INFLICTION_SCORES[moveName as keyof typeof STATUS_INFLICTION_SCORES] ?? 0
  }

  private evaluateMatchup(myPokemon: BattlePokemon, oppPokemon: BattlePokemon): number {
    // Returns -1 to 1, where positive means favorable for myPokemon
    const myTypes = getSpeciesTypes(myPokemon.name)
    const oppTypes = getSpeciesTypes(oppPokemon.name)

    let myOffense = 0
    let oppOffense = 0

    for (const t of myTypes) {
      const eff = getTypeEffectiveness(t, oppTypes as string[])
      if (eff > 1) myOffense += 0.3
      if (eff < 1) myOffense -= 0.15
    }

    for (const t of oppTypes) {
      const eff = getTypeEffectiveness(t, myTypes as string[])
      if (eff > 1) oppOffense += 0.3
      if (eff < 1) oppOffense -= 0.15
    }

    return myOffense - oppOffense
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
    if (matchup < -0.3) {
      score -= 30
    }

    // Bonus for resisting the opponent's STAB types
    const oppTypes = getSpeciesTypes(opponent.name)
    const switchTypes = getSpeciesTypes(switchTarget.name)
    for (const t of oppTypes) {
      const eff = getTypeEffectiveness(t, switchTypes as string[])
      if (eff < 1) score += 10
      if (eff === 0) score += 20
    }

    // Penalize switching into predicted coverage moves
    if (prediction && prediction.predictedMoves.length > 0) {
      for (const moveName of prediction.predictedMoves) {
        const moveData = Dex.moves.get(moveName)
        if (!moveData?.exists || moveData.category === "Status") continue
        const eff = getTypeEffectiveness(moveData.type, switchTypes as string[])
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
