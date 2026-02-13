"use client"

import { useState, useRef, useMemo, useCallback } from "react"
import { cn } from "@nasty-plot/ui"
import type { BattleState } from "@nasty-plot/battle-engine"
import { BattleField } from "./BattleField"
import { BattleLog } from "./BattleLog"
import { BattleScreen, type SidebarTab } from "./BattleScreen"
import { MoveSelector } from "./MoveSelector"
import { SwitchMenu } from "./SwitchMenu"
import { TeamPreview } from "./TeamPreview"
import { EvalBar } from "./EvalBar"
import { CommentaryPanel } from "./CommentaryPanel"
import { useBattleHints } from "../hooks/use-battle-hints"
import { useAutoAnalyze } from "../hooks/use-auto-analyze"
import { useBattleAnimations, type AnimationState } from "../hooks/use-battle-animations"
import { useBattleStatePublisher } from "../context/battle-state-context"
import { useBuildContextData } from "@/features/chat/hooks/use-build-context-data"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Trophy, RotateCcw, ArrowLeft, Zap, Save, Loader2 } from "lucide-react"
import { useChatSidebar } from "@/features/chat/context/chat-provider"
import { putJson } from "@/lib/api-client"
import Link from "next/link"

interface BattleEndedProps {
  state: BattleState
  animState: AnimationState
  textSpeed: number
  isSaving: boolean
  savedId: string | null
  onSave?: () => void
  onRematch?: () => void
  className?: string
}

function BattleEnded({
  state,
  animState,
  textSpeed,
  isSaving,
  savedId,
  onSave,
  onRematch,
  className,
}: BattleEndedProps) {
  const playerWon = state.winner === "p1"
  const winnerName = state.winner === "p1" ? state.sides.p1.name : state.sides.p2.name

  return (
    <div className={cn("space-y-3", className)}>
      <BattleField
        state={state}
        animationStates={animState.slotAnimations}
        textMessage={animState.textMessage}
        damageNumbers={animState.damageNumbers}
        textSpeed={textSpeed}
      />

      <Card className="max-w-md mx-auto">
        <CardContent className="pt-6 text-center space-y-4">
          <Trophy
            className={cn(
              "h-12 w-12 mx-auto",
              playerWon ? "text-yellow-500" : "text-muted-foreground",
            )}
          />
          <h2 className="text-xl font-bold">{playerWon ? "Victory." : "Defeat."}</h2>
          <p className="text-muted-foreground">{winnerName} won the battle!</p>
          <div className="flex gap-3 justify-center flex-wrap">
            {onSave && !savedId && (
              <Button onClick={onSave} disabled={isSaving} variant="outline" className="gap-1.5">
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {isSaving ? "Saving..." : "Save Battle"}
              </Button>
            )}
            {savedId && (
              <Link href={`/battle/replay/${savedId}`}>
                <Button variant="outline" className="gap-1.5">
                  View Replay
                </Button>
              </Link>
            )}
            {onRematch && (
              <Button onClick={onRematch} className="gap-1.5">
                <RotateCcw className="h-4 w-4" />
                Rematch
              </Button>
            )}
            <Link href="/battle/new">
              <Button variant="outline" className="gap-1.5">
                <ArrowLeft className="h-4 w-4" />
                New Battle
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <div className="max-w-2xl mx-auto h-[300px] border rounded-lg">
        <BattleLog entries={state.fullLog} />
      </div>
    </div>
  )
}

interface BattleViewProps {
  state: BattleState
  onMove: (moveIndex: number, tera?: boolean, targetSlot?: number) => void
  onSwitch: (pokemonIndex: number) => void
  onLeadSelect: (leadOrder: number[]) => void
  onRematch?: () => void
  onSave?: (commentary?: Record<number, string>) => Promise<string | null>
  className?: string
}

