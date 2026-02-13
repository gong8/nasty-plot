"use client"

import { useState, useMemo } from "react"
import { MessageCircle, Trash2 } from "lucide-react"
import { useChatSidebar } from "@/features/chat/context/chat-provider"
import { usePageContext } from "@/features/chat/context/page-context-provider"
import { useChatSessions, useDeleteChatSession } from "@/features/chat/hooks/use-chat-sessions"
import { ContextModeBadge } from "./context-mode-badge"
import { cn } from "@nasty-plot/ui"
import { EmptyState } from "@/components/empty-state"
import { LoadingSpinner } from "@/components/loading-spinner"
import { timeAgo } from "@/lib/format-time"
import type { ChatSessionData, PageType } from "@nasty-plot/core"

const PREVIEW_MAX_LENGTH = 50

function truncatePreview(content?: string): string | undefined {
  if (!content) return undefined
  return content.length > PREVIEW_MAX_LENGTH
    ? content.slice(0, PREVIEW_MAX_LENGTH) + "..."
    : content
}

/** Page types that are context-locked (have associated sessions with frozen context) */
const CONTEXTUAL_PAGE_TYPES: PageType[] = [
  "team-editor",
  "guided-builder",
  "battle-live",
  "battle-replay",
]

function isContextualPage(pageType: PageType): boolean {
  return CONTEXTUAL_PAGE_TYPES.includes(pageType)
}

function sessionMatchesPage(
  session: ChatSessionData,
  pageType: PageType,
  teamId?: string,
  battleId?: string,
): boolean {
  // General sessions (no context mode) always match
  if (!session.contextMode) return true

  // Context-locked session — check if it matches the current page
  if (session.contextMode !== pageType) return false

  if (!session.contextData) return false
  try {
    const ctxData = JSON.parse(session.contextData)
    switch (session.contextMode) {
      case "team-editor":
      case "guided-builder":
        return ctxData.teamId === teamId
      case "battle-live":
        return true // page type match is enough
      case "battle-replay":
        return ctxData.battleId === battleId
      default:
        return false
    }
  } catch {
    return false
  }
}

interface ChatSessionListProps {
  mode: "sidebar" | "fullpage"
  onSelect?: () => void
}

export function ChatSessionList({ mode, onSelect }: ChatSessionListProps) {
  const { activeSessionId, switchSession, newSession } = useChatSidebar()
  const pageContext = usePageContext()
  const { data: sessions, isLoading } = useChatSessions()
  const deleteSessionMutation = useDeleteChatSession()
  const [showAll, setShowAll] = useState(false)

  const isOnContextualPage = isContextualPage(pageContext.pageType)

  const filteredSessions = useMemo(() => {
    if (!sessions) return undefined
    if (!isOnContextualPage || showAll) return sessions
    return sessions.filter((s) =>
      sessionMatchesPage(s, pageContext.pageType, pageContext.teamId, pageContext.battleId),
    )
  }, [
    sessions,
    isOnContextualPage,
    showAll,
    pageContext.pageType,
    pageContext.teamId,
    pageContext.battleId,
  ])

  const hiddenCount = sessions && filteredSessions ? sessions.length - filteredSessions.length : 0

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (activeSessionId === id) {
      newSession()
    }
    deleteSessionMutation.mutate(id)
  }

  return (
    <div
      className={cn(
        "flex flex-col border-r border-border bg-background/50",
        mode === "fullpage" ? "w-64 shrink-0" : "w-full",
      )}
    >
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="p-1">
          {/* Filter toggle for contextual pages */}
          {isOnContextualPage && sessions && sessions.length > 0 && (
            <div className="px-3 py-1.5">
              <button
                onClick={() => setShowAll(!showAll)}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                {showAll
                  ? "Show relevant"
                  : `Show all${hiddenCount > 0 ? ` (+${hiddenCount})` : ""}`}
              </button>
            </div>
          )}

          {isLoading && <LoadingSpinner size="sm" className="py-4" />}
          {filteredSessions?.map((session) => {
            const isActive = session.id === activeSessionId
            const preview =
              session.title || truncatePreview(session.messages[0]?.content) || "New Chat"

            return (
              <div
                key={session.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  switchSession(session.id)
                  onSelect?.()
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    switchSession(session.id)
                    onSelect?.()
                  }
                }}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-md text-sm group flex items-start gap-2 transition-colors cursor-pointer",
                  isActive ? "bg-accent text-accent-foreground" : "hover:bg-muted/50",
                )}
              >
                <MessageCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 opacity-50" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-medium">{preview}</span>
                    {session.contextMode && <ContextModeBadge mode={session.contextMode} />}
                  </div>
                  <div className="text-xs text-muted-foreground">{timeAgo(session.updatedAt)}</div>
                </div>
                <button
                  onClick={(e) => handleDelete(session.id, e)}
                  className="opacity-0 group-hover:opacity-100 shrink-0 p-0.5 rounded hover:bg-destructive/20 transition-opacity"
                  title="Delete session"
                >
                  <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            )
          })}
          {filteredSessions && filteredSessions.length === 0 && !isLoading && (
            <EmptyState className="px-3 py-4 text-sm">
              {isOnContextualPage && !showAll ? "No chats for this page" : "No chat history yet"}
            </EmptyState>
          )}
        </div>
      </div>
    </div>
  )
}
