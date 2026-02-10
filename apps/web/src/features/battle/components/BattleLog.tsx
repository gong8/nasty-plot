"use client"

import { useRef, useEffect, useState, useCallback, useMemo } from "react"
import { ArrowDown } from "lucide-react"
import type { BattleLogEntry } from "@nasty-plot/battle-engine"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { LogEntry } from "./LogEntry"

interface BattleLogProps {
  entries: BattleLogEntry[]
  className?: string
}

export function BattleLog({ entries, className }: BattleLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)

  // Auto-scroll to bottom when new entries arrive (only if user is at bottom)
  useEffect(() => {
    if (isAtBottom && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [entries.length, isAtBottom])

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget
    const atBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 40
    setIsAtBottom(atBottom)
  }, [])

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    setIsAtBottom(true)
  }, [])

  // Pre-compute which entries should show a turn separator
  const turnSeparators = useMemo(() => {
    const set = new Set<number>()
    let prevTurn = -1
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]
      if (entry.type === "turn" && entry.turn !== prevTurn) {
        set.add(i)
        prevTurn = entry.turn
      } else if (entry.type === "turn") {
        prevTurn = entry.turn
      }
    }
    return set
  }, [entries])

  return (
    <div className={cn("relative flex flex-col h-full", className)}>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto font-mono text-sm"
        onScroll={handleScroll}
      >
        <div className="p-2 space-y-0.5">
          {entries.length === 0 && (
            <p className="text-muted-foreground italic px-2">Battle log will appear here...</p>
          )}
          {entries.map((entry, i) => (
            <div key={i}>
              {turnSeparators.has(i) && (
                <div className="flex items-center gap-3 my-3 first:mt-1">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Turn {entry.turn}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              )}
              {entry.type !== "turn" && <LogEntry entry={entry} />}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Scroll to bottom button */}
      {!isAtBottom && entries.length > 10 && (
        <Button
          variant="secondary"
          size="sm"
          className="absolute bottom-2 right-2 h-8 w-8 rounded-full p-0 shadow-md"
          onClick={scrollToBottom}
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}
