"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BattleStatsCards } from "./BattleStatsCards"
import { BattleHistoryList } from "./BattleHistoryList"
import { BattleExportDialog } from "./BattleExportDialog"
import { cn } from "@nasty-plot/ui"
import { EmptyState } from "@/components/empty-state"
import { useTeamBattles, useTeamBattleStats } from "../hooks/use-team-battles"

const TREND_COLORS: Record<string, string> = {
  win: "bg-green-500",
  loss: "bg-red-500",
}

interface BattleHistoryViewProps {
  teamId: string
}

export function BattleHistoryView({ teamId }: BattleHistoryViewProps) {
  const [page, setPage] = useState(1)
  const [exportBattleId, setExportBattleId] = useState<string | null>(null)

  const battlesQuery = useTeamBattles(teamId, page)
  const statsQuery = useTeamBattleStats(teamId)

  // Filter battles by individual vs batch
  const allBattles = battlesQuery.data?.battles || []
  const individualBattles = allBattles.filter((b) => !b.batchId)
  const batchBattles = allBattles.filter((b) => b.batchId)

  const trend = statsQuery.data?.recentTrend || []

  return (
    <div className="space-y-6">
      <BattleStatsCards stats={statsQuery.data} isLoading={statsQuery.isLoading} />

      {trend.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Recent Results</p>
          <div className="flex gap-1 flex-wrap">
            {trend.map((t) => (
              <div
                key={t.battleId}
                className={cn("w-5 h-5 rounded-sm", TREND_COLORS[t.result] ?? "bg-gray-400")}
                title={`${t.result} vs ${t.opponentName} (${t.turnCount} turns)`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="individual">
        <TabsList>
          <TabsTrigger value="individual">
            Individual Battles ({individualBattles.length})
          </TabsTrigger>
          <TabsTrigger value="batch">Batch Simulations ({batchBattles.length})</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="individual" className="pt-4">
          <BattleHistoryList
            battles={individualBattles}
            total={battlesQuery.data?.total || 0}
            page={page}
            teamId={teamId}
            onPageChange={setPage}
            onExport={setExportBattleId}
          />
        </TabsContent>

        <TabsContent value="batch" className="pt-4">
          {batchBattles.length === 0 ? (
            <EmptyState>No batch simulations found for this team.</EmptyState>
          ) : (
            <BattleHistoryList
              battles={batchBattles}
              total={batchBattles.length}
              page={1}
              teamId={teamId}
              onPageChange={() => {}}
              onExport={setExportBattleId}
            />
          )}
        </TabsContent>

        <TabsContent value="analysis" className="pt-4">
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg font-medium">ANALYSIS TODO</p>
            <p className="text-sm mt-2">
              Protocol-level analysis coming soon: problem Pokemon tracking, KO analysis, and
              per-Pokemon performance metrics.
            </p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Export Dialog */}
      <BattleExportDialog
        battleId={exportBattleId}
        open={!!exportBattleId}
        onOpenChange={(open) => {
          if (!open) setExportBattleId(null)
        }}
      />
    </div>
  )
}
