import {
  buildTeamContext,
  buildMetaContext,
  buildPageContextPrompt,
  buildPlanModePrompt,
  type PageContextData,
} from "./context-builder"
import { getDisallowedMcpTools, type PageType } from "./tool-context"
import { streamCliChat } from "./cli-chat"
import type { ChatMessage, TeamData, UsageStatsEntry } from "@nasty-plot/core"

const MODEL = process.env.LLM_MODEL || "claude-opus-4-6"
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

const LOG_PREFIX = "[chat]"

function logTiming(label: string, startMs: number, extra?: string): void {
  const elapsed = (performance.now() - startMs).toFixed(0)
  const suffix = extra ? ` ${extra}` : ""
  console.log(`${LOG_PREFIX} ${label} (${elapsed}ms)${suffix}`)
}

const SYSTEM_PROMPT = `You are Pecharunt, a competitive Pokemon expert assistant for Scarlet/Violet (Gen 9). You help trainers build, analyse, and optimize their teams.

Your areas of expertise:
- Team building: suggesting Pokemon, movesets, EV spreads, items, and abilities
- Competitive meta knowledge: usage trends, tier viability, common cores
- Damage calculations and speed tiers
- Type matchups and coverage analysis
- Threat identification and counterplay

Be concise but thorough. When suggesting sets, include the full spread (EVs, nature, item, ability, 4 moves). Use standard competitive notation. When discussing damage, reference specific calcs when possible.

You have access to MCP tools for looking up Pokemon data, usage stats, and performing calculations. Use them when the user asks specific questions rather than guessing.

Format your responses with markdown: use headings, bold, code blocks, lists, and tables where appropriate.`

export interface StreamChatOptions {
  messages: ChatMessage[]
  teamId?: string
  formatId?: string
  signal?: AbortSignal
  context?: PageContextData
}

/**
 * Build the additional system prompt context (team data, format meta, etc.)
 */
async function buildContextParts(teamId?: string, formatId?: string): Promise<string[]> {
  const parts: string[] = []

  if (teamId) {
    try {
      const tTeam = performance.now()
      const res = await fetch(`${BASE_URL}/api/teams/${teamId}`)
      if (res.ok) {
        const teamData = (await res.json()) as { data: TeamData }
        parts.push("\n" + buildTeamContext(teamData.data))
        logTiming("Team context", tTeam)
      }
    } catch {
      // Team context is optional
    }
  }

  if (formatId) {
    try {
      const tMeta = performance.now()
      const res = await fetch(`${BASE_URL}/api/formats/${formatId}/usage?limit=20`)
      if (res.ok) {
        const usageData = (await res.json()) as { data: UsageStatsEntry[] }
        parts.push("\n" + buildMetaContext(formatId, usageData.data))
        logTiming("Meta context", tMeta)
      }
    } catch {
      // Meta context is optional
    }
  }

  return parts
}

export async function streamChat(options: StreamChatOptions): Promise<ReadableStream<Uint8Array>> {
  const { messages, teamId, formatId, signal, context } = options

  const tStreamChat = performance.now()
  console.log(
    `${LOG_PREFIX} === streamChat START === teamId=${teamId ?? "none"} formatId=${formatId ?? "none"} messages=${messages.length}`,
  )

  // Build context parts
  const tCtx = performance.now()
  const contextParts = await buildContextParts(teamId, formatId)
  logTiming("Context building", tCtx)

  // Add page context if provided
  if (context) {
    const pageCtxStr = buildPageContextPrompt(context)
    if (pageCtxStr) {
      contextParts.push(pageCtxStr)
    }
  }

  // Add plan mode instructions
  contextParts.push(buildPlanModePrompt())

  const systemPrompt = [SYSTEM_PROMPT, ...contextParts].join("\n")
  console.log(`${LOG_PREFIX} CLI mode: system prompt ${systemPrompt.length} chars`)

  // Calculate disallowed MCP tools based on page context
  const disallowedMcpTools = context?.pageType
    ? getDisallowedMcpTools(context.pageType as PageType)
    : []

  const stream = streamCliChat({
    messages: messages.map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    })),
    systemPrompt,
    model: MODEL,
    signal,
    pageContext: context,
    disallowedMcpTools,
  })

  logTiming("=== streamChat setup ===", tStreamChat)
  return stream
}
