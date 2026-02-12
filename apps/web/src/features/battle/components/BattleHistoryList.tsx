"use client"

import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Download, ChevronLeft, ChevronRight } from "lucide-react"
import type { BattleSummary } from "../hooks/use-team-battles"

interface BattleHistoryListProps {
  battles: BattleSummary[]
  total: number
  page: number
  teamId: string
  onPageChange: (page: number) => void
  onExport?: (battleId: string) => void
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function resultBadge(winnerId: string | null, teamId: string, battle: BattleSummary) {
  const isTeam1 = battle.team1Id === teamId
  const teamSide = isTeam1 ? "team1" : "team2"

  if (!winnerId) return <Badge variant="secondary">No Result</Badge>
  if (winnerId === "draw") return <Badge variant="secondary">Draw</Badge>
  if (winnerId === teamSide) return <Badge className="bg-green-600">Win</Badge>
  return <Badge variant="destructive">Loss</Badge>
}

export function BattleHistoryList({
  battles,
  total,
  page,
  teamId,
  onPageChange,
  onExport,
}: BattleHistoryListProps) {
  const totalPages = Math.ceil(total / 20)

  if (battles.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">No battles found for this team.</div>
    )
  }

  return (
    <div className="space-y-3">
      {battles.map((battle) => {
        const isTeam1 = battle.team1Id === teamId
        const opponentName = isTeam1 ? battle.team2Name : battle.team1Name

        return (
          <Card key={battle.id} className="hover:bg-accent/50 transition-colors">
            <CardContent className="py-3 px-4 flex items-center justify-between">
              <Link
                href={`/battle/replay/${battle.id}`}
                className="flex items-center gap-3 min-w-0 flex-1"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {resultBadge(battle.winnerId, teamId, battle)}
                    <span className="text-sm font-medium truncate">vs {opponentName}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {battle.formatId} &middot; {battle.turnCount} turns &middot; {battle.mode}
                  </div>
                </div>
              </Link>
              <div className="flex items-center gap-2 shrink-0 ml-4">
                <span className="text-xs text-muted-foreground">{timeAgo(battle.createdAt)}</span>
                {onExport && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.preventDefault()
                      onExport(battle.id)
                    }}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
