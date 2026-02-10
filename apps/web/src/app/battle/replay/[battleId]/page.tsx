"use client";

import { use, useEffect, useState, useCallback } from "react";
import { useReplay } from "@/features/battle/hooks/use-replay";
import { useReplayAnimations } from "@/features/battle/hooks/use-replay-animations";
import { BattleField } from "@/features/battle/components/BattleField";
import { BattleLog } from "@/features/battle/components/BattleLog";
import { ReplayControls } from "@/features/battle/components/ReplayControls";
import { WinProbabilityGraph } from "@/features/battle/components/WinProbabilityGraph";
import { EvalBar } from "@/features/battle/components/EvalBar";
import { CommentaryPanel } from "@/features/battle/components/CommentaryPanel";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import type { BattleFormat } from "@nasty-plot/battle-engine";

interface BattleData {
  id: string;
  formatId: string;
  gameType: string;
  team1Name: string;
  team2Name: string;
  winnerId: string | null;
  turnCount: number;
  protocolLog: string;
  commentary: string | null;
}

export default function ReplayPage({ params }: { params: Promise<{ battleId: string }> }) {
  const { battleId } = use(params);
  const [battleData, setBattleData] = useState<BattleData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/battles/${battleId}/replay`)
      .then((res) => {
        if (!res.ok) throw new Error("Battle not found");
        return res.json();
      })
      .then(setBattleData)
      .catch((err) => setError(err.message));
  }, [battleId]);

  if (error) {
    return (
      <>
        <main className="container mx-auto p-4 text-center py-12">
          <p className="text-destructive">Error: {error}</p>
        </main>
      </>
    );
  }

  if (!battleData) {
    return (
      <>
        <main className="container mx-auto p-4 flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
      </>
    );
  }

  return (
    <main className="h-[calc(100vh-80px)]">
      <ReplayViewerContent battleData={battleData} />
    </main>
  );
}

function ReplayViewerContent({ battleData }: { battleData: BattleData }) {
  const replay = useReplay({
    protocolLog: battleData.protocolLog,
    format: battleData.gameType as BattleFormat,
  });

  const animState = useReplayAnimations(
    replay.currentFrame?.entries ?? [],
    replay.currentIndex,
  );

  // Parse persisted commentary
  const [commentary, setCommentary] = useState<Record<number, string>>(() => {
    if (!battleData.commentary) return {};
    try {
      return JSON.parse(battleData.commentary);
    } catch {
      return {};
    }
  });

  const handleCommentaryGenerated = useCallback(
    (turn: number, text: string) => {
      // Persist to DB
      fetch(`/api/battles/${battleData.id}/commentary`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turn, text }),
      }).catch((err) => console.error("[Replay commentary persist]", err));

      // Update local state
      setCommentary((prev) => ({ ...prev, [turn]: text }));
    },
    [battleData.id],
  );

  if (!replay.isReady || !replay.currentFrame) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading replay...</span>
      </div>
    );
  }

  const allFrames = replay.getAllFrames();
  const winProb = replay.currentFrame.winProbTeam1;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-3 py-2 flex items-center gap-3">
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
      </div>

      {/* Middle: field + tabbed sidebar */}
      <div className="flex-1 flex flex-col lg:flex-row gap-2 px-3 py-2 min-h-0">
        {/* Battle field */}
        <div className="lg:flex-[7] h-[35vh] lg:h-auto min-w-0">
          <BattleField
            state={replay.currentFrame.state}
            animationStates={animState.slotAnimations}
            moveFlash={animState.moveFlash}
            effectivenessFlash={animState.effectivenessFlash}
            damageNumbers={animState.damageNumbers}
            className="max-h-full"
          />
        </div>

        {/* Tabbed sidebar */}
        <Tabs defaultValue="log" className="lg:flex-[3] flex-1 min-w-0 min-h-0">
          <TabsList className="w-full">
            <TabsTrigger value="log" className="text-xs">Log</TabsTrigger>
            <TabsTrigger value="graph" className="text-xs">Graph</TabsTrigger>
            <TabsTrigger value="commentary" className="text-xs">Commentary</TabsTrigger>
          </TabsList>

          <TabsContent value="log" className="flex-1 min-h-0">
            <div className="border rounded-lg overflow-hidden h-full">
              <BattleLog entries={replay.currentFrame.entries} />
            </div>
          </TabsContent>

          <TabsContent value="graph" className="flex-1 min-h-0">
            <WinProbabilityGraph
              frames={allFrames}
              currentTurn={replay.currentFrame.turnNumber}
              p1Name={battleData.team1Name}
              p2Name={battleData.team2Name}
              className="h-full"
            />
          </TabsContent>

          <TabsContent value="commentary" className="flex-1 min-h-0">
            <CommentaryPanel
              state={replay.currentFrame.state}
              recentEntries={replay.currentFrame.entries}
              team1Name={battleData.team1Name}
              team2Name={battleData.team2Name}
              initialCommentary={commentary}
              onCommentaryGenerated={handleCommentaryGenerated}
              className="h-full gap-0 py-0"
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Replay controls */}
      <div className="shrink-0 px-3 py-2">
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
  );
}
