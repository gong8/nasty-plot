"use client"

import { useRef, useEffect } from "react"
import { usePageContext } from "@/features/chat/context/PageContextProvider"
import { useChatSidebar } from "@/features/chat/context/ChatProvider"
import { useQueryClient } from "@tanstack/react-query"
import { appendToLastAssistant, readSSEStream } from "./stream-processor"
import type { SSEHandlers, MessagesSetter } from "./stream-processor"
import type { ChatStreamOptions } from "./types"

interface StreamConnectionDeps {
  setMessages: MessagesSetter
  setToolCalls: SSEHandlers["setToolCalls"]
  setPlanSteps: SSEHandlers["setPlanSteps"]
  setActionNotifications: SSEHandlers["setActionNotifications"]
  setIsStreaming: (streaming: boolean) => void
  setQueuedMessage: (msg: string | null) => void
  currentSessionId: string | undefined
  setCurrentSessionId: (id: string | undefined) => void
  currentSessionIdRef: React.MutableRefObject<string | undefined>
  queuedMessageRef: React.MutableRefObject<string | null>
}

export function useStreamConnection(deps: StreamConnectionDeps, options?: ChatStreamOptions) {
  const {
    setMessages,
    setToolCalls,
    setPlanSteps,
    setActionNotifications,
    setIsStreaming,
    setQueuedMessage,
    currentSessionId,
    setCurrentSessionId,
    currentSessionIdRef,
    queuedMessageRef,
  } = deps

  const abortRef = useRef<AbortController | null>(null)
  const deferredSessionIdRef = useRef<string | null>(null)
  const sendMessageRef = useRef<(text: string) => void>(() => {})
  const pageContext = usePageContext()
  const { switchSession, pendingContext, clearPendingContext } = useChatSidebar()
  const queryClient = useQueryClient()

  // Keep options ref fresh so memoized sendMessage always sees latest callback
  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  }, [options])

  const sseHandlers: SSEHandlers = {
    setMessages,
    setToolCalls,
    setPlanSteps,
    setActionNotifications,
    queryClient,
    optionsRef,
  }

  function captureNewSessionId(res: Response) {
    const newSessionId = res.headers.get("X-Session-Id")
    if (newSessionId && !currentSessionId) {
      setCurrentSessionId(newSessionId)
      currentSessionIdRef.current = newSessionId
      deferredSessionIdRef.current = newSessionId
      if (pendingContext) clearPendingContext()
    }
  }

  function finalizeStream() {
    setIsStreaming(false)
    abortRef.current = null
    if (deferredSessionIdRef.current) {
      switchSession(deferredSessionIdRef.current)
      deferredSessionIdRef.current = null
    }
    queryClient.invalidateQueries({ queryKey: ["chat-sessions"] })

    // Auto-dequeue: send queued message after stream completes
    const queued = queuedMessageRef.current
    if (queued) {
      queuedMessageRef.current = null
      setQueuedMessage(null)
      // Use setTimeout to avoid calling sendMessage during the setIsStreaming(false) update
      setTimeout(() => sendMessageRef.current(queued), 0)
    }
  }

  function buildRequestBody(message: string) {
    const isNewSession = !currentSessionId
    const contextPayload =
      isNewSession && pendingContext
        ? { contextMode: pendingContext.contextMode, contextData: pendingContext.contextData }
        : {}

    return {
      sessionId: currentSessionId,
      message,
      teamId: pageContext.teamId,
      formatId: pageContext.formatId,
      context: {
        pageType: pageContext.pageType,
        contextSummary: pageContext.contextSummary,
        teamId: pageContext.teamId,
        pokemonId: pageContext.pokemonId,
        formatId: pageContext.formatId,
      },
      ...contextPayload,
    }
  }

  async function executeStream(
    requestBody: Record<string, unknown>,
    onAbort?: string,
    fallbackError = "Sorry, I encountered an error. Please try again.",
  ) {
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      })

      captureNewSessionId(res)
      if (!res.ok || !res.body) throw new Error("Failed to get response")
      await readSSEStream(res.body, sseHandlers)
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        if (onAbort) {
          appendToLastAssistant(setMessages, (last) => ({
            content: last.content || onAbort,
          }))
        }
        return
      }
      appendToLastAssistant(setMessages, (last) => ({
        content: last.content || fallbackError,
      }))
    } finally {
      finalizeStream()
    }
  }

  function abort() {
    abortRef.current?.abort()
  }

  /** Keep sendMessageRef in sync so finalizeStream always calls the latest version */
  function setSendMessageRef(fn: (text: string) => void) {
    sendMessageRef.current = fn
  }

  return {
    executeStream,
    buildRequestBody,
    abort,
    setSendMessageRef,
    pageContext,
    pendingContext,
    clearPendingContext,
    switchSession,
    queryClient,
  }
}
