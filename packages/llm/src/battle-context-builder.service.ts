import {
  calcHpPercent,
  formatMoveStats,
  formatBoosts,
  formatFieldState,
  formatSideConditions,
  type BattleState,
  type BattlePokemon,
  type BattleLogEntry,
  type SideConditions,
} from "@nasty-plot/battle-engine"
import type { AutoAnalyzeDepth } from "@nasty-plot/core"

export interface BattleCommentaryContext {
  systemPrompt: string
  turnContext: string
}

function describePokemon(pokemon: BattlePokemon | null): string {
  if (!pokemon) return "empty slot"
  const {
    name,
    types,
    hpPercent,
    status,
    ability,
    item,
    isTerastallized,
    teraType,
    moves,
    boosts,
    volatiles,
  } = pokemon
  const parts = [name, types.join("/")]
  if (hpPercent < 100) parts.push(`${hpPercent}% HP`)
  if (status) parts.push(status)
  if (ability) parts.push(`Ability: ${ability}`)
  if (item) parts.push(`Item: ${item}`)
  if (isTerastallized && teraType) {
    parts.push(`Tera ${teraType} (active)`)
  } else if (teraType) {
    parts.push(`Tera type: ${teraType}`)
  }
  const knownMoves = moves.filter((m) => m.name)
  if (knownMoves.length) {
    parts.push(`Moves: ${knownMoves.map((m) => `${m.name} (${m.type})`).join(", ")}`)
  }
  const boostsStr = formatBoosts(boosts)
  if (boostsStr) parts.push(boostsStr)
  if (volatiles.length) parts.push(`Volatiles: ${volatiles.join(", ")}`)
  return parts.join(" | ")
}

function describeSide(side: {
  active: (BattlePokemon | null)[]
  team: BattlePokemon[]
  name: string
  sideConditions: SideConditions
  canTera?: boolean
  hasTerastallized?: boolean
}): string {
  const active = side.active.map(describePokemon).join("\n  ")
  const alive = side.team.filter((p) => !p.fainted).length
  const total = side.team.length
  const conditions = formatSideConditions(side.sideConditions) || "none"
  const bench = side.team
    .filter((p) => !side.active.includes(p) && !p.fainted)
    .map(
      (p) =>
        `${p.name} (${p.types.join("/")}${p.status ? `, ${p.status}` : ""}, ${p.hpPercent}% HP)`,
    )
    .join(", ")
  const teraStatus = side.hasTerastallized ? "Tera used" : side.canTera ? "Tera available" : ""
  return `**${side.name}** [${alive}/${total} alive]${teraStatus ? ` [${teraStatus}]` : ""}
  Active: ${active}
  Bench: ${bench || "none"}
  Side: ${conditions}`
}

const RELEVANT_LOG_TYPES = new Set([
  "move",
  "damage",
  "heal",
  "status",
  "faint",
  "switch",
  "boost",
  "unboost",
  "weather",
  "terrain",
  "hazard",
  "tera",
  "crit",
  "supereffective",
  "resisted",
  "immune",
  "item",
  "ability",
])

function describeLogEntries(entries: BattleLogEntry[]): string {
  return entries
    .filter((e) => RELEVANT_LOG_TYPES.has(e.type))
    .map((e) => e.message)
    .join("\n")
}

function describeBattleState(state: BattleState): string {
  return `## Battle State (Turn ${state.turn})
${describeSide(state.sides.p1)}
${describeSide(state.sides.p2)}
Field: ${formatFieldState(state.field) || "No field effects"}`
}

export function buildTurnCommentaryContext(
  state: BattleState,
  recentEntries: BattleLogEntry[],
  team1Name: string,
  team2Name: string,
): BattleCommentaryContext {
  const systemPrompt = `You are an expert Pokemon competitive battle commentator. You provide insightful, concise commentary about competitive Pokemon battles. You understand type matchups, common strategies, hazards, weather, terrain, and competitive metagame dynamics. Keep commentary to 2-3 sentences. Be engaging and educational, explaining WHY moves are good or bad choices.`

  const turnContext = `${describeBattleState(state)}

## This Turn's Events:
${describeLogEntries(recentEntries) || "No events yet"}

Provide brief, insightful commentary on this turn of the battle between ${team1Name} and ${team2Name}.`

  return { systemPrompt, turnContext }
}

const KEY_MOMENT_TYPES = new Set(["faint", "supereffective", "crit", "tera"])

