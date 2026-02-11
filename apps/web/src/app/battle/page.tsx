"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Swords, FlaskConical, Clock, Trophy } from "lucide-react"

interface BattleSummary {
  id: string
  formatId: string
  gameType: string
  mode: string
  aiDifficulty: string | null
  team1Name: string
  team2Name: string
  winnerId: string | null
  turnCount: number
  createdAt: string
}

function winnerLabel(winnerId: string | null, team1Name: string, team2Name: string): string {
  if (!winnerId) return "No result"
  if (winnerId === "team1") return team1Name
  if (winnerId === "team2") return team2Name
  if (winnerId === "draw") return "Draw"
  return winnerId
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

export default function BattleHubPage() {
  const [battles, setBattles] = useState<BattleSummary[]>([])
  const [loadingBattles, setLoadingBattles] = useState(true)

  useEffect(() => {
    fetch("/api/battles?limit=10")
      .then((res) => res.json())
      .then((data) => setBattles(data.battles || []))
      .catch(() => {})
      .finally(() => setLoadingBattles(false))
  }, [])

  return (
    <>
      <main className="container mx-auto p-4 max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold font-display mb-2">Battle Simulator</h1>
          <p className="text-muted-foreground">
            Stress-test your team against AI opponents. Pecharunt watches with glee.
          </p>
        </div>

        <div className="flex justify-center mb-8">
          <Link href="/battle/new">
            <Button size="lg" className="gap-2">
              <Swords className="h-5 w-5" />
              Start New Battle
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link href="/battle/simulate">
            <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full p-4">
              <div className="text-base font-semibold flex items-center gap-2">
                <FlaskConical className="h-4 w-4" />
                Batch Simulation
              </div>
            </Card>
          </Link>
          <Link href="/battle/sample-teams">
            <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full p-4">
              <div className="text-base font-semibold flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                Sample Teams
              </div>
            </Card>
          </Link>
        </div>

        {/* Recent Battles */}
        <div className="mt-10">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Recent Battles
          </h2>

          {loadingBattles ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : battles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No battles yet. Start one above!</p>
          ) : (
            <div className="space-y-2">
              {battles.map((battle) => (
                <Link key={battle.id} href={`/battle/replay/${battle.id}`}>
                  <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                    <CardContent className="py-3 px-4 flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <Trophy className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">
                            {battle.team1Name} vs {battle.team2Name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {battle.formatId} &middot; {battle.turnCount} turns &middot; Winner:{" "}
                            {winnerLabel(battle.winnerId, battle.team1Name, battle.team2Name)}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0 ml-4">
                        {timeAgo(battle.createdAt)}
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  )
}
