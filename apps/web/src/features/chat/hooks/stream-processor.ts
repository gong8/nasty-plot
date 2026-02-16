import type { useQueryClient } from "@tanstack/react-query"
import type {
  UIChatMessage,
  ToolCallState,
  ActionNotification,
  PlanStep,
  ChatStreamOptions,
} from "./types"
import { readSSEEvents } from "@/lib/sse"

export type MessagesSetter = React.Dispatch<React.SetStateAction<UIChatMessage[]>>
type ToolCallsSetter = React.Dispatch<React.SetStateAction<Map<string, ToolCallState>>>

export interface SSEHandlers {
  setMessages: MessagesSetter
  setToolCalls: ToolCallsSetter
  setPlanSteps: React.Dispatch<React.SetStateAction<PlanStep[]>>
  setActionNotifications: React.Dispatch<React.SetStateAction<ActionNotification[]>>
  queryClient: ReturnType<typeof useQueryClient>
  optionsRef: React.RefObject<ChatStreamOptions | undefined>
}

export function appendToLastAssistant(
  setMessages: MessagesSetter,
  updater: (last: UIChatMessage) => Partial<UIChatMessage>,
) {
  setMessages((prev) => {
    const last = prev[prev.length - 1]
    if (!last || last.role !== "assistant") return prev
    const updated = [...prev]
    updated[updated.length - 1] = { ...last, ...updater(last) }
    return updated
  })
}

function updateToolCallStatus(
  setToolCalls: ToolCallsSetter,
  name: string,
  update: Partial<ToolCallState>,
) {
  setToolCalls((prev) => {
    const existing = prev.get(name)
    if (!existing) return prev
    const next = new Map(prev)
    next.set(name, { ...existing, ...update })
    return next
  })
}

function handleSSEEvent(parsed: Record<string, unknown>, handlers: SSEHandlers) {
  const {
    setMessages,
    setToolCalls,
    setPlanSteps,
    setActionNotifications,
    queryClient,
    optionsRef,
  } = handlers

  switch (parsed.type) {
    case "content":
      appendToLastAssistant(setMessages, (last) => ({
        content: last.content + (parsed.content as string),
      }))
      break

    case "tool_start":
      setToolCalls((prev) => {
        const next = new Map(prev)
        next.set(parsed.name as string, {
          name: parsed.name as string,
          label: parsed.label as string,
          input: parsed.input as Record<string, unknown>,
          status: "executing",
        })
        return next
      })
      break

    case "tool_end":
      updateToolCallStatus(setToolCalls, parsed.name as string, { status: "complete" })
      break

    case "tool_error":
      updateToolCallStatus(setToolCalls, parsed.name as string, {
        status: "error",
        error: parsed.error as string,
      })
      break

    case "action_notify": {
      const notification: ActionNotification = {
        name: parsed.name as string,
        label: parsed.label as string,
        input: parsed.input as Record<string, unknown>,
      }
      setActionNotifications((prev) => [...prev, notification])
      queryClient.invalidateQueries({ queryKey: ["team"] })
      optionsRef.current?.onActionNotify?.(notification)
      break
    }

    case "plan_start":
      setPlanSteps(
        (parsed.steps as { text: string }[]).map((s) => ({
          text: s.text,
          status: "pending" as const,
        })),
      )
      break

    case "plan_step_update":
      setPlanSteps((prev) => {
        const idx = parsed.stepIndex as number
        if (idx < 0 || idx >= prev.length) return prev
        const updated = [...prev]
        updated[idx] = { ...updated[idx], status: parsed.status as PlanStep["status"] }
        return updated
      })
      break

    case "session_meta":
      if (parsed.title) {
        queryClient.invalidateQueries({ queryKey: ["chat-sessions"] })
      }
      break

    case "error":
      appendToLastAssistant(setMessages, () => ({
        content: `Error: ${parsed.error}`,
      }))
      break

    default:
      // Legacy format support
      if (!parsed.type && parsed.content) {
        appendToLastAssistant(setMessages, (last) => ({
          content: last.content + (parsed.content as string),
        }))
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
          updateToolCallStatus(setToolCalls, tc.name, { status: "complete" })
        }
      }
      break
  }
}

export async function readSSEStream(body: ReadableStream<Uint8Array>, handlers: SSEHandlers) {
  for await (const event of readSSEEvents(body)) {
    handleSSEEvent(event, handlers)
  }
}
