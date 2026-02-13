"use client"

import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Download, ChevronLeft, ChevronRight } from "lucide-react"
import { EmptyState } from "@/components/empty-state"
import type { BattleSummary } from "../hooks/use-team-battles"

interface BattleHistoryListProps {
  battles: BattleSummary[]
  total: number
  page: number
  teamId: string
  onPageChange: (page: number) => void
  onExport?: (battleId: string) => void
}

const MS_PER_MINUTE = 60_000
const MINUTES_PER_HOUR = 60
const HOURS_PER_DAY = 24
const PAGE_SIZE = 20

function timeAgo(dateStr: string): string {
  const elapsedMs = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(elapsedMs / MS_PER_MINUTE)
  if (minutes < 1) return "just now"
  if (minutes < MINUTES_PER_HOUR) return `${minutes}m ago`
  const hours = Math.floor(minutes / MINUTES_PER_HOUR)
  if (hours < HOURS_PER_DAY) return `${hours}h ago`
  const days = Math.floor(hours / HOURS_PER_DAY)
  return `${days}d ago`
}

function ResultBadge({ winnerId, isTeam1 }: { winnerId: string | null; isTeam1: boolean }) {
  if (!winnerId) return <Badge variant="secondary">No Result</Badge>
  if (winnerId === "draw") return <Badge variant="secondary">Draw</Badge>

  const isWin = winnerId === (isTeam1 ? "team1" : "team2")
  return isWin ? (
    <Badge className="bg-green-600">Win</Badge>
  ) : (
    <Badge variant="destructive">Loss</Badge>
  )
}

export function BattleHistoryList({
  battles,
  total,
  page,
  teamId,
  onPageChange,
  onExport,
}: BattleHistoryListProps) {
  const totalPages = Math.ceil(total / PAGE_SIZE)

  if (battles.length === 0) {
    return <EmptyState>No battles found for this team.</EmptyState>
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
                    <ResultBadge winnerId={battle.winnerId} isTeam1={isTeam1} />
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
