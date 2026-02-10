"use client";

import { use, useEffect, useState } from "react";
import { useReplay } from "@/features/battle/hooks/use-replay";
import { BattleField } from "@/features/battle/components/BattleField";
import { BattleLog } from "@/features/battle/components/BattleLog";
import { ReplayControls } from "@/features/battle/components/ReplayControls";
import { WinProbabilityGraph } from "@/features/battle/components/WinProbabilityGraph";
import { EvalBar } from "@/features/battle/components/EvalBar";
import { CommentaryPanel } from "@/features/battle/components/CommentaryPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, MessageSquare } from "lucide-react";
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
    <>
      <main className="container mx-auto p-4 max-w-5xl">
        <ReplayViewerContent battleData={battleData} />
      </main>
    </>
  );
}

function ReplayViewerContent({ battleData }: { battleData: BattleData }) {
  const replay = useReplay({
    protocolLog: battleData.protocolLog,
    format: battleData.gameType as BattleFormat,
  });
  const [showCommentary, setShowCommentary] = useState(false);

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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold">Battle Replay</h1>
          <Button
            size="sm"
            variant={showCommentary ? "default" : "ghost"}
            onClick={() => setShowCommentary((v) => !v)}
            className="h-7 text-xs gap-1"
          >
            <MessageSquare className="h-3 w-3" />
            Commentary
          </Button>
        </div>
        <span className="text-sm text-muted-foreground">
          {battleData.team1Name} vs {battleData.team2Name} &middot; {battleData.turnCount} turns
        </span>
      </div>

      {/* Eval bar */}
      {winProb != null && (
        <EvalBar
          p1WinProb={winProb}
          p2WinProb={100 - winProb}
          p1Name={battleData.team1Name}
          p2Name={battleData.team2Name}
        />
      )}

      {/* Battle field */}
      <BattleField state={replay.currentFrame.state} />

      {/* Replay controls */}
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

      {/* Win probability graph */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-medium">Win Probability</CardTitle>
        </CardHeader>
        <CardContent className="pb-3">
          <WinProbabilityGraph
            frames={allFrames}
            currentTurn={replay.currentFrame.turnNumber}
            p1Name={battleData.team1Name}
            p2Name={battleData.team2Name}
          />
        </CardContent>
      </Card>

      {/* Battle log */}
      <div className="h-[250px] border rounded-lg">
        <BattleLog entries={replay.currentFrame.entries} />
      </div>

      {/* Commentary panel */}
      {showCommentary && (
        <CommentaryPanel
          state={replay.currentFrame.state}
          recentEntries={replay.currentFrame.entries}
          team1Name={battleData.team1Name}
          team2Name={battleData.team2Name}
        />
      )}
    </div>
  );
}