export function buildPostBattleContext(
  allEntries: BattleLogEntry[],
  team1Name: string,
  team2Name: string,
  winner: string | null,
  totalTurns: number,
): string {
  const winnerName = winner === "p1" ? team1Name : winner === "p2" ? team2Name : "tie"
  const faints = allEntries.filter((e) => e.type === "faint")
  const keyMoments = allEntries.filter((e) => KEY_MOMENT_TYPES.has(e.type))

  return `Provide a brief post-battle summary of a ${totalTurns}-turn battle between ${team1Name} and ${team2Name}. Winner: ${winnerName}.

Key moments:
${keyMoments.map((e) => `Turn ${e.turn}: ${e.message}`).join("\n")}

Total KOs: ${faints.length}

Give a 3-4 sentence summary analyzing the key turning points and what decided the outcome.`
}

export function buildTurnAnalysisContext(
  state: BattleState,
  turnEntries: BattleLogEntry[],
  prevTurnEntries?: BattleLogEntry[],
): string {
  return `Analyze this specific turn in depth:

${describeBattleState(state)}

## Events This Turn:
${describeLogEntries(turnEntries)}

${prevTurnEntries ? `## Previous Turn:\n${describeLogEntries(prevTurnEntries)}` : ""}

Provide detailed analysis of the decisions made this turn. Were they optimal? What alternatives existed? Keep to 3-4 sentences.`
}

/**
 * Build a prompt for auto-analyze mode.
 * Quick: concise advice (2-3 sentences), no tools.
 * Deep: use MCP tools for calcs, detailed strategy.
 */
export function buildAutoAnalyzePrompt(
  state: BattleState,
  depth: AutoAnalyzeDepth,
  turnEntries: BattleLogEntry[],
): string {
  const battleState = describeBattleState(state)
  const recentEvents = describeLogEntries(turnEntries)
  const { actionsSection, isForceSwitch } = formatAvailableActions(state)
  const intro =
    depth === "quick"
      ? "You are coaching the player in a live battle. Give CONCISE advice for this turn."
      : "You are coaching the player in a live battle. Provide IN-DEPTH strategic analysis for this turn."
  const formatInstructions =
    depth === "quick"
      ? buildQuickAnalyzeFormat(isForceSwitch)
      : buildDeepAnalyzeFormat(isForceSwitch)

  return `${intro}

${battleState}

## Recent Events:
${recentEvents || "Battle just started"}

${actionsSection}

${formatInstructions}`
}

function formatAvailableActions(state: BattleState): {
  actionsSection: string
  isForceSwitch: boolean
} {
  const isForceSwitch = state.availableActions?.forceSwitch ?? false
  const canTera = state.availableActions?.canTera ?? false

  const availableMoves = state.availableActions?.moves
    ?.map((m, i) => `${i + 1}. ${formatMoveStats(m)}`)
    .join("\n")

  const switchOptions = state.availableActions?.switches
    ?.map((s) => {
      const hp = calcHpPercent(s.hp, s.maxHp)
      return `${s.name} (${hp}% HP${s.status ? `, ${s.status}` : ""})`
    })
    .join(", ")

  const actionsSection = isForceSwitch
    ? `## FORCED SWITCH — Your Pokemon fainted! Choose a switch-in:
${switchOptions || "No switches available"}`
    : `## Available Actions
${availableMoves ? `Moves:\n${availableMoves}` : "No moves available"}
${canTera ? "Tera: Available this turn" : ""}
${switchOptions ? `Switch options: ${switchOptions}` : ""}`

  return { actionsSection, isForceSwitch }
}

function buildQuickAnalyzeFormat(isForceSwitch: boolean): string {
  return isForceSwitch
    ? `Format your response EXACTLY like this:
**Recommended: [Pokemon Name]** -- [one-line reasoning for this switch-in]

Then add 1-2 sentences on what to watch out for with the switch-in. Do NOT use any tools. Be direct and actionable.`
    : `Format your response EXACTLY like this:
**Recommended: [Move Name]** -- [one-line reasoning]

Then add 1-2 sentences of brief strategic context. Do NOT use any tools. Be direct and actionable.`
}

function buildDeepAnalyzeFormat(isForceSwitch: boolean): string {
  return isForceSwitch
    ? `Use your tools to:
1. Check type matchups for each switch-in against the opponent's active Pokemon
2. Look up the opponent's likely coverage moves

Structure your response as:
### Opponent Read
What set/strategy the opponent is likely running and what moves they may use next.

### Recommendation
**Recommended: [Pokemon Name]**
Why this is the safest or most advantageous switch-in.

### Strategic Plan
What to do after switching in — plan the next 2-3 turns.

### Alternatives
Other switch-in options and when you'd prefer them.`
    : `Use your tools to:
1. Check type matchups and damage calculations for key moves
2. Look up the opponent's likely set and coverage

Structure your response as:
### Opponent Read
What set/strategy the opponent is likely running.

### Recommendation
**Recommended: [Move Name]**
Key damage calculations and reasoning.

### Strategic Plan
What to plan for the next 2-3 turns.

### Alternatives
Other viable options and when you'd pick them instead.`
}
