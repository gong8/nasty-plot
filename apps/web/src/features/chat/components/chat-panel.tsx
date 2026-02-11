"use client"

import { useRef, useEffect, useCallback, useState, useMemo } from "react"
import { useChatSidebar } from "@/features/chat/context/chat-provider"
import { useChatStream } from "@/features/chat/hooks/use-chat-stream"
import { useContextMismatch } from "@/features/chat/hooks/use-context-mismatch"
import { ChatMessage } from "./chat-message"
import { ChatToolCall } from "./chat-tool-call"
import { ChatActionNotify } from "./chat-action-notify"
import { ChatPlanDisplay } from "./chat-plan-display"
import { ChatInput } from "./chat-input"
import { ChatContextPicker } from "./chat-context-picker"
import { ContextMismatchBanner } from "./context-mismatch-banner"
import { ChatWizardEvent } from "./chat-wizard-event"
import { TurnAnalysisCard } from "./turn-analysis-card"
import { ArrowDown, Zap, Search } from "lucide-react"
import type { ChatStreamOptions } from "@/features/chat/hooks/use-chat-stream"
import { cn } from "@/lib/utils"

interface ChatPanelProps {
  teamId?: string
  formatId?: string
  sessionId?: string
  mode?: "sidebar" | "fullpage"
}

