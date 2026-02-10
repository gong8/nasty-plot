"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, Suspense } from "react";
import { SiteHeader } from "@/shared/components/site-header";
import { BattleView } from "@/modules/battle/components/BattleView";
import { useBattle } from "@/modules/battle/hooks/use-battle";
import type { AIDifficulty, BattleFormat } from "@/modules/battle/types";
import { Loader2 } from "lucide-react";

function BattleLiveContent() {
  const searchParams = useSearchParams();
  const { state, isLoading, error, startBattle, chooseLead, submitMove, submitSwitch, rematch } = useBattle();
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;

    const formatId = searchParams.get("format") || "gen9ou";
    const gameType = (searchParams.get("gameType") || "singles") as BattleFormat;
    const aiDifficulty = (searchParams.get("ai") || "greedy") as AIDifficulty;
    const p1Encoded = searchParams.get("p1");
    const p2Encoded = searchParams.get("p2");

    if (!p1Encoded || !p2Encoded) return;

    try {
      const playerTeamPaste = decodeURIComponent(atob(p1Encoded));
      const opponentTeamPaste = decodeURIComponent(atob(p2Encoded));

      startedRef.current = true;
      startBattle({
        playerTeamPaste,
        opponentTeamPaste,
        formatId,
        gameType,
        aiDifficulty,
      });
    } catch (err) {
      console.error("Failed to decode teams:", err);
    }
  }, [searchParams, startBattle]);

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive font-medium">Error: {error}</p>
        <p className="text-sm text-muted-foreground mt-1">
          Check that both teams are in valid Showdown paste format.
        </p>
      </div>
    );
  }

  if (state.phase === "setup" || (isLoading && state.turn === 0)) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-3 text-muted-foreground">Starting battle...</span>
      </div>
    );
  }

  return (
    <BattleView
      state={state}
      onMove={submitMove}
      onSwitch={submitSwitch}
      onLeadSelect={chooseLead}
      onRematch={rematch}
    />
  );
}

export default function BattleLivePage() {
  return (
    <>
      <SiteHeader />
      <main className="container mx-auto p-4 max-w-5xl">
        <Suspense fallback={
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        }>
          <BattleLiveContent />
        </Suspense>
      </main>
    </>
  );
}