export function BattleView({
  state,
  onMove,
  onSwitch,
  onLeadSelect,
  onRematch,
  onSave,
  className,
}: BattleViewProps) {
  const [showSwitchMenu, setShowSwitchMenu] = useState(false)
  const [commentaryAutoMode, setCommentaryAutoMode] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [textSpeed, setTextSpeed] = useState(1)
  const { autoAnalyze, setAutoAnalyzeEnabled, openContextChat } = useChatSidebar()
  useBattleStatePublisher(state)

  const commentaryRef = useRef<Record<number, string>>({})

  const { winProb } = useBattleHints(state, { enabled: true })
  const { abortIfAnalyzing } = useAutoAnalyze(state)
  const animState = useBattleAnimations(state, { speed: textSpeed })
  const { contextMode, buildContextData } = useBuildContextData()

  const handleToggleAutoAnalyze = useCallback(() => {
    const enabling = !autoAnalyze.enabled
    setAutoAnalyzeEnabled(enabling)
    if (enabling && contextMode) {
      openContextChat({
        contextMode,
        contextData: JSON.stringify(buildContextData()),
      })
    }
  }, [autoAnalyze.enabled, setAutoAnalyzeEnabled, openContextChat, contextMode, buildContextData])

  const handleMove = useCallback(
    (moveIndex: number, tera?: boolean, targetSlot?: number) => {
      abortIfAnalyzing()
      onMove(moveIndex, tera, targetSlot)
    },
    [abortIfAnalyzing, onMove],
  )

  const handleSwitch = useCallback(
    (pokemonIndex: number) => {
      abortIfAnalyzing()
      onSwitch(pokemonIndex)
    },
    [abortIfAnalyzing, onSwitch],
  )

  const handleCommentaryGenerated = useCallback(
    (turn: number, text: string) => {
      commentaryRef.current[turn] = text

      if (savedId) {
        putJson(`/api/battles/${savedId}/commentary`, { turn, text }).catch((err) =>
          console.error("[Commentary persist]", err),
        )
      }
    },
    [savedId],
  )

  const handleSave = async () => {
    if (!onSave || isSaving) return
    setIsSaving(true)
    const hasCommentary = Object.keys(commentaryRef.current).length > 0
    const id = await onSave(hasCommentary ? commentaryRef.current : undefined)
    setSavedId(id)
    setIsSaving(false)
  }

  const recentEntries = useMemo(() => state.log.slice(-10), [state.log])

  // Sidebar tabs — Log + Commentary (Hints tab removed, replaced by Auto-Analyze)
  const sidebarTabs = useMemo(() => {
    const tabs: SidebarTab[] = [
      {
        value: "log",
        label: "Log",
        content: (
          <div className="border rounded-lg overflow-hidden h-full">
            <BattleLog entries={state.fullLog} />
          </div>
        ),
      },
    ]

    tabs.push({
      value: "commentary",
      label: "Commentary",
      content: (
        <CommentaryPanel
          state={state}
          recentEntries={recentEntries}
          team1Name={state.sides.p1.name}
          team2Name={state.sides.p2.name}
          autoMode={commentaryAutoMode}
          showAutoToggle
          onAutoModeChange={setCommentaryAutoMode}
          onCommentaryGenerated={handleCommentaryGenerated}
        />
      ),
    })

    return tabs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    state.fullLog,
    state.log,
    commentaryAutoMode,
    state,
    recentEntries,
    handleCommentaryGenerated,
  ])

  // Team Preview Phase
  if (state.phase === "preview") {
    return (
      <div className={cn("max-w-2xl mx-auto py-8", className)}>
        <TeamPreview
          playerTeam={state.sides.p1.team}
          opponentTeam={state.sides.p2.team}
          format={state.format}
          onSubmit={onLeadSelect}
        />
      </div>
    )
  }

  // Battle Ended
  if (state.phase === "ended") {
    return (
      <BattleEnded
        state={state}
        animState={animState}
        textSpeed={textSpeed}
        isSaving={isSaving}
        savedId={savedId}
        onSave={onSave ? handleSave : undefined}
        onRematch={onRematch}
        className={className}
      />
    )
  }

  // Active Battle Phase
  const isForceSwitch = state.availableActions?.forceSwitch ?? false
  const showSwitch = showSwitchMenu || isForceSwitch
  const activePokemon = state.sides.p1.active[0]
  const controlsDisabled = animState.isAnimating

  const controlPanel =
    state.waitingForChoice && state.availableActions ? (
      <Card className={cn("h-full", controlsDisabled && "opacity-60 pointer-events-none")}>
        <CardContent className="pt-3 pb-3 h-full">
          {showSwitch ? (
            <SwitchMenu
              actions={state.availableActions}
              onSwitch={(idx) => {
                handleSwitch(idx)
                setShowSwitchMenu(false)
              }}
              onBack={isForceSwitch ? undefined : () => setShowSwitchMenu(false)}
              team={state.sides.p1.team}
            />
          ) : (
            <MoveSelector
              actions={state.availableActions}
              onMoveSelect={handleMove}
              onSwitchClick={() => setShowSwitchMenu(true)}
              canTera={state.availableActions.canTera && state.sides.p1.canTera}
              teraType={activePokemon?.teraType}
              format={state.format}
              activeSlot={state.availableActions.activeSlot}
              opponentActive={state.sides.p2.active}
              playerActive={state.sides.p1.active}
            />
          )}
        </CardContent>
      </Card>
    ) : (
      <Card className="h-full">
        <CardContent className="pt-3 pb-3 h-full flex items-center justify-center text-muted-foreground text-sm">
          {state.phase === "battle" ? "Waiting for opponent..." : "\u00A0"}
        </CardContent>
      </Card>
    )

  return (
    <div className={cn("flex flex-col h-[calc(100vh-80px)]", className)}>
      {/* Top bar: turn + names */}
      <div className="flex items-center justify-between px-3 py-1 shrink-0">
        <span className="text-sm font-semibold tabular-nums">Turn {state.turn}</span>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{state.sides.p1.name}</span>
          <span className="text-xs">vs</span>
          <span>{state.sides.p2.name}</span>
          <Button
            size="sm"
            variant={autoAnalyze.enabled ? "default" : "secondary"}
            onClick={handleToggleAutoAnalyze}
            className="h-7 text-xs gap-1"
          >
            <Zap className="h-3 w-3" />
            {autoAnalyze.enabled ? "Auto-Analyze On" : "Auto-Analyze"}
          </Button>
        </div>
      </div>

      {/* BattleScreen with controls nested below the field */}
      <div className="flex-1 px-2 py-1 min-h-0">
        <BattleScreen
          evalBar={winProb ? <EvalBar p1WinProb={winProb.p1} p2WinProb={winProb.p2} /> : undefined}
          state={state}
          animState={animState}
          textSpeed={textSpeed}
          speed={textSpeed}
          onSpeedChange={setTextSpeed}
          sidebarTabs={sidebarTabs}
          bottomContent={controlPanel}
          className="h-full"
        />
      </div>
    </div>
  )
}
