/**
 * Browser-safe exports from the LLM package.
 * Use this entry point in client components to avoid pulling in Node-only modules
 * (child_process, fs, prisma, etc.) via the main barrel export.
 */

export {
  buildTurnCommentaryContext,
  buildPostBattleContext,
  buildTurnAnalysisContext,
  buildAutoAnalyzePrompt,
} from "./battle-context-builder.service"
export type { BattleCommentaryContext } from "./battle-context-builder.service"

export { buildPageContextPrompt, buildContextModePrompt } from "./context-builder.service"
export type { PageContextData } from "./context-builder.service"

export { getToolLabel, isWriteTool } from "./tool-labels"

export type { SSEEvent } from "./sse-events"

export type {
  ChatMessage,
  ChatSessionData,
  ChatRole,
  ChatMessageMetadata,
  AutoAnalyzeDepth,
} from "@nasty-plot/core"
