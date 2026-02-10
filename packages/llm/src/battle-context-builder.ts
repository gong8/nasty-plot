import type {
  BattleState,
  BattlePokemon,
  BattleLogEntry,
  FieldState,
  SideConditions,
} from "@nasty-plot/battle-engine"

export interface BattleCommentaryContext {
  systemPrompt: string
  turnContext: string
}

function describePokemon(pokemon: BattlePokemon | null): string {
  if (!pokemon) return "empty slot"
  const parts = [pokemon.name]
  if (pokemon.hpPercent < 100) parts.push(`${pokemon.hpPercent}% HP`)
  if (pokemon.status) parts.push(pokemon.status)
  if (pokemon.isTerastallized && pokemon.teraType) parts.push(`Tera ${pokemon.teraType}`)
  const boosts = Object.entries(pokemon.boosts)
    .filter(([_, v]) => v !== 0)
    .map(([k, v]) => `${v > 0 ? "+" : ""}${v} ${k}`)
  if (boosts.length) parts.push(boosts.join(", "))
  return parts.join(" (") + (parts.length > 1 ? ")" : "")
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
}): string {
  const active = side.active.map(describePokemon).join(", ")
  const alive = side.team.filter((p) => !p.fainted).length
  const total = side.team.length
  const conditions = describeSideConditions(side.sideConditions)
  return `${side.name}: Active: ${active} | ${alive}/${total} alive | Side: ${conditions}`
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
