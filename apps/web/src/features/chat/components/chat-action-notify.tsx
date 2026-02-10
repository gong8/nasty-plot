"use client"

import { Zap } from "lucide-react"
import type { ActionNotification } from "@/features/chat/hooks/use-chat-stream"

interface ChatActionNotifyProps {
  notification: ActionNotification
}

function summarizeInput(input: Record<string, unknown>): string {
  const parts: string[] = []
  if (input.pokemonId) parts.push(String(input.pokemonId))
  if (input.teamId) parts.push(`team ${String(input.teamId).slice(0, 8)}...`)
  if (input.position) parts.push(`slot ${input.position}`)
  if (input.setName) parts.push(String(input.setName))
  return parts.join(" - ") || ""
}

export function ChatActionNotify({ notification }: ChatActionNotifyProps) {
  const summary = summarizeInput(notification.input)

  return (
    <div className="ml-12 my-1">
      <div className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-200">
        <Zap className="h-3.5 w-3.5 text-amber-500 shrink-0" />
        <span className="truncate">
          {notification.label}
          {summary && <span className="text-amber-400 ml-1">({summary})</span>}
        </span>
      </div>
    </div>
  )
}
