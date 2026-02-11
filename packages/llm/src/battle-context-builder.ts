import type {
  BattleState,
  BattlePokemon,
  BattleLogEntry,
  FieldState,
  SideConditions,
} from "@nasty-plot/battle-engine"
import type { AutoAnalyzeDepth } from "@nasty-plot/core"

export interface BattleCommentaryContext {
  systemPrompt: string
  turnContext: string
}

function describePokemon(pokemon: BattlePokemon | null): string {
  if (!pokemon) return "empty slot"
  const parts = [pokemon.name]
  // Types
  parts.push(pokemon.types.join("/"))
  if (pokemon.hpPercent < 100) parts.push(`${pokemon.hpPercent}% HP`)
  if (pokemon.status) parts.push(pokemon.status)
  if (pokemon.ability) parts.push(`Ability: ${pokemon.ability}`)
  if (pokemon.item) parts.push(`Item: ${pokemon.item}`)
  if (pokemon.isTerastallized && pokemon.teraType) {
    parts.push(`Tera ${pokemon.teraType} (active)`)
  } else if (pokemon.teraType) {
    parts.push(`Tera type: ${pokemon.teraType}`)
  }
  // Known moves
  const knownMoves = pokemon.moves.filter((m) => m.name)
  if (knownMoves.length) {
    parts.push(`Moves: ${knownMoves.map((m) => `${m.name} (${m.type})`).join(", ")}`)
  }
  const boosts = Object.entries(pokemon.boosts)
    .filter(([_, v]) => v !== 0)
    .map(([k, v]) => `${v > 0 ? "+" : ""}${v} ${k}`)
  if (boosts.length) parts.push(boosts.join(", "))
  if (pokemon.volatiles.length) parts.push(`Volatiles: ${pokemon.volatiles.join(", ")}`)
  return parts.join(" | ")
}

function describeField(field: FieldState): string {
  const parts: string[] = []
  if (field.weather) parts.push(`Weather: ${field.weather} (${field.weatherTurns} turns)`)
  if (field.terrain) parts.push(`Terrain: ${field.terrain} (${field.terrainTurns} turns)`)
  if (field.trickRoom) parts.push(`Trick Room (${field.trickRoom} turns)`)
  return parts.length ? parts.join(", ") : "No field effects"
}

function describeSideConditions(sc: SideConditions): string {
  const parts: string[] = []
  if (sc.stealthRock) parts.push("Stealth Rock")
  if (sc.spikes > 0) parts.push(`Spikes x${sc.spikes}`)
  if (sc.toxicSpikes > 0) parts.push(`Toxic Spikes x${sc.toxicSpikes}`)
  if (sc.stickyWeb) parts.push("Sticky Web")
  if (sc.reflect > 0) parts.push(`Reflect (${sc.reflect}t)`)
  if (sc.lightScreen > 0) parts.push(`Light Screen (${sc.lightScreen}t)`)
  if (sc.auroraVeil > 0) parts.push(`Aurora Veil (${sc.auroraVeil}t)`)
  if (sc.tailwind > 0) parts.push(`Tailwind (${sc.tailwind}t)`)
  return parts.length ? parts.join(", ") : "none"
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
  const conditions = describeSideConditions(side.sideConditions)
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

function describeLogEntries(entries: BattleLogEntry[]): string {
  return entries
    .filter((e) =>
      [
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
      ].includes(e.type),
    )
    .map((e) => e.message)
    .join("\n")
}

export function buildTurnCommentaryContext(
  state: BattleState,
  recentEntries: BattleLogEntry[],
  team1Name: string,
  team2Name: string,
): BattleCommentaryContext {
  const systemPrompt = `You are an expert Pokemon competitive battle commentator. You provide insightful, concise commentary about competitive Pokemon battles. You understand type matchups, common strategies, hazards, weather, terrain, and competitive metagame dynamics. Keep commentary to 2-3 sentences. Be engaging and educational, explaining WHY moves are good or bad choices.`

  const turnContext = `## Battle State (Turn ${state.turn})
${describeSide(state.sides.p1)}
${describeSide(state.sides.p2)}
Field: ${describeField(state.field)}

## This Turn's Events:
${describeLogEntries(recentEntries) || "No events yet"}

Provide brief, insightful commentary on this turn of the battle between ${team1Name} and ${team2Name}.`

  return { systemPrompt, turnContext }
}

export function buildPostBattleContext(
  allEntries: BattleLogEntry[],
  team1Name: string,
  team2Name: string,
  winner: string | null,
  totalTurns: number,
): string {
  const winnerName = winner === "p1" ? team1Name : winner === "p2" ? team2Name : "tie"
  const faints = allEntries.filter((e) => e.type === "faint")
  const keyMoments = allEntries.filter(
    (e) =>
      e.type === "faint" || e.type === "supereffective" || e.type === "crit" || e.type === "tera",
  )

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

## Battle State:
${describeSide(state.sides.p1)}
${describeSide(state.sides.p2)}
Field: ${describeField(state.field)}

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
  const battleState = `## Battle State (Turn ${state.turn})
${describeSide(state.sides.p1)}
${describeSide(state.sides.p2)}
Field: ${describeField(state.field)}`

  const recentEvents = describeLogEntries(turnEntries)

  const isForceSwitch = state.availableActions?.forceSwitch ?? false
  const canTera = state.availableActions?.canTera ?? false

  const availableMoves = state.availableActions?.moves
    ?.map((m, i) => {
      const acc = m.accuracy === true ? "—" : `${m.accuracy}%`
      return `${i + 1}. ${m.name} (${m.type}, ${m.category}, ${m.basePower} BP, ${acc} acc, ${m.pp}/${m.maxPp} PP)${m.disabled ? " [DISABLED]" : ""}`
    })
    .join("\n")

  const switchOptions = state.availableActions?.switches
    ?.map((s) => {
      const hp = s.maxHp > 0 ? Math.round((s.hp / s.maxHp) * 100) : 0
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

  if (depth === "quick") {
    const format = isForceSwitch
      ? `Format your response EXACTLY like this:
**Recommended: [Pokemon Name]** -- [one-line reasoning for this switch-in]

Then add 1-2 sentences on what to watch out for with the switch-in. Do NOT use any tools. Be direct and actionable.`
      : `Format your response EXACTLY like this:
**Recommended: [Move Name]** -- [one-line reasoning]

Then add 1-2 sentences of brief strategic context. Do NOT use any tools. Be direct and actionable.`

    return `You are coaching the player in a live battle. Give CONCISE advice for this turn.

${battleState}

## Recent Events:
${recentEvents || "Battle just started"}

${actionsSection}

${format}`
  }

  // Deep mode
  const deepStructure = isForceSwitch
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

  return `You are coaching the player in a live battle. Provide IN-DEPTH strategic analysis for this turn.

${battleState}

## Recent Events:
${recentEvents || "Battle just started"}

${actionsSection}

${deepStructure}`
}
