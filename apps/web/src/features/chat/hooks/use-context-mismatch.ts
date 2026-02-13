"use client"

import { useMemo } from "react"
import { useChatSidebar } from "@/features/chat/context/chat-provider"
import { usePageContext } from "@/features/chat/context/page-context-provider"
import { useChatSession } from "@/features/chat/hooks/use-chat-sessions"
import type { ChatContextMode } from "@nasty-plot/core"

export interface ContextMismatch {
  type: "team" | "battle"
  contextMode: ChatContextMode
  expectedEntityName: string
  navigationUrl: string
}

function buildNavigationUrl(
  contextMode: ChatContextMode,
  ctxData: Record<string, unknown>,
): string {
  switch (contextMode) {
    case "team-editor":
      return `/teams/${ctxData.teamId}`
    case "guided-builder":
      return `/teams/${ctxData.teamId}/guided`
    case "battle-live":
      return "/battle/live"
    case "battle-replay":
      return `/battle/replay/${ctxData.battleId}`
  }
}

function getEntityName(contextMode: ChatContextMode, ctxData: Record<string, unknown>): string {
  switch (contextMode) {
    case "team-editor":
    case "guided-builder":
      return (ctxData.teamName as string) || "Team"
    case "battle-live":
    case "battle-replay":
      return `${ctxData.team1Name || "Team 1"} vs ${ctxData.team2Name || "Team 2"}`
  }
}

export function useContextMismatch(): { mismatch: ContextMismatch | null; isLoading: boolean } {
  const { activeSessionId } = useChatSidebar()
  const pageContext = usePageContext()
  const { data: session, isLoading } = useChatSession(activeSessionId)

  const mismatch = useMemo<ContextMismatch | null>(() => {
    if (!session?.contextMode || !session.contextData) return null

    const contextMode = session.contextMode as ChatContextMode
    let ctxData: Record<string, unknown>
    try {
      ctxData = JSON.parse(session.contextData)
    } catch {
      return null
    }

    const matchesCurrentPage = (): boolean => {
      switch (contextMode) {
        case "team-editor":
        case "guided-builder": {
          const frozenTeamId = typeof ctxData.teamId === "string" ? ctxData.teamId : undefined
          return !!frozenTeamId && pageContext.teamId === frozenTeamId
        }
        case "battle-live":
          return pageContext.pageType === "battle-live"
        case "battle-replay": {
          const frozenBattleId = typeof ctxData.battleId === "string" ? ctxData.battleId : undefined
          return (
            !!frozenBattleId &&
            pageContext.battleId === frozenBattleId &&
            pageContext.pageType === "battle-replay"
          )
        }
        default:
          return true
      }
    }

    if (matchesCurrentPage()) return null

    return {
      type: contextMode.includes("battle") ? "battle" : "team",
      contextMode,
      expectedEntityName: getEntityName(contextMode, ctxData),
      navigationUrl: buildNavigationUrl(contextMode, ctxData),
    }
  }, [session, pageContext])

  return { mismatch, isLoading }
}
