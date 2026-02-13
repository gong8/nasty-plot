"use client"

import { use } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, Swords } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { BattleHistoryView } from "@/features/battle/components/BattleHistoryView"
import type { TeamData } from "@nasty-plot/core"
import { fetchJson } from "@/lib/api-client"

export default function TeamBattlesPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = use(params)
  const router = useRouter()

  const teamQuery = useQuery<TeamData>({
    queryKey: ["team", teamId],
    queryFn: () => fetchJson(`/api/teams/${teamId}`),
  })

  if (teamQuery.isLoading) {
    return (
      <div className="container mx-auto max-w-4xl py-8 px-4 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    )
  }

  if (teamQuery.error || !teamQuery.data) {
    return (
      <div className="container mx-auto max-w-4xl py-8 px-4">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold font-display">Team not found</h2>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => router.push(`/teams/${teamId}`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2 min-w-0">
          <Swords className="h-5 w-5 text-muted-foreground shrink-0" />
          <h1 className="text-xl font-bold truncate">{teamQuery.data.name}</h1>
          <span className="text-muted-foreground">Battle History</span>
        </div>
      </div>

      {/* Battle History */}
      <BattleHistoryView teamId={teamId} />
    </div>
  )
}
