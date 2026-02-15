"use client"

import { Sparkles } from "lucide-react"

interface ChatWizardEventProps {
  content: string
}

export function ChatWizardEvent({ content }: ChatWizardEventProps) {
  // Strip the [WIZARD_EVENT] prefix for display
  const displayText = content.replace(/^\[WIZARD_EVENT\]\s*/, "")

  return (
    <div className="flex items-start gap-2 px-2 py-1.5">
      <Sparkles className="h-3.5 w-3.5 text-muted-foreground/60 mt-0.5 flex-shrink-0" />
      <p className="text-xs text-muted-foreground/60 italic">{displayText}</p>
    </div>
  )
}
