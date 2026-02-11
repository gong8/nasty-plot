"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { useChatSidebar } from "@/features/chat/context/chat-provider"
import { usePageContext } from "@/features/chat/context/page-context-provider"
import { useBattleStateContext } from "@/features/battle/context/battle-state-context"
import { ContextModeBadge } from "./context-mode-badge"
import { MessageCircle, Lock, Globe, Loader2 } from "lucide-react"
import type { ChatContextMode, ChatSessionData } from "@nasty-plot/core"

const PAGE_TO_CONTEXT_MODE: Record<string, ChatContextMode> = {
  "guided-builder": "guided-builder",
  "team-editor": "team-editor",
  "battle-live": "battle-live",
  "battle-replay": "battle-replay",
}

const CONTEXT_MODE_LABELS: Record<ChatContextMode, string> = {
  "guided-builder": "Team Building Advisor",
  "team-editor": "Team Optimization Expert",
  "battle-live": "Battle Coach",
  "battle-replay": "Replay Analyst",
}

export function NewChatModal() {
  const {
    showNewChatModal,
    closeNewChatModal,
    switchSession,
    openContextChat,
    newSession,
    openSidebar,
    pendingQuestion,
    clearPendingQuestion,
  } = useChatSidebar()
  const pageContext = usePageContext()
  const { battleState } = useBattleStateContext()
  const [existingSessions, setExistingSessions] = useState<ChatSessionData[]>([])
  const [loading, setLoading] = useState(false)

  const contextMode = PAGE_TO_CONTEXT_MODE[pageContext.pageType]
  const hasContextOption = !!contextMode

  // Fetch existing sessions for this context when modal opens

  useEffect(() => {
    if (!showNewChatModal || !contextMode) {
      return
    }

    let cancelled = false
    setLoading(true) // eslint-disable-line react-hooks/set-state-in-effect -- loading state for async fetch
    const params = new URLSearchParams({ contextMode })
    fetch(`/api/chat/sessions?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        // Filter to sessions matching the current entity (team or battle)
        const sessions: ChatSessionData[] = data.data ?? []
        const filtered = sessions.filter((s) => {
          if (!s.contextData) return false
          try {
            const ctx = JSON.parse(s.contextData)
            if (pageContext.teamId && ctx.teamId) return ctx.teamId === pageContext.teamId
            if (pageContext.battleId && ctx.battleId) return ctx.battleId === pageContext.battleId
            return true
          } catch {
            return false
          }
        })
        setExistingSessions(filtered)
      })
      .catch(() => {
        if (!cancelled) setExistingSessions([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [showNewChatModal, contextMode, pageContext.teamId, pageContext.battleId])

  function handleResume(sessionId: string) {
    switchSession(sessionId)
    if (pendingQuestion) {
      openSidebar(pendingQuestion)
      clearPendingQuestion()
    } else {
      openSidebar()
    }
    closeNewChatModal()
  }

  function handleNewContextChat() {
    if (!contextMode) return

    const contextData = buildContextData()
    openContextChat({
      contextMode,
      contextData: JSON.stringify(contextData),
    })
    if (pendingQuestion) {
      openSidebar(pendingQuestion)
      clearPendingQuestion()
    }
    closeNewChatModal()
  }

  function handleNewGeneralChat() {
    newSession()
    if (pendingQuestion) {
      openSidebar(pendingQuestion)
      clearPendingQuestion()
    } else {
      openSidebar()
    }
    closeNewChatModal()
  }

  function buildContextData(): Record<string, unknown> {
    const data: Record<string, unknown> = {}

    if (contextMode === "guided-builder" || contextMode === "team-editor") {
      if (pageContext.teamId) data.teamId = pageContext.teamId
      if (pageContext.teamData) {
        data.teamName = pageContext.teamData.name
        data.formatId = pageContext.teamData.formatId

        // Include team composition so the LLM has slot info even if server fetch fails
        const slots = pageContext.teamData.slots
        data.slotsFilled = slots.length
        data.slots = slots.map((slot) => {
          const name = slot.species?.name ?? slot.pokemonId
          const types = slot.species?.types.join("/") ?? "Unknown"
          const moves = slot.moves.filter(Boolean).join(", ") || "None"
          return `${name} (${types}) - ${moves}`
        })
      }
      if (pageContext.formatId) data.formatId = pageContext.formatId
    }

    if (contextMode === "battle-live") {
      if (pageContext.formatId) data.formatId = pageContext.formatId
      if (battleState) {
        data.gameType = battleState.format
        data.team1Name = battleState.sides.p1.name
        data.team2Name = battleState.sides.p2.name
      }
    }

    if (contextMode === "battle-replay") {
      if (pageContext.battleId) data.battleId = pageContext.battleId
    }

    return data
  }

  return (
    <Dialog
      open={showNewChatModal}
      onOpenChange={(open) => {
        if (!open) {
          clearPendingQuestion()
          closeNewChatModal()
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1025.png"
              alt="Pecharunt"
              width={24}
              height={24}
              className="pixelated"
            />
            New Chat
          </DialogTitle>
          <DialogDescription>Choose how you want to chat with Pecharunt.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Existing context sessions */}
          {hasContextOption && existingSessions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Resume existing
              </p>
              {existingSessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => handleResume(session.id)}
                  className="w-full text-left px-3 py-2 rounded-md border hover:bg-accent transition-colors flex items-center gap-2"
                >
                  <MessageCircle className="h-3.5 w-3.5 shrink-0 opacity-50" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{session.title || "Untitled chat"}</div>
                  </div>
                  {session.contextMode && <ContextModeBadge mode={session.contextMode} />}
                </button>
              ))}
            </div>
          )}

          {hasContextOption && loading && (
            <div className="flex items-center justify-center py-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* New context-locked chat */}
          {hasContextOption && (
            <>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                New chat
              </p>
              <button
                onClick={handleNewContextChat}
                className="w-full text-left px-3 py-3 rounded-md border hover:bg-accent transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{CONTEXT_MODE_LABELS[contextMode]}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Context-locked to this {contextMode.includes("battle") ? "battle" : "team"}.
                      {contextMode.includes("battle")
                        ? " Can look up data and analyze, but cannot modify teams."
                        : " Full access to all tools."}
                    </div>
                  </div>
                  <ContextModeBadge mode={contextMode} />
                </div>
              </button>
            </>
          )}

          {/* General chat */}
          <button
            onClick={handleNewGeneralChat}
            className="w-full text-left px-3 py-3 rounded-md border hover:bg-accent transition-colors"
          >
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex-1">
                <div className="text-sm font-medium">General Chat</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Standard Pecharunt with full tool access, no context lock.
                </div>
              </div>
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
