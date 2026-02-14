import {
  buildTeamContext,
  buildMetaContext,
  buildPageContextPrompt,
  buildContextModePrompt,
  buildPlanModePrompt,
  type PageContextData,
} from "./context-builder.service"
import {
  getDisallowedMcpTools,
  getDisallowedMcpToolsForContextMode,
  getAllMcpToolNames,
  type PageType,
} from "./tool-context"
import { streamCliChat } from "./cli-chat"
import type { ChatMessage, ChatRole } from "@nasty-plot/core"
import { getTeam } from "@nasty-plot/teams"
import { getUsageStats } from "@nasty-plot/smogon-data"
import { MODEL } from "./config"

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

interface StreamChatOptions {
  messages: ChatMessage[]
  teamId?: string
  formatId?: string
  signal?: AbortSignal
  context?: PageContextData
  contextMode?: string
  contextData?: string
  disableAllTools?: boolean
}

/**
 * Build the additional system prompt context (team data, format meta, etc.)
 */
async function buildContextParts(teamId?: string, formatId?: string): Promise<string[]> {
  const parts: string[] = []

  if (teamId) {
    try {
      const tTeam = performance.now()
      const teamData = await getTeam(teamId)
      if (teamData) {
        parts.push("\n" + buildTeamContext(teamData))
        logTiming("Team context", tTeam)
      }
    } catch {
      // Team context is optional
    }
  }

  if (formatId) {
    try {
      const tMeta = performance.now()
      const usageData = await getUsageStats(formatId, { limit: 20 })
      if (usageData.length > 0) {
        parts.push("\n" + buildMetaContext(formatId, usageData))
        logTiming("Meta context", tMeta)
      }
    } catch {
      // Meta context is optional
    }
  }

  return parts
}

/** Parse teamId/formatId from contextData JSON, merging with request-level IDs.
 *  When contextMode is set (context-locked session), frozen contextData takes priority.
 *  Otherwise, request-level IDs take priority over contextData fallbacks. */
function extractContextIds(
  contextData: string | undefined,
  contextMode: string | undefined,
  requestTeamId: string | undefined,
  requestFormatId: string | undefined,
): { teamId: string | undefined; formatId: string | undefined } {
  if (!contextData) return { teamId: requestTeamId, formatId: requestFormatId }

  let parsed: { teamId?: string; formatId?: string }
  try {
    parsed = JSON.parse(contextData)
  } catch {
    return { teamId: requestTeamId, formatId: requestFormatId }
  }

  // Context-locked: contextData wins; normal: request-level wins
  const [primary, fallback] = contextMode
    ? [parsed, { teamId: requestTeamId, formatId: requestFormatId }]
    : [{ teamId: requestTeamId, formatId: requestFormatId }, parsed]

  return {
    teamId: primary.teamId || fallback.teamId,
    formatId: primary.formatId || fallback.formatId,
  }
}

function resolveDisallowedTools(
  disableAll?: boolean,
  contextMode?: string,
  pageType?: PageType,
): string[] {
  if (disableAll) return getAllMcpToolNames()
  if (contextMode) return getDisallowedMcpToolsForContextMode(contextMode)
  if (pageType) return getDisallowedMcpTools(pageType)
  return []
}

export async function streamChat(options: StreamChatOptions): Promise<ReadableStream<Uint8Array>> {
  const { messages, signal, context, contextMode, contextData, disableAllTools } = options

  const { teamId, formatId } = extractContextIds(
    contextData,
    contextMode,
    options.teamId,
    options.formatId,
  )

  const tStreamChat = performance.now()
  console.log(
    `${LOG_PREFIX} === streamChat START === teamId=${teamId ?? "none"} formatId=${formatId ?? "none"} contextMode=${contextMode ?? "none"} messages=${messages.length}`,
  )

  // Build context parts
  const tCtx = performance.now()
  const contextParts = await buildContextParts(teamId, formatId)
  logTiming("Context building", tCtx)

  // Add context mode prompt if session is context-locked
  if (contextMode) {
    const modePrompt = buildContextModePrompt(contextMode, contextData)
    if (modePrompt) {
      contextParts.push(modePrompt)
    }
  }

  // Add page context: full page context when not locked, or for guided-builder;
  // otherwise just include the summary
  if (context) {
    const isGuidedBuilder = contextMode === "guided-builder" && context.guidedBuilder
    if (!contextMode || isGuidedBuilder) {
      const pageCtxStr = buildPageContextPrompt(context)
      if (pageCtxStr) contextParts.push(pageCtxStr)
    } else if (context.contextSummary) {
      contextParts.push(`\n## Live State\n${context.contextSummary}\n`)
    }
  }

  // Add plan mode instructions
  contextParts.push(buildPlanModePrompt())

  const systemPrompt = [SYSTEM_PROMPT, ...contextParts].join("\n")
  console.log(`${LOG_PREFIX} CLI mode: system prompt ${systemPrompt.length} chars`)

  const disallowedMcpTools = resolveDisallowedTools(
    disableAllTools,
    contextMode,
    context?.pageType as PageType | undefined,
  )

  const stream = streamCliChat({
    messages: messages.map((m) => ({
      role: m.role as ChatRole,
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
