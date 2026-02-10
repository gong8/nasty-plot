"use client"

import { MessageCircle, Trash2 } from "lucide-react"
import { useChatSidebar } from "@/features/chat/context/chat-provider"
import { useChatSessions, useDeleteChatSession } from "@/features/chat/hooks/use-chat-sessions"
import { cn } from "@/lib/utils"

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "now"
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  return new Date(dateStr).toLocaleDateString()
}

interface ChatSessionListProps {
  mode: "sidebar" | "fullpage"
  onSelect?: () => void
}

export function ChatSessionList({ mode, onSelect }: ChatSessionListProps) {
  const { activeSessionId, switchSession } = useChatSidebar()
  const { data: sessions, isLoading } = useChatSessions()
  const deleteMut = useDeleteChatSession()

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (activeSessionId === id) {
      newSession()
    }
    deleteMut.mutate(id)
  }

  return (
    <div
      className={cn(
        "flex flex-col border-r border-border bg-background/50",
        mode === "fullpage" ? "w-64 shrink-0" : "w-full",
      )}
    >
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="p-1">
          {isLoading && (
            <div className="px-3 py-4 text-sm text-muted-foreground text-center">Loading...</div>
          )}
          {sessions?.map((session) => {
            const isActive = session.id === activeSessionId
            const firstMsg = session.messages[0]
            const preview =
              session.title ||
              firstMsg?.content.slice(0, 50) +
                (firstMsg && firstMsg.content.length > 50 ? "..." : "") ||
              "New Chat"

            return (
              <div
                key={session.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  switchSession(session.id)
                  onSelect?.()
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    switchSession(session.id)
                    onSelect?.()
                  }
                }}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-md text-sm group flex items-start gap-2 transition-colors cursor-pointer",
                  isActive ? "bg-accent text-accent-foreground" : "hover:bg-muted/50",
                )}
              >
                <MessageCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 opacity-50" />
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium">{preview}</div>
                  <div className="text-xs text-muted-foreground">
                    {relativeTime(session.updatedAt)}
                  </div>
                </div>
                <button
                  onClick={(e) => handleDelete(session.id, e)}
                  className="opacity-0 group-hover:opacity-100 shrink-0 p-0.5 rounded hover:bg-destructive/20 transition-opacity"
                  title="Delete session"
                >
                  <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            )
          })}
          {sessions && sessions.length === 0 && !isLoading && (
            <div className="px-3 py-4 text-sm text-muted-foreground text-center">
              No chat history yet
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
