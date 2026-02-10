"use client";

import { useRouter } from "next/navigation";
import { BattleSetup } from "@/features/battle/components/BattleSetup";
import type { AIDifficulty, BattleFormat } from "@nasty-plot/battle-engine";

export default function NewBattlePage() {
  const router = useRouter();

  const handleStart = (config: {
    playerTeamPaste: string;
    opponentTeamPaste: string;
    formatId: string;
    gameType: BattleFormat;
    aiDifficulty: AIDifficulty;
  }) => {
    // Encode config in URL search params to pass to battle page
    const params = new URLSearchParams({
      format: config.formatId,
      gameType: config.gameType,
      ai: config.aiDifficulty,
      p1: btoa(encodeURIComponent(config.playerTeamPaste)),
      p2: btoa(encodeURIComponent(config.opponentTeamPaste)),
    });

    router.push(`/battle/live?${params.toString()}`);
  };

  return (
    <>
      <main className="container mx-auto p-4">
        <BattleSetup onStart={handleStart} />
      </main>
    </>
  );
}
