import { getBaseStatTotal } from "@nasty-plot/core"
import type { TeamData, UsageStatsEntry, PokemonSpecies, StatsTable } from "@nasty-plot/core"

function formatBaseStats(stats: StatsTable): string {
  return `${stats.hp}/${stats.atk}/${stats.def}/${stats.spa}/${stats.spd}/${stats.spe} (BST: ${getBaseStatTotal(stats)})`
}

export function buildTeamContext(teamData: TeamData): string {
  const lines: string[] = [
    `## Current Team: "${teamData.name}"`,
    `Format: ${teamData.formatId}`,
    `Slots filled: ${teamData.slots.length}/6`,
    "",
  ]

  for (const slot of teamData.slots) {
    const { species } = slot
    const typesStr = species?.types.join("/") ?? "Unknown"
    const movesStr = slot.moves.filter(Boolean).join(", ") || "None"
    const evEntries = Object.entries(slot.evs)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${v} ${k.toUpperCase()}`)
      .join(" / ")

    lines.push(`### Slot ${slot.position}: ${species?.name ?? slot.pokemonId}`)
    lines.push(`- Type: ${typesStr}`)
    lines.push(`- Ability: ${slot.ability}`)
    lines.push(`- Item: ${slot.item}`)
    lines.push(`- Nature: ${slot.nature}`)
    if (slot.teraType) lines.push(`- Tera Type: ${slot.teraType}`)
    lines.push(`- EVs: ${evEntries || "None"}`)
    lines.push(`- Moves: ${movesStr}`)
    if (species?.baseStats) {
      lines.push(`- Base Stats: ${formatBaseStats(species.baseStats)}`)
    }
    lines.push("")
  }

  if (teamData.slots.length > 0) {
    const allTypes = teamData.slots.filter((s) => s.species).flatMap((s) => s.species!.types)
    const uniqueTypes = [...new Set(allTypes)]
    lines.push(`### Team Type Composition`)
    lines.push(`Types represented: ${uniqueTypes.join(", ")}`)
    lines.push("")
  }

  return lines.join("\n")
}

export function buildMetaContext(formatId: string, topPokemon: UsageStatsEntry[]): string {
  const lines: string[] = [
    `## Meta Overview: ${formatId}`,
    `Top ${topPokemon.length} Pokemon by usage:`,
    "",
  ]

  for (const entry of topPokemon) {
    const name = entry.pokemonName ?? entry.pokemonId
    lines.push(`${entry.rank}. ${name} - ${entry.usagePercent.toFixed(2)}% usage`)
  }

  return lines.join("\n")
}

export function buildPokemonContext(pokemonId: string, species: PokemonSpecies): string {
  const abilities = Object.entries(species.abilities)
    .map(([slot, name]) => (slot === "H" ? `${name} (Hidden)` : name))
    .join(", ")

  return [
    `## Currently Viewing: ${species.name}`,
    `- Types: ${species.types.join("/")}`,
    `- Base Stats: ${formatBaseStats(species.baseStats)}`,
    `- Abilities: ${abilities}`,
    species.tier ? `- Tier: ${species.tier}` : "",
    "",
  ]
    .filter(Boolean)
    .join("\n")
}

export interface GuidedBuilderContext {
  step: string
  teamSize: number
  currentBuildSlot: number
  slotSummaries: string[]
  formatId: string
}

export interface PageContextData {
  pageType: string
  contextSummary: string
  teamId?: string
  pokemonId?: string
  formatId?: string
  guidedBuilder?: GuidedBuilderContext
}

export function buildPageContextPrompt(context: PageContextData): string {
  if (!context.contextSummary && !context.guidedBuilder) return ""

  const lines: string[] = []

  if (context.contextSummary) {
    lines.push(`## Current Page Context\n${context.contextSummary}`)
  }

  if (context.guidedBuilder) {
    const gb = context.guidedBuilder
    lines.push(`## Guided Team Builder`)
    lines.push(`Step: ${gb.step} | Format: ${gb.formatId} | Team size: ${gb.teamSize}/6`)
    if (gb.step === "build") {
      lines.push(`Currently filling slot ${gb.currentBuildSlot}`)
    }
    if (gb.slotSummaries.length > 0) {
      lines.push(`\nCurrent team:`)
      for (const [i, summary] of gb.slotSummaries.entries()) {
        lines.push(`${i + 1}. ${summary}`)
      }
    }
    lines.push(
      `\nThe user is building a team step-by-step in the guided builder. Help them with their current decision.`,
    )
  }

  return "\n" + lines.join("\n") + "\n"
}