export function ChatPanel({ sessionId }: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const {
    activeSessionId,
    pendingInput,
    clearPendingInput,
    pendingContext,
    autoAnalyze,
    setAutoAnalyzeDepth,
    guidedBuilderContextRef,
    guidedActionNotifyRef,
    autoSendMessage,
    clearAutoSend,
    setIsChatStreaming,
  } = useChatSidebar()
  const effectiveSessionId = sessionId ?? activeSessionId ?? undefined
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [modeChosen, setModeChosen] = useState(false)

  const { mismatch } = useContextMismatch()

  // Stable action notify callback that delegates to guided builder ref
  const actionNotifyCallback = useCallback<NonNullable<ChatStreamOptions["onActionNotify"]>>(
    (notification) => {
      guidedActionNotifyRef.current?.(notification)
    },
    [guidedActionNotifyRef],
  )

  const streamOptions = useMemo<ChatStreamOptions>(
    () => ({ onActionNotify: actionNotifyCallback }),
    [actionNotifyCallback],
  )

  const {
    messages,
    isStreaming,
    toolCalls,
    actionNotifications,
    planSteps,
    sendMessage,
    stopGeneration,
    retryLast,
    resetForSession,
  } = useChatStream(effectiveSessionId, streamOptions)

  // Sync streaming state to ChatProvider for guided builder proactive reactions
  useEffect(() => {
    setIsChatStreaming(isStreaming)
  }, [isStreaming, setIsChatStreaming])

  // Auto-send queued messages from guided builder (proactive reactions)
  useEffect(() => {
    if (autoSendMessage && !isStreaming) {
      const ctx = guidedBuilderContextRef.current
      sendMessage(autoSendMessage, false, ctx ? { guidedBuilder: ctx } : undefined)
      clearAutoSend()
    }
  }, [autoSendMessage, isStreaming, sendMessage, guidedBuilderContextRef, clearAutoSend])

  // Load session on mount and when active session changes.
  // Initialize to null (not effectiveSessionId) so the first render
  // triggers a load when there's already an active session from localStorage.
  const prevSessionRef = useRef<string | undefined | null>(null)
  useEffect(() => {
    if (effectiveSessionId !== prevSessionRef.current) {
      prevSessionRef.current = effectiveSessionId
      resetForSession(effectiveSessionId ?? null)
      setIsAtBottom(true) // eslint-disable-line react-hooks/set-state-in-effect -- reset scroll on session change
    }
  }, [effectiveSessionId, resetForSession])

  // Track scroll position to detect if user has scrolled up
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const handleScroll = () => {
      const threshold = 60
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold
      setIsAtBottom(atBottom)
    }

    el.addEventListener("scroll", handleScroll, { passive: true })
    return () => el.removeEventListener("scroll", handleScroll)
  }, [])

  // Auto-scroll only when user is at the bottom
  useEffect(() => {
    if (isAtBottom) {
      bottomRef.current?.scrollIntoView({ behavior: "instant" })
    }
  }, [messages, toolCalls, planSteps, isAtBottom])

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    setIsAtBottom(true)
  }, [])

  const handleSend = useCallback(
    (text: string) => {
      const ctx = guidedBuilderContextRef.current
      return sendMessage(text, false, ctx ? { guidedBuilder: ctx } : undefined)
    },
    [sendMessage, guidedBuilderContextRef],
  )

  // Reset mode choice when switching to a different session
  const [prevSessionForMode, setPrevSessionForMode] = useState(effectiveSessionId)
  if (effectiveSessionId !== prevSessionForMode) {
    setPrevSessionForMode(effectiveSessionId)
    setModeChosen(false)
  }

  const lastMsg = messages[messages.length - 1]

  // Show the context picker for brand-new chats (no session, no messages, no pending context)
  const showPicker = messages.length === 0 && !modeChosen && !effectiveSessionId && !pendingContext

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Auto-analyze depth toggle bar */}
      {autoAnalyze.enabled && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-accent/20 shrink-0">
          <Zap className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium text-foreground">Auto-Analyze</span>
          <div className="flex gap-1 ml-auto">
            <button
              onClick={() => setAutoAnalyzeDepth("quick")}
              className={cn(
                "px-2 py-0.5 rounded-full text-xs font-medium transition-colors",
                autoAnalyze.depth === "quick"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80",
              )}
            >
              <Zap className="h-3 w-3 inline mr-0.5" />
              Quick
            </button>
            <button
              onClick={() => setAutoAnalyzeDepth("deep")}
              className={cn(
                "px-2 py-0.5 rounded-full text-xs font-medium transition-colors",
                autoAnalyze.depth === "deep"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80",
              )}
            >
              <Search className="h-3 w-3 inline mr-0.5" />
              Deep
            </button>
          </div>
        </div>
      )}

      {/* Messages — native scrollable div */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain p-4">
        <div className="space-y-4">
          {showPicker && <ChatContextPicker onModeChosen={() => setModeChosen(true)} />}

          {messages.length === 0 && !showPicker && (
            <div className="text-center py-12">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1025.png"
                alt="Pecharunt"
                width={64}
                height={64}
                className="pixelated mx-auto mb-3"
              />
              <p className="text-lg font-medium text-foreground">Pecharunt&apos;s Team Lab</p>
              <p className="text-sm mt-1 text-muted-foreground">
                Ask about competitive sets, damage calcs, meta trends, and team synergy.
              </p>
            </div>
          )}

          {messages.map((msg) => {
            // Hide auto-generated user messages
            if (msg.role === "user" && msg.metadata?.autoGenerated) return null

            // Render [WIZARD_EVENT] messages with distinct style
            if (msg.role === "user" && msg.content.startsWith("[WIZARD_EVENT]")) {
              return <ChatWizardEvent key={msg.id} content={msg.content} />
            }

            // Render auto-generated assistant messages as TurnAnalysisCard
            if (msg.role === "assistant" && msg.metadata?.autoGenerated) {
              return (
                <TurnAnalysisCard
                  key={msg.id}
                  turn={msg.metadata.turn ?? 0}
                  content={msg.content}
                  depth={msg.metadata.depth ?? "quick"}
                  isStreaming={isStreaming && msg === lastMsg}
                />
              )
            }

            return (
              <ChatMessage
                key={msg.id}
                role={msg.role}
                content={msg.content}
                isStreaming={isStreaming && msg === lastMsg}
              />
            )
          })}

          {/* Plan display */}
          <ChatPlanDisplay steps={planSteps} />

          {/* Tool calls */}
          {Array.from(toolCalls.values()).map((tc) => (
            <ChatToolCall key={tc.name} toolCall={tc} />
          ))}

          {/* Action notifications */}
          {actionNotifications.map((notif, i) => (
            <ChatActionNotify key={`${notif.name}-${i}`} notification={notif} />
          ))}

          {/* Scroll anchor */}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Scroll to bottom button */}
      {!isAtBottom && (
        <div className="relative">
          <button
            onClick={scrollToBottom}
            className="absolute -top-10 left-1/2 -translate-x-1/2 z-10 flex items-center justify-center h-8 w-8 rounded-full border border-border bg-background shadow-md hover:bg-accent transition-colors"
            title="Scroll to bottom"
          >
            <ArrowDown className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* Context mismatch warning */}
      {mismatch && <ContextMismatchBanner mismatch={mismatch} />}

      {/* Input area — hidden while the context picker is showing */}
      {!showPicker && (
        <ChatInput
          onSend={handleSend}
          onStop={stopGeneration}
          onRetry={retryLast}
          isStreaming={isStreaming}
          hasMessages={messages.length > 0}
          lastMessageIsAssistant={lastMsg?.role === "assistant"}
          pendingInput={pendingInput}
          onClearPendingInput={clearPendingInput}
          disabled={!!mismatch}
        />
      )}
    </div>
  )
}
