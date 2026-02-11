"use client"

import { useRouter } from "next/navigation"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ContextModeBadge } from "./context-mode-badge"
import { useChatSidebar } from "@/features/chat/context/chat-provider"
import type { ContextMismatch } from "@/features/chat/hooks/use-context-mismatch"

interface ContextMismatchBannerProps {
  mismatch: ContextMismatch
}

export function ContextMismatchBanner({ mismatch }: ContextMismatchBannerProps) {
  const router = useRouter()
  const { newSession } = useChatSidebar()

  const entityLabel = mismatch.type === "team" ? "Team" : "Battle"

  return (
    <div className="mx-3 mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            This chat is locked to{" "}
            <span className="font-semibold">{mismatch.expectedEntityName}</span>.
            <ContextModeBadge mode={mismatch.contextMode} className="ml-1.5 align-middle" />
          </p>
          <p className="text-xs text-amber-700/80 dark:text-amber-300/70 mt-0.5">
            Navigate there to continue, or start a new chat for this page.
          </p>
          <div className="flex items-center gap-2 mt-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-amber-500/40 hover:bg-amber-500/20"
              onClick={() => router.push(mismatch.navigationUrl)}
            >
              Go to {entityLabel}
            </Button>
            <button
              className="text-xs text-amber-700 dark:text-amber-300 hover:underline"
              onClick={newSession}
            >
              Start new chat
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