const CONTEXT_MODE_PROMPTS: Record<string, string> = {
  "guided-builder": `You are acting as a **team building advisor** in the guided team builder. The user is constructing a team step-by-step. You have full access to all tools including team CRUD operations.

Guide them through team building decisions:
- Suggest Pokemon that complement their current team
- Explain type synergy and coverage gaps
- Recommend sets (moves, EVs, nature, item, ability) for each pick
- Consider the format's metagame when making suggestions
- Be proactive: if you see a weakness, call it out`,

  "team-editor": `You are acting as a **team optimization expert**. The user is editing an existing team. You have full access to all tools including team CRUD operations.

Help them refine their team:
- Analyze existing sets and suggest improvements
- Identify coverage gaps and suggest fixes
- Run damage calcs when relevant
- Suggest alternative spreads, moves, or Pokemon swaps
- Consider the format's metagame threats`,

  "battle-live": `You are acting as a **real-time battle coach**. The user is in a live battle simulation. You can look up Pokemon data and run analysis but CANNOT modify teams.

Provide tactical advice:
- Analyze the current game state (HP, field conditions, matchups)
- Suggest optimal moves for the current turn
- Warn about opponent threats and predict their plays
- Explain type matchups and damage ranges
- Keep advice concise — the user needs to act quickly`,

  "battle-replay": `You are acting as a **post-battle analyst**. The user is reviewing a battle replay. You can look up Pokemon data and run analysis but CANNOT modify teams.

Analyze the battle:
- Evaluate key decisions and turning points
- Identify misplays or missed opportunities
- Explain why certain moves were good or bad choices
- Discuss alternative lines of play
- Reference specific turns when analyzing`,
}

export function buildContextModePrompt(contextMode: string, contextData?: string): string {
  const modePrompt = CONTEXT_MODE_PROMPTS[contextMode]
  if (!modePrompt) return ""

  const lines: string[] = [modePrompt]

  if (contextData) {
    try {
      const data = JSON.parse(contextData)

      if (contextMode === "guided-builder" || contextMode === "team-editor") {
        appendTeamEditorContext(lines, data)
      } else if (contextMode === "battle-live") {
        appendBattleLiveContext(lines, data)
      } else if (contextMode === "battle-replay") {
        appendBattleReplayContext(lines, data)
      }
    } catch {
      // Invalid JSON is fine — skip context data
    }
  }

  return "\n" + lines.join("\n") + "\n"
}

function appendTeamEditorContext(lines: string[], data: Record<string, unknown>): void {
  if (data.teamName) lines.push(`\nTeam: "${data.teamName}"`)
  if (data.formatId) lines.push(`Format: ${data.formatId}`)
  if (data.paste) lines.push(`\nTeam Paste:\n\`\`\`\n${data.paste}\n\`\`\``)
  if (data.slotsFilled !== undefined) lines.push(`Slots filled: ${data.slotsFilled}/6`)
  if (Array.isArray(data.slots) && data.slots.length > 0) {
    lines.push(`\nCurrent team:`)
    for (const [i, slot] of data.slots.entries()) {
      lines.push(`${i + 1}. ${slot}`)
    }
  }
}

function appendBattleLiveContext(lines: string[], data: Record<string, unknown>): void {
  if (data.formatId) lines.push(`\nFormat: ${data.formatId}`)
  if (data.team1Name) lines.push(`Player: ${data.team1Name}`)
  if (data.team2Name) lines.push(`Opponent: ${data.team2Name}`)
  if (data.aiDifficulty) lines.push(`AI Difficulty: ${data.aiDifficulty}`)
}

function appendBattleReplayContext(lines: string[], data: Record<string, unknown>): void {
  if (data.formatId) lines.push(`\nFormat: ${data.formatId}`)
  if (data.team1Name) lines.push(`${data.team1Name} vs ${data.team2Name}`)
  if (data.turnCount) lines.push(`${data.turnCount} turns`)
  if (data.winnerId)
    lines.push(`Winner: ${data.winnerId === "team1" ? data.team1Name : data.team2Name}`)
}

export function buildPlanModePrompt(): string {
  return `
## Planning
For complex multi-step tasks (building a team, comprehensive analysis, multi-pokemon comparison),
create a step-by-step plan first:

<plan>
<step>Step 1 description</step>
<step>Step 2 description</step>
</plan>

As you complete each step, output:
<step_update index="0" status="complete"/>

For simple questions, answer directly without a plan.
`
}
