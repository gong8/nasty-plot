"use client"

import { useState, useCallback, useRef } from "react"
import { usePageContext } from "@/features/chat/context/page-context-provider"
import { useChatSidebar } from "@/features/chat/context/chat-provider"
import { useQueryClient } from "@tanstack/react-query"

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
}

export interface ToolCallState {
  name: string
  label: string
  input: Record<string, unknown>
  status: "executing" | "complete" | "error"
  error?: string
}

export interface ActionNotification {
  name: string
  label: string
  input: Record<string, unknown>
}

export interface PlanStep {
  text: string
  status: "pending" | "active" | "complete" | "skipped"
}

export function useChatStream(sessionId?: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [toolCalls, setToolCalls] = useState<Map<string, ToolCallState>>(new Map())
  const [actionNotifications, setActionNotifications] = useState<ActionNotification[]>([])
  const [planSteps, setPlanSteps] = useState<PlanStep[]>([])
  const [currentSessionId, setCurrentSessionId] = useState(sessionId)
  const abortRef = useRef<AbortController | null>(null)
  const pageContext = usePageContext()
  const { switchSession, pendingContext, clearPendingContext } = useChatSidebar()
  const queryClient = useQueryClient()

  // Load existing session messages
  const loadSession = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/chat/sessions/${id}`)
      if (!res.ok) return
      const data = await res.json()
      if (data.data?.messages) {
        setMessages(
          data.data.messages
            .filter((m: { role: string }) => m.role !== "system")
            .map((m: { id?: number; role: string; content: string }, i: number) => ({
              id: m.id?.toString() ?? `loaded-${i}`,
              role: m.role as "user" | "assistant",
              content: m.content,
            })),
        )
      }
    } catch {
      // Session load is optional
    }
  }, [])

  const sendMessage = useCallback(
    async (text: string, regenerate = false) => {
      const trimmed = text.trim()
      if (!trimmed || isStreaming) return

      if (!regenerate) {
        const userMsg: ChatMessage = {
          id: `user-${Date.now()}`,
          role: "user",
          content: trimmed,
        }
        setMessages((prev) => [...prev, userMsg])
      }

      setIsStreaming(true)
      setToolCalls(new Map())
      setActionNotifications([])
      setPlanSteps([])

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: "",
      }
      setMessages((prev) => [...prev, assistantMsg])

      const controller = new AbortController()
      abortRef.current = controller

      try {
        // Include context mode for new sessions with pending context
        const isNewSession = !currentSessionId
        const contextPayload =
          isNewSession && pendingContext
            ? {
                contextMode: pendingContext.contextMode,
                contextData: pendingContext.contextData,
              }
            : {}

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: currentSessionId,
            message: trimmed,
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
            regenerate,
          }),
          signal: controller.signal,
        })

        // Capture session ID from response
        const newSessionId = res.headers.get("X-Session-Id")
        if (newSessionId && !currentSessionId) {
          setCurrentSessionId(newSessionId)
          switchSession(newSessionId)
          // Clear pending context after session is created
          if (pendingContext) clearPendingContext()
        }

        if (!res.ok || !res.body) {
          throw new Error("Failed to get response")
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() ?? ""

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue
            const data = line.slice(6)

            try {
              const parsed = JSON.parse(data)

              // New typed SSE event protocol
              if (parsed.type === "content") {
                setMessages((prev) => {
                  const updated = [...prev]
                  const last = updated[updated.length - 1]
                  if (last && last.role === "assistant") {
                    updated[updated.length - 1] = {
                      ...last,
                      content: last.content + parsed.content,
                    }
                  }
                  return updated
                })
              }

              if (parsed.type === "tool_start") {
                setToolCalls((prev) => {
                  const next = new Map(prev)
                  next.set(parsed.name, {
                    name: parsed.name,
                    label: parsed.label,
                    input: parsed.input,
                    status: "executing",
                  })
                  return next
                })
              }

              if (parsed.type === "tool_end") {
                setToolCalls((prev) => {
                  const next = new Map(prev)
                  const existing = next.get(parsed.name)
                  if (existing) {
                    next.set(parsed.name, { ...existing, status: "complete" })
                  }
                  return next
                })
              }

              if (parsed.type === "tool_error") {
                setToolCalls((prev) => {
                  const next = new Map(prev)
                  const existing = next.get(parsed.name)
                  if (existing) {
                    next.set(parsed.name, {
                      ...existing,
                      status: "error",
                      error: parsed.error,
                    })
                  }
                  return next
                })
              }

              if (parsed.type === "action_notify") {
                setActionNotifications((prev) => [
                  ...prev,
                  {
                    name: parsed.name,
                    label: parsed.label,
                    input: parsed.input,
                  },
                ])
                // Invalidate team data queries after write actions
                queryClient.invalidateQueries({ queryKey: ["team"] })
              }

              if (parsed.type === "plan_start") {
                setPlanSteps(
                  (parsed.steps as { text: string }[]).map((s) => ({
                    text: s.text,
                    status: "pending" as const,
                  })),
                )
              }

              if (parsed.type === "plan_step_update") {
                setPlanSteps((prev) => {
                  const updated = [...prev]
                  const idx = parsed.stepIndex as number
                  if (idx >= 0 && idx < updated.length) {
                    updated[idx] = {
                      ...updated[idx],
                      status: parsed.status as PlanStep["status"],
                    }
                  }
                  return updated
                })
              }

              if (parsed.type === "session_meta") {
                // Update session title in real-time and refresh sessions list
                if (parsed.title) {
                  queryClient.invalidateQueries({ queryKey: ["chat-sessions"] })
                }
              }

              if (parsed.type === "error") {
                setMessages((prev) => {
                  const updated = [...prev]
                  const last = updated[updated.length - 1]
                  if (last && last.role === "assistant") {
                    updated[updated.length - 1] = {
                      ...last,
                      content: `Error: ${parsed.error}`,
                    }
                  }
                  return updated
                })
              }

              // Legacy format support
              if (!parsed.type && parsed.content) {
                setMessages((prev) => {
                  const updated = [...prev]
                  const last = updated[updated.length - 1]
                  if (last && last.role === "assistant") {
                    updated[updated.length - 1] = {
                      ...last,
                      content: last.content + parsed.content,
                    }
                  }
                  return updated
                })
              }

              if (!parsed.type && parsed.toolCall) {
                const tc = parsed.toolCall as { name: string; status: string }
                if (tc.status === "executing") {
                  setToolCalls((prev) => {
                    const next = new Map(prev)
                    next.set(tc.name, {
                      name: tc.name,
                      label: `Running ${tc.name}...`,
                      input: {},
                      status: "executing",
                    })
                    return next
                  })
                } else {
                  setToolCalls((prev) => {
                    const next = new Map(prev)
                    const existing = next.get(tc.name)
                    if (existing) {
                      next.set(tc.name, { ...existing, status: "complete" })
                    }
                    return next
                  })
                }
              }
            } catch {
              // Skip non-JSON
            }
          }
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          // User stopped generation — keep partial content
          return
        }
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last && last.role === "assistant" && !last.content) {
            updated[updated.length - 1] = {
              ...last,
              content: "Sorry, I encountered an error. Please try again.",
            }
          }
          return updated
        })
      } finally {
        setIsStreaming(false)
        abortRef.current = null
        // Refresh sessions list
        queryClient.invalidateQueries({ queryKey: ["chat-sessions"] })
      }
    },
    [
      isStreaming,
      currentSessionId,
      pageContext,
      switchSession,
      pendingContext,
      clearPendingContext,
      queryClient,
    ],
  )

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const retryLast = useCallback(() => {
    // Find the last user message and regenerate
    const lastUser = [...messages].reverse().find((m) => m.role === "user")
    if (!lastUser) return
    // Remove the last assistant message from UI
    setMessages((prev) => {
      const idx = prev.findLastIndex((m) => m.role === "assistant")
      if (idx >= 0) {
        return [...prev.slice(0, idx), ...prev.slice(idx + 1)]
      }
      return prev
    })
    sendMessage(lastUser.content, true)
  }, [messages, sendMessage])

  const resetForSession = useCallback(
    (id: string | null) => {
      setMessages([])
      setToolCalls(new Map())
      setActionNotifications([])
      setPlanSteps([])
      setCurrentSessionId(id ?? undefined)
      if (id) {
        loadSession(id)
      }
    },
    [loadSession],
  )

  return {
    messages,
    isStreaming,
    toolCalls,
    actionNotifications,
    planSteps,
    currentSessionId,
    sendMessage,
    stopGeneration,
    retryLast,
    resetForSession,
  }
}
