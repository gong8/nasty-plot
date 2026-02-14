"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MessageSquare, Loader2 } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { BattleState, BattleLogEntry } from "@nasty-plot/battle-engine/client"
import { readSSEEvents } from "@/lib/sse"

interface CommentaryPanelProps {
  state: BattleState
  recentEntries: BattleLogEntry[]
  team1Name?: string
  team2Name?: string
  className?: string
  /** Pre-loaded commentary from DB (turn → text) */
  initialCommentary?: Record<number, string>
  /** Called after commentary finishes streaming for a turn */
  onCommentaryGenerated?: (turn: number, text: string) => void
  /** When true, automatically fetch commentary at end of each turn */
  autoMode?: boolean
  /** Show a toggle for auto/live mode inside the panel header */
  showAutoToggle?: boolean
  /** Callback when auto mode is toggled */
  onAutoModeChange?: (enabled: boolean) => void
}

const AUTO_COMMENTARY_DELAY_MS = 500

async function streamCommentary(
  request: {
    state: BattleState
    recentEntries: BattleLogEntry[]
    team1Name: string
    team2Name: string
  },
  signal: AbortSignal,
  onChunk: (accumulated: string) => void,
): Promise<string> {
  const res = await fetch("/api/battles/commentary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "turn", ...request }),
    signal,
  })

  if (!res.ok || !res.body) throw new Error("Failed to fetch commentary")

  let text = ""
  for await (const event of readSSEEvents<{ content?: string }>(res.body)) {
    if (event.content) {
      text += event.content
      onChunk(text)
    }
  }

  return text
}

export function CommentaryPanel({
  state,
  recentEntries,
  team1Name = "Player",
  team2Name = "Opponent",
  className,
  initialCommentary,
  onCommentaryGenerated,
  autoMode = false,
  showAutoToggle = false,
  onAutoModeChange,
}: CommentaryPanelProps) {
  const [comments, setComments] = useState<Record<number, string>>(initialCommentary ?? {})
  const [isLoading, setIsLoading] = useState(false)
  const [currentText, setCurrentText] = useState("")
  const [streamingTurn, setStreamingTurn] = useState<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const lastAutoTurnRef = useRef<number>(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Sync when initialCommentary prop changes (e.g. replay frame navigation)
  useEffect(() => {
    if (initialCommentary) {
      setComments((prev) => ({ ...prev, ...initialCommentary }))
    }
  }, [initialCommentary])

  // Auto-scroll to bottom when new content appears
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [comments, currentText])

  const fetchCommentary = useCallback(
    async (turnNumber?: number) => {
      if (isLoading) return

      const turn = turnNumber ?? state.turn
      if (comments[turn]) return

      setIsLoading(true)
      setCurrentText("")
      setStreamingTurn(turn)

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      try {
        const text = await streamCommentary(
          { state, recentEntries, team1Name, team2Name },
          controller.signal,
          setCurrentText,
        )

        if (text) {
          setComments((prev) => ({ ...prev, [turn]: text }))
          onCommentaryGenerated?.(turn, text)
        }
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          console.error("[Commentary]", err)
        }
      } finally {
        setIsLoading(false)
        setCurrentText("")
        setStreamingTurn(null)
      }
    },
    [state, recentEntries, team1Name, team2Name, isLoading, comments, onCommentaryGenerated],
  )

  // Auto-commentary: trigger when turn changes and autoMode is on
  useEffect(() => {
    if (!autoMode) return
    if (state.turn <= 0 || recentEntries.length === 0) return
    if (state.turn === lastAutoTurnRef.current) return
    if (comments[state.turn]) {
      lastAutoTurnRef.current = state.turn
      return
    }

    lastAutoTurnRef.current = state.turn
    const timer = setTimeout(() => {
      fetchCommentary(state.turn)
    }, AUTO_COMMENTARY_DELAY_MS)

    return () => clearTimeout(timer)
  }, [autoMode, state.turn, recentEntries.length, comments, fetchCommentary])

  useEffect(() => () => abortRef.current?.abort(), [])

  const hasCurrent = comments[state.turn] != null

  // Build sorted list of turns with commentary
  const sortedTurns = Object.keys(comments)
    .map(Number)
    .sort((a, b) => a - b)

  return (
    <Card className={className}>
      <CardHeader className="py-2 px-4 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-sm font-medium flex items-center gap-1.5">
          <MessageSquare className="h-3.5 w-3.5" />
          Commentary
        </CardTitle>
        <div className="flex items-center gap-1.5">
          {showAutoToggle && (
            <Button
              size="sm"
              variant={autoMode ? "default" : "outline"}
              onClick={() => onAutoModeChange?.(!autoMode)}
              className="h-6 text-[11px] px-2"
            >
              {autoMode ? "Live" : "Auto"}
            </Button>
          )}
          {!autoMode && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => fetchCommentary()}
              disabled={isLoading || recentEntries.length === 0 || hasCurrent}
              className="h-6 text-[11px] px-2"
            >
              {isLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              {hasCurrent ? "Analyzed" : "Analyze Turn"}
            </Button>
          )}
          {autoMode && isLoading && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Analyzing...
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-1 min-h-0">
        <ScrollArea className="h-full px-4 pb-3" ref={scrollRef}>
          {sortedTurns.length === 0 && !currentText && (
            <p className="text-xs text-muted-foreground py-2">
              {autoMode
                ? "Commentary will appear automatically after each turn."
                : 'Click "Analyze Turn" for AI commentary on the current turn.'}
            </p>
          )}
          {sortedTurns.map((turn) => (
            <div key={turn} className="mb-3">
              <span className="text-xs font-medium text-muted-foreground">Turn {turn}</span>
              <p className="text-sm mt-0.5">{comments[turn]}</p>
            </div>
          ))}
          {currentText && streamingTurn != null && (
            <div className="mb-3">
              <span className="text-xs font-medium text-muted-foreground">
                Turn {streamingTurn}
              </span>
              <p className="text-sm mt-0.5">
                {currentText}
                <span className="animate-pulse">&#9610;</span>
              </p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
