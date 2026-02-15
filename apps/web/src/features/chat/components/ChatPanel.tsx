"use client"

import { useRef, useEffect, useCallback, useState, useMemo } from "react"
import { useChatSidebar } from "@/features/chat/context/ChatProvider"
import { useChatStream } from "@/features/chat/hooks/use-chat-stream"
import { useContextMismatch } from "@/features/chat/hooks/use-context-mismatch"
import { useBuildContextData } from "@/features/chat/hooks/use-build-context-data"
import { ChatMessage } from "./ChatMessage"
import { ChatToolCall } from "./ChatToolCall"
import { ChatActionNotify } from "./ChatActionNotify"
import { ChatPlanDisplay } from "./ChatPlanDisplay"
import { ChatInput } from "./ChatInput"
import { ChatContextPicker } from "./ChatContextPicker"
import { ChatWizardEvent } from "./ChatWizardEvent"
import { TurnAnalysisCard } from "./TurnAnalysisCard"
import { ChatGuidedPrompts } from "./ChatGuidedPrompts"
import { ArrowDown, Zap, Search, X, Pencil, Check } from "lucide-react"
import type { ChatStreamOptions } from "@/features/chat/hooks/use-chat-stream"
import type { ChatLayoutMode } from "./ChatSessionList"
import { cn } from "@nasty-plot/ui"
import { FeatureErrorBoundary } from "@/components/FeatureErrorBoundary"
import { PECHARUNT_SPRITE_URL } from "@/lib/constants"

const SCROLL_BOTTOM_THRESHOLD = 60

function QueuedMessageBubble({
  message,
  onClear,
  onUpdate,
}: {
  message: string
  onClear: () => void
  onUpdate: (text: string) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(message)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isEditing) textareaRef.current?.focus()
  }, [isEditing])

  // Sync edit text when the queued message changes externally (e.g. re-queued)
  useEffect(() => {
    setEditText(message)
  }, [message])

  const handleConfirmEdit = () => {
    const trimmed = editText.trim()
    if (trimmed) {
      onUpdate(trimmed)
      setIsEditing(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mr-1">
        Queued
      </span>
      <div className="max-w-[85%] rounded-2xl rounded-br-md border-2 border-dashed border-primary/30 bg-primary/5 px-4 py-2.5 opacity-75">
        {isEditing ? (
          <div className="flex flex-col gap-2">
            <textarea
              ref={textareaRef}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleConfirmEdit()
                }
                if (e.key === "Escape") setIsEditing(false)
              }}
              className="w-full min-w-[200px] resize-none rounded border border-border bg-background p-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              rows={2}
            />
            <div className="flex gap-1 justify-end">
              <button
                onClick={() => setIsEditing(false)}
                className="p-1 rounded hover:bg-muted text-muted-foreground"
                title="Cancel"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={handleConfirmEdit}
                className="p-1 rounded hover:bg-primary/10 text-primary"
                title="Confirm"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2">
            <p className="text-sm whitespace-pre-wrap flex-1">{message}</p>
            <div className="flex gap-0.5 shrink-0 mt-0.5">
              <button
                onClick={() => setIsEditing(true)}
                className="p-1 rounded hover:bg-muted text-muted-foreground"
                title="Edit queued message"
              >
                <Pencil className="h-3 w-3" />
              </button>
              <button
                onClick={onClear}
                className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                title="Remove queued message"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

interface ChatPanelProps {
  teamId?: string
  formatId?: string
  sessionId?: string
  mode?: ChatLayoutMode
}

export function ChatPanel({ sessionId }: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const {
    activeSessionId,
    pendingInput,
    clearPendingInput,
    pendingContext,
    newSession,
    autoAnalyze,
    setAutoAnalyzeDepth,
    guidedBuilderContextRef,
    guidedActionNotifyRef,
    autoSendMessage,
    clearAutoSend,
    setIsChatStreaming,
    guidedBuilderStep,
    guidedBuilderTeamSize,
  } = useChatSidebar()
  const effectiveSessionId = sessionId ?? activeSessionId ?? undefined
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [modeChosen, setModeChosen] = useState(false)

  const { mismatch } = useContextMismatch()
  const { hasContext } = useBuildContextData()

  // Auto-clear mismatched context-locked sessions — show picker instead of stale chat
  useEffect(() => {
    if (mismatch) {
      newSession()
    }
  }, [mismatch, newSession])

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
    queuedMessage,
    sendMessage,
    stopGeneration,
    retryLast,
    resetForSession,
    clearQueuedMessage,
    updateQueuedMessage,
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
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_BOTTOM_THRESHOLD
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
  }, [messages, toolCalls, planSteps, queuedMessage, isAtBottom])

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

  const lastMessage = messages[messages.length - 1]

  // Show the context picker for brand-new chats on contextual pages (team/battle).
  // Non-contextual pages skip directly to global chat since there's nothing to choose.
  const showPicker =
    messages.length === 0 && !modeChosen && !effectiveSessionId && !pendingContext && hasContext

  return (
    <FeatureErrorBoundary>
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
          <div className="space-y-4 max-w-3xl mx-auto">
            {showPicker && <ChatContextPicker onModeChosen={() => setModeChosen(true)} />}

            {messages.length === 0 && !showPicker && (
              <div className="text-center py-12">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={PECHARUNT_SPRITE_URL}
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
                    isStreaming={isStreaming && msg === lastMessage}
                  />
                )
              }

              return (
                <ChatMessage
                  key={msg.id}
                  role={msg.role}
                  content={msg.content}
                  isStreaming={isStreaming && msg === lastMessage}
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

            {/* Queued message */}
            {queuedMessage && (
              <QueuedMessageBubble
                message={queuedMessage}
                onClear={clearQueuedMessage}
                onUpdate={updateQueuedMessage}
              />
            )}

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

        {/* Guided builder prompt suggestions */}
        {!showPicker && guidedBuilderStep && (
          <ChatGuidedPrompts
            step={guidedBuilderStep}
            teamSize={guidedBuilderTeamSize}
            onSend={handleSend}
            isStreaming={isStreaming}
          />
        )}

        {/* Input area — hidden while the context picker is showing */}
        {!showPicker && (
          <ChatInput
            onSend={handleSend}
            onStop={stopGeneration}
            onRetry={retryLast}
            isStreaming={isStreaming}
            hasMessages={messages.length > 0}
            lastMessageIsAssistant={lastMessage?.role === "assistant"}
            pendingInput={pendingInput}
            onClearPendingInput={clearPendingInput}
            queuedMessage={queuedMessage}
          />
        )}
      </div>
    </FeatureErrorBoundary>
  )
}
