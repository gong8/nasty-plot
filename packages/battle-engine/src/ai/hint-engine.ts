import { getRawMove } from "@nasty-plot/pokemon-data"
import type { BattleState, BattleActionSet, BattleAction, BattlePokemon, DexMove } from "../types"
import { evaluatePosition, type EvalResult } from "./evaluator"
import {
  calculateBattleDamage,
  getSpeciesTypes,
  getTypeEffectiveness,
  HAZARD_SCORES,
  STATUS_INFLICTION_SCORES,
  SETUP_MOVE_SCORE,
  RECOVERY_SCORES,
  HAZARD_REMOVAL_BASE,
  HAZARD_REMOVAL_PER_HAZARD,
} from "./shared"

export type MoveClassification = "best" | "good" | "neutral" | "inaccuracy" | "mistake" | "blunder"

export interface MoveHint {
  action: BattleAction
  name: string
  score: number
  rank: number
  classification: MoveClassification
  explanation: string
}

export interface HintResult {
  rankedMoves: MoveHint[]
  currentEval: EvalResult
  bestAction: BattleAction
}

function classifyGap(gap: number): MoveClassification {
  if (gap <= 0) return "best"
  if (gap <= 5) return "good"
  if (gap <= 15) return "neutral"
  if (gap <= 30) return "inaccuracy"
  if (gap <= 60) return "mistake"
  return "blunder"
}

function estimateMoveScore(
  move: BattleActionSet["moves"][0],
  myActive: BattlePokemon,
  oppActive: BattlePokemon,
  state: BattleState,
): { score: number; explanation: string } {
  const moveData = getRawMove(move.name)
  if (!moveData?.exists) {
    return { score: 0, explanation: "Unknown move" }
  }

  // Status moves: use a heuristic score
  if (moveData.category === "Status") {
    return estimateStatusMoveScore(moveData, myActive, oppActive, state)
  }

  // Damaging moves: use @smogon/calc
  try {
    const { damage, result } = calculateBattleDamage(myActive, oppActive, move.name)
    const avgDmg = damage.reduce((a, b) => a + b, 0) / damage.length
    const maxDmg = Math.max(...damage)
    const defMaxHP = result.defender.maxHP()
    const dmgPercent = defMaxHP > 0 ? (avgDmg / defMaxHP) * 100 : 0

    let score = dmgPercent
    let explanation = `~${Math.round(dmgPercent)}% damage`

    // KO bonuses
    if (maxDmg >= oppActive.hp) {
      const minDmg = Math.min(...damage)
      if (minDmg >= oppActive.hp) {
        score += 80
        explanation = "Guaranteed KO!"
      } else {
        const koChance = damage.filter((d) => d >= oppActive.hp).length / damage.length
        score += 40 + koChance * 40
        explanation = `${Math.round(koChance * 100)}% chance to KO`
      }
    }

    // Priority bonus when opponent is low
    if (moveData.priority > 0 && oppActive.hpPercent < 30) {
      score += 20
      explanation += " (priority)"
    }

    // STAB bonus
    const myTypes = getSpeciesTypes(myActive.name)
    if (myTypes.includes(moveData.type as never)) {
      score += 5
    }

    return { score, explanation }
  } catch {
    // Fall back to type effectiveness estimate
    const oppTypes = getSpeciesTypes(oppActive.name)
    const eff = getTypeEffectiveness(moveData.type, oppTypes as string[])
    const score = eff * 20
    return { score, explanation: `Type effectiveness: ${eff}x` }
  }
}

