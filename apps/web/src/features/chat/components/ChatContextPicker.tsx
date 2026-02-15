"use client"

import { useChatSidebar } from "@/features/chat/context/ChatProvider"
import {
  useBuildContextData,
  CONTEXT_MODE_LABELS,
  CONTEXT_MODE_DESCRIPTIONS,
} from "@/features/chat/hooks/use-build-context-data"
import { cn } from "@nasty-plot/ui"
import { Globe, Lock } from "lucide-react"
import { PECHARUNT_SPRITE_URL } from "@/lib/constants"

interface ChatContextPickerProps {
  onModeChosen: () => void
}

export function ChatContextPicker({ onModeChosen }: ChatContextPickerProps) {
  const { openContextChat } = useChatSidebar()
  const { contextMode, hasContext, buildContextData } = useBuildContextData()

  function handleContextLocked() {
    if (!contextMode) return
    openContextChat({
      contextMode,
      contextData: JSON.stringify(buildContextData()),
    })
    onModeChosen()
  }

  return (
    <div className="text-center py-8 px-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={PECHARUNT_SPRITE_URL}
        alt="Pecharunt"
        width={64}
        height={64}
        className="pixelated mx-auto mb-3"
      />
      <p className="text-lg font-medium text-foreground">Pecharunt&apos;s Team Lab</p>
      <p className="text-sm mt-1 mb-6 text-muted-foreground">Choose how you&apos;d like to chat.</p>

      <div className="flex flex-col gap-3 max-w-sm mx-auto">
        {/* Global */}
        <button
          onClick={onModeChosen}
          className="w-full text-left px-4 py-3 rounded-lg border hover:bg-accent transition-colors"
        >
          <div className="flex items-start gap-3">
            <Globe className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5" />
            <div>
              <div className="text-sm font-medium">Global</div>
              <div className="text-xs text-muted-foreground mt-1">
                General-purpose chat. Pecharunt can discuss anything competitive Pokemon without
                tools tied to a specific page.
              </div>
            </div>
          </div>
        </button>

        {/* Context-locked */}
        <button
          onClick={handleContextLocked}
          disabled={!hasContext}
          className={cn(
            "w-full text-left px-4 py-3 rounded-lg border transition-colors",
            hasContext ? "hover:bg-accent" : "opacity-50 cursor-not-allowed",
          )}
        >
          <div className="flex items-start gap-3">
            <Lock className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5" />
            <div>
              <div className="text-sm font-medium">
                {hasContext ? CONTEXT_MODE_LABELS[contextMode] : "Context-locked"}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {hasContext
                  ? CONTEXT_MODE_DESCRIPTIONS[contextMode]
                  : "Navigate to a team or battle page to use scoped mode with access to specific tools."}
              </div>
            </div>
          </div>
        </button>
      </div>
    </div>
  )
}
