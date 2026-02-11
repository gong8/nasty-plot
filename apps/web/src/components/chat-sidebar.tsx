"use client"

import { useState } from "react"
import { useChatSidebar } from "@/features/chat/context/chat-provider"
import { useChatSession } from "@/features/chat/hooks/use-chat-sessions"
import { ContextModeBadge } from "@/features/chat/components/context-mode-badge"
import { ChatSidebarResizeHandle } from "./chat-sidebar-resize-handle"
import { ChatPanel } from "@/features/chat/components/chat-panel"
import { ChatSessionList } from "@/features/chat/components/chat-session-list"
import { NewChatModal } from "@/features/chat/components/new-chat-modal"
import { X, History, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ChatSidebarProps {
  fullPage?: boolean
}

export function ChatSidebar({ fullPage = false }: ChatSidebarProps) {
  const { isOpen, width, closeSidebar, activeSessionId, openNewChatModal, pendingContext } =
    useChatSidebar()
  const { data: activeSession } = useChatSession(activeSessionId)
  const [showHistory, setShowHistory] = useState(false)

  const contextMode = activeSession?.contextMode ?? pendingContext?.contextMode

  // Full-page mode: static layout with session list on the left
  if (fullPage) {
    return (
      <div className="flex flex-1 min-h-0">
        <ChatSessionList mode="fullpage" />
        <div className="flex-1 min-w-0 flex flex-col">
          <ChatPanel sessionId={activeSessionId ?? undefined} mode="fullpage" />
        </div>
      </div>
    )
  }

  // Sidebar mode: fixed position, right side.
  // Keep mounted (hidden via CSS) so ChatPanel hooks preserve messages across close/open.
  return (
    <div
      className="fixed top-0 right-0 bottom-0 z-[60] flex flex-col border-l border-border bg-background dark:bg-card/95 dark:backdrop-blur-xl overscroll-contain"
      style={{ width, display: isOpen ? undefined : "none" }}
    >
      <ChatSidebarResizeHandle />

      {/* Sidebar header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setShowHistory((prev) => !prev)}
            title="Chat history"
          >
            <History className="h-4 w-4" />
          </Button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1025.png"
            alt="Pecharunt"
            width={20}
            height={20}
            className="pixelated"
          />
          <span className="text-sm font-semibold">Pecharunt</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={openNewChatModal}
            title="New chat"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={closeSidebar}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Context-locked indicator */}
      {contextMode && (
        <div className="px-3 py-1.5 border-b border-border bg-muted/30 text-xs text-muted-foreground flex items-center gap-1.5">
          <ContextModeBadge mode={contextMode} />
          <span>Context-locked</span>
        </div>
      )}

      {/* Session list (collapsible in sidebar mode) */}
      {showHistory && (
        <div className="border-b border-border max-h-[40%] overflow-hidden flex flex-col">
          <ChatSessionList mode="sidebar" onSelect={() => setShowHistory(false)} />
        </div>
      )}

      {/* Chat panel */}
      <div className="flex-1 min-h-0">
        <ChatPanel sessionId={activeSessionId ?? undefined} mode="sidebar" />
      </div>

      <NewChatModal />
    </div>
  )
}
