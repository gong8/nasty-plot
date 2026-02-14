"use client"

import { useState } from "react"
import { useChatSidebar } from "@/features/chat/context/chat-provider"
import { useChatSession } from "@/features/chat/hooks/use-chat-sessions"
import { ContextModeBadge } from "@/features/chat/components/context-mode-badge"
import { ChatSidebarResizeHandle } from "./chat-sidebar-resize-handle"
import { ChatPanel } from "@/features/chat/components/chat-panel"
import { ChatSessionList } from "@/features/chat/components/chat-session-list"
import { X, History, Plus, Maximize2, Minimize2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PECHARUNT_SPRITE_URL } from "@/lib/constants"

interface ChatSidebarProps {
  fullPage?: boolean
}

export function ChatSidebar({ fullPage = false }: ChatSidebarProps) {
  const {
    isOpen,
    width,
    isFullscreen,
    closeSidebar,
    toggleFullscreen,
    activeSessionId,
    newSession,
    pendingContext,
  } = useChatSidebar()
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
  const sidebarWidth = isFullscreen ? "100vw" : width

  return (
    <div
      className="fixed top-0 right-0 bottom-0 z-[60] flex border-l border-border bg-background dark:bg-card/95 dark:backdrop-blur-xl overscroll-contain"
      style={{ width: sidebarWidth, display: isOpen ? undefined : "none" }}
    >
      {/* Session list — always visible as left column in fullscreen */}
      {isFullscreen && (
        <div className="w-64 shrink-0 border-r border-border flex flex-col min-h-0 overflow-hidden">
          <ChatSessionList mode="sidebar" />
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        {!isFullscreen && <ChatSidebarResizeHandle />}

        {/* Sidebar header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <div className="flex items-center gap-2">
            {!isFullscreen && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setShowHistory((prev) => !prev)}
                title="Chat history"
              >
                <History className="h-4 w-4" />
              </Button>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={PECHARUNT_SPRITE_URL}
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
              onClick={newSession}
              title="New chat"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={closeSidebar}
              title="Close chat"
            >
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

        {/* Session list (collapsible in sidebar mode, hidden in fullscreen — shown as left column) */}
        {!isFullscreen && showHistory && (
          <div className="border-b border-border max-h-[40%] overflow-hidden flex flex-col">
            <ChatSessionList mode="sidebar" onSelect={() => setShowHistory(false)} />
          </div>
        )}

        {/* Chat panel */}
        <div className="flex-1 min-h-0">
          <ChatPanel sessionId={activeSessionId ?? undefined} mode="sidebar" />
        </div>
      </div>
    </div>
  )
}