function estimateStatusMoveScore(
  moveData: DexMove,
  myActive: BattlePokemon,
  oppActive: BattlePokemon,
  state: BattleState,
): { score: number; explanation: string } {
  const id = moveData.id

  // Hazards
  if (id === "stealthrock") {
    const opp = state.sides.p2.sideConditions
    if (!opp.stealthRock)
      return { score: HAZARD_SCORES.stealthrock, explanation: "Sets Stealth Rock" }
    return { score: 0, explanation: "Stealth Rock already up" }
  }
  if (id === "spikes") {
    const opp = state.sides.p2.sideConditions
    if (opp.spikes < 3)
      return { score: HAZARD_SCORES.spikes, explanation: `Sets Spikes layer ${opp.spikes + 1}` }
    return { score: 0, explanation: "Max Spikes layers" }
  }
  if (id === "toxicspikes") {
    const opp = state.sides.p2.sideConditions
    if (opp.toxicSpikes < 2)
      return {
        score: HAZARD_SCORES.toxicspikes,
        explanation: `Sets Toxic Spikes layer ${opp.toxicSpikes + 1}`,
      }
    return { score: 0, explanation: "Max Toxic Spikes layers" }
  }
  if (id === "stickyweb") {
    const opp = state.sides.p2.sideConditions
    if (!opp.stickyWeb) return { score: HAZARD_SCORES.stickyweb, explanation: "Sets Sticky Web" }
    return { score: 0, explanation: "Sticky Web already up" }
  }

  // Hazard removal
  if (id === "defog" || id === "rapidspin") {
    const my = state.sides.p1.sideConditions
    const hazardCount =
      (my.stealthRock ? 1 : 0) + my.spikes + my.toxicSpikes + (my.stickyWeb ? 1 : 0)
    if (hazardCount > 0)
      return {
        score: HAZARD_REMOVAL_BASE + hazardCount * HAZARD_REMOVAL_PER_HAZARD,
        explanation: `Removes ${hazardCount} hazard(s)`,
      }
    return { score: 2, explanation: "No hazards to remove" }
  }

  // Status moves
  if (["toxic", "willowisp", "thunderwave", "spore", "sleeppowder", "yawn"].includes(id)) {
    if (oppActive.status) return { score: 0, explanation: "Opponent already statused" }
    const score = STATUS_INFLICTION_SCORES[id as keyof typeof STATUS_INFLICTION_SCORES] || 20
    return { score, explanation: `Inflicts status on opponent` }
  }

  // Setup moves
  if (
    [
      "swordsdance",
      "nastyplot",
      "calmmind",
      "dragondance",
      "irondefense",
      "amnesia",
      "shellsmash",
    ].includes(id)
  ) {
    if (myActive.hpPercent > 60)
      return { score: SETUP_MOVE_SCORE, explanation: "Boosts stats (good HP)" }
    return { score: 10, explanation: "Boosts stats (low HP risk)" }
  }

  // Recovery
  if (
    ["recover", "roost", "softboiled", "moonlight", "synthesis", "shoreup", "slackoff"].includes(id)
  ) {
    if (myActive.hpPercent < 50)
      return { score: RECOVERY_SCORES.low, explanation: "Recover HP (low)" }
    if (myActive.hpPercent < 75)
      return { score: RECOVERY_SCORES.moderate, explanation: "Recover HP (moderate)" }
    return { score: RECOVERY_SCORES.nearFull, explanation: "Already near full HP" }
  }

  return { score: 5, explanation: "Status move" }
}

