"use client"

import { use, useEffect, useState, useCallback, useMemo } from "react"
import { useReplay } from "@/features/battle/hooks/use-replay"
import { useReplayAnimations } from "@/features/battle/hooks/use-replay-animations"
import { BattleLog } from "@/features/battle/components/BattleLog"
import { BattleScreen, type SidebarTab } from "@/features/battle/components/BattleScreen"
import { ReplayControls } from "@/features/battle/components/ReplayControls"
import { WinProbabilityGraph } from "@/features/battle/components/WinProbabilityGraph"
import { EvalBar } from "@/features/battle/components/EvalBar"
import { CommentaryPanel } from "@/features/battle/components/CommentaryPanel"
import { ChatPanel } from "@/features/chat/components/chat-panel"
import { MessageCircle } from "lucide-react"
import { LoadingSpinner } from "@/components/loading-spinner"
import { Button } from "@/components/ui/button"
import { useChatSidebar } from "@/features/chat/context/chat-provider"
import { useBattleStatePublisher } from "@/features/battle/context/battle-state-context"
import { fetchJson, putJson } from "@/lib/api-client"
import type { GameType } from "@nasty-plot/core"

interface BattleData {
  id: string
  formatId: string
  gameType: GameType
  team1Name: string
  team2Name: string
  winnerId: string | null
  turnCount: number
  protocolLog: string
  commentary: string | null
  chatSessionId: string | null
}

export default function ReplayPage({ params }: { params: Promise<{ battleId: string }> }) {
  const { battleId } = use(params)
  const [battleData, setBattleData] = useState<BattleData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchJson<BattleData>(`/api/battles/${battleId}/replay`)
      .then(setBattleData)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load replay"),
      )
  }, [battleId])

  if (error) {
    return (
      <main className="container mx-auto p-4 text-center py-12">
        <p className="text-destructive">Error: {error}</p>
      </main>
    )
  }

  if (!battleData) {
    return (
      <main className="container mx-auto p-4">
        <LoadingSpinner size="lg" className="py-24" />
      </main>
    )
  }

  return (
    <main className="h-[calc(100vh-80px)]">
      <ReplayViewerContent battleData={battleData} />
    </main>
  )
}

function ReplayViewerContent({ battleData }: { battleData: BattleData }) {
  const { newSession, openSidebar } = useChatSidebar()
  const replay = useReplay({
    protocolLog: battleData.protocolLog,
    format: battleData.gameType as GameType,
  })

  const animState = useReplayAnimations(replay.currentFrame?.entries ?? [], replay.currentIndex, {
    speed: replay.speed,
    onComplete: replay.onFrameAnimationsComplete,
  })

  useBattleStatePublisher(replay.currentFrame?.state ?? null)

  // Parse persisted commentary
  const [commentary, setCommentary] = useState<Record<number, string>>(() => {
    if (!battleData.commentary) return {}
    try {
      return JSON.parse(battleData.commentary)
    } catch {
      return {}
    }
  })

  const handleCommentaryGenerated = useCallback(
    (turn: number, text: string) => {
      // Persist to DB
      putJson(`/api/battles/${battleData.id}/commentary`, { turn, text }).catch((err) =>
        console.error("[Replay commentary persist]", err),
      )

      // Update local state
      setCommentary((prev) => ({ ...prev, [turn]: text }))
    },
    [battleData.id],
  )

  const allFrames = replay.getAllFrames()

  // Build sidebar tabs for replay — must be above early return to satisfy rules-of-hooks
  const sidebarTabs: SidebarTab[] = useMemo(() => {
    const tabs: SidebarTab[] = [
      {
        value: "log",
        label: "Log",
        content: (
          <div className="border rounded-lg overflow-hidden h-full">
            <BattleLog entries={replay.currentFrame?.entries ?? []} />
          </div>
        ),
      },
      {
        value: "graph",
        label: "Graph",
        content: (
          <WinProbabilityGraph
            frames={allFrames}
            currentTurn={replay.currentFrame?.turnNumber ?? 0}
            p1Name={battleData.team1Name}
            className="h-full"
          />
        ),
      },
      {
        value: "commentary",
        label: "Commentary",
        content: (
          <CommentaryPanel
            state={replay.currentFrame?.state ?? ({} as never)}
            recentEntries={replay.currentFrame?.entries ?? []}
            team1Name={battleData.team1Name}
            team2Name={battleData.team2Name}
            initialCommentary={commentary}
            onCommentaryGenerated={handleCommentaryGenerated}
            className="h-full gap-0 py-0"
          />
        ),
      },
    ]

    // Add Coaching tab when the battle was played with auto-analyze
    if (battleData.chatSessionId) {
      tabs.push({
        value: "coaching",
        label: "Coaching",
        content: (
          <div className="h-full overflow-hidden">
            <ChatPanel sessionId={battleData.chatSessionId} />
          </div>
        ),
      })
    }

    return tabs
  }, [replay.currentFrame, allFrames, battleData, commentary, handleCommentaryGenerated])

  if (!replay.isReady || !replay.currentFrame) {
    return <LoadingSpinner label="Loading replay..." className="py-12" />
  }

  const winProb = replay.currentFrame.winProbTeam1

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-3 py-1 flex items-center gap-3">
        <h1 className="text-lg font-bold shrink-0">Battle Replay</h1>
        {winProb != null && (
          <EvalBar
            className="flex-1"
            p1WinProb={winProb}
            p2WinProb={100 - winProb}
            p1Name={battleData.team1Name}
            p2Name={battleData.team2Name}
          />
        )}
        <span className="text-sm text-muted-foreground shrink-0">
          {battleData.team1Name} vs {battleData.team2Name} &middot; {battleData.turnCount} turns
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            newSession()
            openSidebar()
          }}
          className="h-7 text-xs gap-1 shrink-0"
        >
          <MessageCircle className="h-3 w-3" />
          Analyze
        </Button>
      </div>

      {/* Middle: shared BattleScreen (field + tabbed sidebar) */}
      <div className="flex-1 px-2 py-1 min-h-0">
        <BattleScreen
          state={replay.currentFrame.state}
          animState={animState}
          textSpeed={replay.speed}
          sidebarTabs={sidebarTabs}
          className="h-full"
        />
      </div>

      {/* Replay controls */}
      <div className="shrink-0 px-2 pb-1.5">
        <ReplayControls
          currentFrame={replay.currentIndex}
          totalFrames={replay.totalFrames}
          isPlaying={replay.isPlaying}
          speed={replay.speed}
          onFirst={replay.goToFirst}
          onPrev={replay.goToPrev}
          onNext={replay.goToNext}
          onLast={replay.goToLast}
          onTogglePlay={replay.togglePlay}
          onSeek={replay.seekTo}
          onSpeedChange={replay.changeSpeed}
        />
      </div>
    </div>
  )
}
