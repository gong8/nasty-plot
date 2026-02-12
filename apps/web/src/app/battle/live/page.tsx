"use client"

import { useSearchParams } from "next/navigation"
import { useEffect, Suspense } from "react"
import { BattleView } from "@/features/battle/components/BattleView"
import { useBattle } from "@/features/battle/hooks/use-battle"
import { loadCheckpoint } from "@/features/battle/lib/checkpoint-store"
import { useChatSidebar } from "@/features/chat/context/chat-provider"
import type { AIDifficulty } from "@nasty-plot/battle-engine"
import { DEFAULT_FORMAT_ID, type GameType } from "@nasty-plot/core"
import { Loader2 } from "lucide-react"

function BattleLiveContent() {
  const searchParams = useSearchParams()
  const {
    state,
    isLoading,
    error,
    startBattle,
    chooseLead,
    submitMove,
    submitSwitch,
    rematch,
    saveBattle,
    resumeBattle,
    setCheckpointExtras,
  } = useBattle()
  const {
    activeSessionId,
    autoAnalyze,
    setAutoAnalyzeEnabled,
    setAutoAnalyzeDepth,
    switchSession,
  } = useChatSidebar()

  // Save auto-analyze state into checkpoints
  useEffect(() => {
    setCheckpointExtras(() => ({
      autoAnalyze: {
        enabled: autoAnalyze.enabled,
        depth: autoAnalyze.depth,
        chatSessionId: activeSessionId,
      },
    }))
  }, [autoAnalyze.enabled, autoAnalyze.depth, activeSessionId, setCheckpointExtras])

  // Stable string key so the effect only re-runs when params actually change
  const paramsKey = searchParams.toString()

  useEffect(() => {
    const formatId = searchParams.get("format") || DEFAULT_FORMAT_ID
    const simFormatId = searchParams.get("simFormat") || undefined
    const gameType = (searchParams.get("gameType") || "singles") as GameType
    const aiDifficulty = (searchParams.get("ai") || "greedy") as AIDifficulty
    const p1Encoded = searchParams.get("p1")
    const p2Encoded = searchParams.get("p2")
    const playerTeamId = searchParams.get("t1id") || null
    const opponentTeamId = searchParams.get("t2id") || null

    if (p1Encoded && p2Encoded) {
      // New battle from URL params
      try {
        const playerTeamPaste = decodeURIComponent(atob(p1Encoded))
        const opponentTeamPaste = decodeURIComponent(atob(p2Encoded))

        startBattle({
          playerTeamPaste,
          opponentTeamPaste,
          formatId,
          simFormatId,
          gameType,
          aiDifficulty,
          playerTeamId,
          opponentTeamId,
        })
      } catch (err) {
        console.error("Failed to decode teams:", err)
      }
      return
    }

    // No URL params — check for a checkpoint to resume immediately
    const checkpoint = loadCheckpoint()
    if (checkpoint) {
      resumeBattle(checkpoint)
      // Restore auto-analyze state from checkpoint
      if (checkpoint.autoAnalyze) {
        setAutoAnalyzeEnabled(checkpoint.autoAnalyze.enabled)
        setAutoAnalyzeDepth(checkpoint.autoAnalyze.depth)
        if (checkpoint.autoAnalyze.chatSessionId) {
          switchSession(checkpoint.autoAnalyze.chatSessionId)
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey])

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive font-medium">Error: {error}</p>
        <p className="text-sm text-muted-foreground mt-1">
          Check that both teams are in valid Showdown paste format.
        </p>
      </div>
    )
  }

  if (state.phase === "setup" || (isLoading && state.turn === 0)) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-3 text-muted-foreground">
          {isLoading ? "Resuming battle..." : "Starting battle..."}
        </span>
      </div>
    )
  }

  return (
    <BattleView
      state={state}
      onMove={submitMove}
      onSwitch={submitSwitch}
      onLeadSelect={chooseLead}
      onRematch={rematch}
      onSave={(commentary) => saveBattle(commentary, activeSessionId)}
    />
  )
}

export default function BattleLivePage() {
  return (
    <>
      <main className="container mx-auto px-2 py-2 max-w-7xl">
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <BattleLiveContent />
        </Suspense>
      </main>
    </>
  )
}