function estimateSwitchScore(
  switchInfo: BattleActionSet["switches"][0],
  state: BattleState,
): { score: number; explanation: string } {
  const oppActive = state.sides.p2.active[0]
  if (!oppActive) return { score: 10, explanation: "Switch out" }

  const switchPokemon = state.sides.p1.team.find(
    (p) => p.name === switchInfo.name || p.speciesId === switchInfo.speciesId,
  )
  if (!switchPokemon) return { score: 5, explanation: "Switch to unknown" }

  let score = 0
  const oppTypes = getSpeciesTypes(oppActive.name)
  const swTypes = getSpeciesTypes(switchPokemon.name)

  // Defensive: does the switch-in resist opponent's STAB?
  for (const t of oppTypes) {
    const eff = getTypeEffectiveness(t, swTypes as string[])
    if (eff < 1) score += 15
    if (eff === 0) score += 25
  }

  // Offensive: does switch-in have SE coverage?
  for (const t of swTypes) {
    if (getTypeEffectiveness(t, oppTypes as string[]) > 1) {
      score += 10
      break
    }
  }

  // Health penalty
  score *= switchPokemon.hpPercent / 100

  // Hazard penalty
  const mySC = state.sides.p1.sideConditions
  if (mySC.stealthRock) score -= 10
  if (mySC.spikes > 0) score -= 5 * mySC.spikes
  if (mySC.stickyWeb) score -= 5

  const explanation =
    score > 20 ? "Good defensive switch" : score > 0 ? "Reasonable switch" : "Risky switch"

  return { score, explanation }
}

/**
 * Generate hints for all legal actions at the current battle state.
 * Ranks moves by estimated value and classifies them relative to the best option.
 *
 * In doubles, pass `activeSlot` (0 or 1) to evaluate against the correct opponent slot(s).
 */
export function generateHints(
  state: BattleState,
  actions: BattleActionSet,
  perspective: "p1" | "p2" = "p1",
  activeSlot = 0,
): HintResult {
  const currentEval = evaluatePosition(state, perspective)
  const scored: { action: BattleAction; name: string; score: number; explanation: string }[] = []

  const myActive = state.sides[perspective].active[activeSlot]
  const oppSide = perspective === "p1" ? "p2" : "p1"
  const isDoubles = state.format === "doubles"

  // Get opponent actives
  const oppActives = isDoubles
    ? state.sides[oppSide].active.filter((p): p is NonNullable<typeof p> => p != null && !p.fainted)
    : [state.sides[oppSide].active[0]].filter((p): p is NonNullable<typeof p> => p != null)

  const oppActive = oppActives[0] ?? null

  // Score moves
  if (myActive && oppActive) {
    for (let i = 0; i < actions.moves.length; i++) {
      const move = actions.moves[i]
      if (move.disabled) continue

      if (isDoubles && oppActives.length > 1) {
        // Evaluate against each target, pick best
        let bestScore = -Infinity
        let bestExpl = ""
        let bestTarget = 1

        for (let t = 0; t < oppActives.length; t++) {
          const { score, explanation } = estimateMoveScore(move, myActive, oppActives[t], state)
          if (score > bestScore) {
            bestScore = score
            bestExpl = `${explanation} (→ ${oppActives[t].name})`
            bestTarget = t + 1 // Foe slots are positive: 1 = p2a, 2 = p2b
          }
        }

        scored.push({
          action: { type: "move", moveIndex: i + 1, targetSlot: bestTarget },
          name: move.name,
          score: bestScore,
          explanation: bestExpl,
        })
      } else {
        const { score, explanation } = estimateMoveScore(move, myActive, oppActive, state)
        scored.push({
          action: { type: "move", moveIndex: i + 1 },
          name: move.name,
          score,
          explanation,
        })
      }
    }
  }

  // Score switches (only if not force switch — for force switch we score all)
  for (const sw of actions.switches) {
    if (sw.fainted) continue
    const { score, explanation } = estimateSwitchScore(sw, state)
    scored.push({
      action: { type: "switch", pokemonIndex: sw.index },
      name: `Switch to ${sw.name}`,
      score,
      explanation,
    })
  }

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score)

  const bestScore = scored.length > 0 ? scored[0].score : 0

  const rankedMoves: MoveHint[] = scored.map((s, idx) => {
    const gap = bestScore - s.score
    return {
      action: s.action,
      name: s.name,
      score: s.score,
      rank: idx + 1,
      classification: classifyGap(gap),
      explanation: s.explanation,
    }
  })

  return {
    rankedMoves,
    currentEval,
    bestAction: scored.length > 0 ? scored[0].action : { type: "move", moveIndex: 1 },
  }
}
