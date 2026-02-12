"use client"

import { useState } from "react"
import { cn } from "@nasty-plot/ui"
import { Zap, Search, ChevronDown, ChevronRight } from "lucide-react"
import { ChatMessage } from "./chat-message"

interface TurnAnalysisCardProps {
  turn: number
  content: string
  depth: "quick" | "deep"
  isStreaming: boolean
}

/**
 * Extract the recommendation from the first line of auto-analysis content.
 * Looks for the pattern: **Recommended: [Move]** -- [reasoning]
 */
function extractRecommendation(content: string): string | null {
  const match = content.match(/\*\*Recommended:\s*(.+?)\*\*\s*(?:--|—)\s*(.+?)(?:\n|$)/)
  if (match) return `${match[1]} -- ${match[2]}`
  return null
}

export function TurnAnalysisCard({ turn, content, depth, isStreaming }: TurnAnalysisCardProps) {
  const [expanded, setExpanded] = useState(isStreaming)
  const [prevStreaming, setPrevStreaming] = useState(isStreaming)
  const recommendation = extractRecommendation(content)
  const DepthIcon = depth === "quick" ? Zap : Search

  // Auto-expand when streaming starts (derived-state pattern)
  if (isStreaming && !prevStreaming) {
    setExpanded(true)
  }
  if (isStreaming !== prevStreaming) {
    setPrevStreaming(isStreaming)
  }

  return (
    <div
      className={cn(
        "rounded-lg border transition-colors",
        "bg-accent/30 border-accent/50",
        isStreaming && "border-primary/40",
      )}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent/50 rounded-t-lg transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary shrink-0">
          Turn {turn}
        </span>
        <DepthIcon className="h-3 w-3 text-muted-foreground shrink-0" />
        {!expanded && recommendation && (
          <span className="text-xs text-muted-foreground truncate">{recommendation}</span>
        )}
        {isStreaming && (
          <span className="ml-auto text-xs text-primary animate-pulse shrink-0">Analyzing...</span>
        )}
      </button>
      {expanded && (
        <div className="px-3 pb-3">
          <ChatMessage role="assistant" content={content} isStreaming={isStreaming} />
        </div>
      )}
    </div>
  )
}
