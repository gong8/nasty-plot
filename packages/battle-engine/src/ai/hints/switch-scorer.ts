import { getTypeEffectiveness } from "@nasty-plot/core"
import type { BattleActionSet, BattleState } from "../../types"
import { getSpeciesTypes } from "../shared"
import {
  SWITCH_UNKNOWN_SCORE,
  SWITCH_NO_OPPONENT_SCORE,
  SWITCH_SCORES,
  SWITCH_EXPLANATION,
} from "./hint-constants"

export function estimateSwitchScore(
  switchOption: BattleActionSet["switches"][0],
  mySide: BattleState["sides"]["p1"],
  oppSide: BattleState["sides"]["p1"],
): { score: number; explanation: string } {
  const oppActive = oppSide.active[0]
  if (!oppActive) return { score: SWITCH_NO_OPPONENT_SCORE, explanation: "Switch out" }

  const switchPokemon = mySide.team.find(
    (p) => p.name === switchOption.name || p.pokemonId === switchOption.pokemonId,
  )
  if (!switchPokemon) return { score: SWITCH_UNKNOWN_SCORE, explanation: "Switch to unknown" }

  let score = 0
  const oppTypes = getSpeciesTypes(oppActive.name)
  const switchInTypes = getSpeciesTypes(switchPokemon.name)

  for (const t of oppTypes) {
    const eff = getTypeEffectiveness(t, switchInTypes)
    if (eff < 1) score += SWITCH_SCORES.RESIST_BONUS
    if (eff === 0) score += SWITCH_SCORES.IMMUNITY_BONUS
  }

  for (const t of switchInTypes) {
    if (getTypeEffectiveness(t, oppTypes) > 1) {
      score += SWITCH_SCORES.SE_COVERAGE_BONUS
      break
    }
  }

  score *= switchPokemon.hpPercent / 100

  const mySideConditions = mySide.sideConditions
  if (mySideConditions.stealthRock) score -= SWITCH_SCORES.STEALTH_ROCK_PENALTY
  if (mySideConditions.spikes > 0)
    score -= SWITCH_SCORES.SPIKES_PENALTY_PER_LAYER * mySideConditions.spikes
  if (mySideConditions.stickyWeb) score -= SWITCH_SCORES.STICKY_WEB_PENALTY

  const explanation =
    score > SWITCH_EXPLANATION.GOOD
      ? "Good defensive switch"
      : score > SWITCH_EXPLANATION.REASONABLE
        ? "Reasonable switch"
        : "Risky switch"

  return { score, explanation }
}
