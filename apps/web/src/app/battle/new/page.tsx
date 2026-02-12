"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { BattleSetup } from "@/features/battle/components/BattleSetup"
import type { AIDifficulty, BattleFormat } from "@nasty-plot/battle-engine"

function NewBattleContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const initialTeamId = searchParams.get("teamId") || undefined
  const initialFormatId = searchParams.get("formatId") || undefined

  const handleStart = (config: {
    playerTeamPaste: string
    opponentTeamPaste: string
    playerTeamId: string | null
    opponentTeamId: string | null
    formatId: string
    simFormatId?: string
    gameType: BattleFormat
    aiDifficulty: AIDifficulty
  }) => {
    // Encode config in URL search params to pass to battle page
    const params = new URLSearchParams({
      format: config.formatId,
      gameType: config.gameType,
      ai: config.aiDifficulty,
      p1: btoa(encodeURIComponent(config.playerTeamPaste)),
      p2: btoa(encodeURIComponent(config.opponentTeamPaste)),
    })
    if (config.simFormatId) params.set("simFormat", config.simFormatId)
    if (config.playerTeamId) params.set("t1id", config.playerTeamId)
    if (config.opponentTeamId) params.set("t2id", config.opponentTeamId)

    router.push(`/battle/live?${params.toString()}`)
  }

  return (
    <BattleSetup
      onStart={handleStart}
      initialTeamId={initialTeamId}
      initialFormatId={initialFormatId}
    />
  )
}

export default function NewBattlePage() {
  return (
    <main className="container mx-auto p-4">
      <Suspense fallback={null}>
        <NewBattleContent />
      </Suspense>
    </main>
  )
}
