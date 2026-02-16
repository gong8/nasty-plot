import type { ChatMessageMetadata } from "@nasty-plot/core"

export interface UIChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  metadata?: ChatMessageMetadata
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

export interface ChatStreamOptions {
  onActionNotify?: (notification: ActionNotification) => void
}
