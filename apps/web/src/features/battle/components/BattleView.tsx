"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { BattleState, MoveHint } from "@nasty-plot/battle-engine";
import { BattleField } from "./BattleField";
import { BattleLog } from "./BattleLog";
import { MoveSelector } from "./MoveSelector";
import { SwitchMenu } from "./SwitchMenu";
import { TeamPreview } from "./TeamPreview";
import { EvalBar } from "./EvalBar";
import { HintPanel } from "./HintPanel";
import { CommentaryPanel } from "./CommentaryPanel";
import { useBattleHints } from "../hooks/use-battle-hints";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, RotateCcw, ArrowLeft, Lightbulb, MessageSquare, Save, Loader2 } from "lucide-react";
import Link from "next/link";

interface BattleViewProps {
  state: BattleState;
  onMove: (moveIndex: number, tera?: boolean, targetSlot?: number) => void;
  onSwitch: (pokemonIndex: number) => void;
  onLeadSelect: (leadOrder: number[]) => void;
  onRematch?: () => void;
  onSave?: () => Promise<string | null>;
  className?: string;
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
  const [showSwitchMenu, setShowSwitchMenu] = useState(false);
  const [hintsEnabled, setHintsEnabled] = useState(false);
  const [commentaryEnabled, setCommentaryEnabled] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  const { hints, winProb } = useBattleHints(state, { enabled: hintsEnabled });

  const handleHintSelect = (hint: MoveHint) => {
    if (hint.action.type === "move" && hint.action.moveIndex != null) {
      onMove(hint.action.moveIndex, hint.action.tera);
    } else if (hint.action.type === "switch" && hint.action.pokemonIndex != null) {
      onSwitch(hint.action.pokemonIndex);
    }
  };

  const handleSave = async () => {
    if (!onSave || isSaving) return;
    setIsSaving(true);
    const id = await onSave();
    setSavedId(id);
    setIsSaving(false);
  };

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
    );
  }

  // Battle Ended
  if (state.phase === "ended") {
    const playerWon = state.winner === "p1";
    return (
      <div className={cn("space-y-4", className)}>
        <BattleField state={state} />

        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6 text-center space-y-4">
            <Trophy className={cn("h-12 w-12 mx-auto", playerWon ? "text-yellow-500" : "text-muted-foreground")} />
            <h2 className="text-xl font-bold">
              {playerWon ? "Victory." : "Defeat."}
            </h2>
            <p className="text-muted-foreground">
              {state.winner === "p1" ? state.sides.p1.name : state.sides.p2.name} won the battle!
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              {onSave && !savedId && (
                <Button onClick={handleSave} disabled={isSaving} variant="outline" className="gap-1.5">
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
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

        <div className="max-w-md mx-auto h-[300px] border rounded-lg">
          <BattleLog entries={state.fullLog} />
        </div>
      </div>
    );
  }

  // Active Battle Phase
  const isForceSwitch = state.availableActions?.forceSwitch ?? false;
  const showSwitch = showSwitchMenu || isForceSwitch;
  const activePokemon = state.sides.p1.active[0];

  // Recent log entries for commentary (last turn's entries)
  const recentEntries = state.log.slice(-10);

  return (
    <div className={cn("space-y-3", className)}>
      {/* Turn indicator + toggles */}
      <div className="flex items-center justify-between px-1">
        <span className="text-sm font-semibold">Turn {state.turn}</span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={hintsEnabled ? "default" : "ghost"}
            onClick={() => setHintsEnabled((v) => !v)}
            className="h-7 text-xs gap-1"
          >
            <Lightbulb className="h-3 w-3" />
            Hints
          </Button>
          <Button
            size="sm"
            variant={commentaryEnabled ? "default" : "ghost"}
            onClick={() => setCommentaryEnabled((v) => !v)}
            className="h-7 text-xs gap-1"
          >
            <MessageSquare className="h-3 w-3" />
            Commentary
          </Button>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{state.sides.p1.name}</span>
          <span>vs</span>
          <span>{state.sides.p2.name}</span>
        </div>
      </div>

      {/* Win probability bar */}
      {winProb && (
        <EvalBar
          p1WinProb={winProb.p1}
          p2WinProb={winProb.p2}
          p1Name={state.sides.p1.name}
          p2Name={state.sides.p2.name}
        />
      )}

      {/* Battle field */}
      <BattleField state={state} />

      {/* Actions + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Controls */}
        <div className="lg:col-span-2">
          {state.waitingForChoice && state.availableActions && (
            <Card>
              <CardContent className="pt-4">
                {showSwitch ? (
                  <SwitchMenu
                    actions={state.availableActions}
                    onSwitch={(idx) => {
                      onSwitch(idx);
                      setShowSwitchMenu(false);
                    }}
                    onBack={isForceSwitch ? undefined : () => setShowSwitchMenu(false)}
                  />
                ) : (
                  <MoveSelector
                    actions={state.availableActions}
                    onMoveSelect={onMove}
                    onSwitchClick={() => setShowSwitchMenu(true)}
                    canTera={state.availableActions.canTera && state.sides.p1.canTera}
                    teraType={activePokemon?.teraType}
                    format={state.format}
                    activeSlot={state.availableActions.activeSlot}
                  />
                )}
              </CardContent>
            </Card>
          )}

          {!state.waitingForChoice && state.phase === "battle" && (
            <Card>
              <CardContent className="pt-4 text-center text-muted-foreground">
                Waiting for opponent...
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right sidebar: log + hints + commentary */}
        <div className="space-y-3">
          <div className="h-[280px] border rounded-lg">
            <BattleLog entries={state.fullLog} />
          </div>

          {hintsEnabled && hints && (
            <HintPanel
              hints={hints.rankedMoves}
              onSelectHint={handleHintSelect}
            />
          )}

          {commentaryEnabled && (
            <CommentaryPanel
              state={state}
              recentEntries={recentEntries}
              team1Name={state.sides.p1.name}
              team2Name={state.sides.p2.name}
            />
          )}
        </div>
      </div>
    </div>
  );
}
