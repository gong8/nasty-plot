"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Swords, FlaskConical, Clock, Trophy, Play, X, Upload } from "lucide-react"
import {
  hasCheckpoint,
  loadCheckpoint,
  clearCheckpoint,
} from "@/features/battle/lib/checkpoint-store"
import { BattleSprite } from "@/features/battle/components/PokemonSprite"
import type { BattleCheckpoint, BattlePokemon } from "@nasty-plot/battle-engine"
import type { BattleSummary } from "@/features/battle/types"

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

function PokemonRow({ pokemon, side }: { pokemon: BattlePokemon[]; side: "p1" | "p2" }) {
  return (
    <div className="flex gap-2">
      {pokemon.map((p, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <BattleSprite
            speciesId={p.speciesId}
            side={side === "p1" ? "back" : "front"}
            size={48}
            fainted={p.fainted}
          />
          <span className="text-[10px] text-muted-foreground leading-tight text-center max-w-[52px] truncate">
            {p.name}
          </span>
          {!p.fainted && (
            <div className="w-10 h-1 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${p.hpPercent}%`,
                  backgroundColor:
                    p.hpPercent > 50 ? "#22c55e" : p.hpPercent > 20 ? "#eab308" : "#ef4444",
                }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default function BattleHubPage() {
  const router = useRouter()
  const [battles, setBattles] = useState<BattleSummary[]>([])
  const [loadingBattles, setLoadingBattles] = useState(true)
  const [checkpoint, setCheckpoint] = useState<BattleCheckpoint | null>(() =>
    hasCheckpoint() ? loadCheckpoint() : null,
  )
  const [showNewBattleWarning, setShowNewBattleWarning] = useState(false)
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([])
  const [filterTeamId, setFilterTeamId] = useState<string>("all")

  useEffect(() => {
    fetch("/api/teams")
      .then((res) => res.json())
      .then((data) => setTeams(data.teams || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams({ limit: "10" })
    if (filterTeamId !== "all") params.set("teamId", filterTeamId)
    fetch(`/api/battles?${params}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setBattles(data.battles || [])
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingBattles(false)
      })
    return () => {
      cancelled = true
    }
  }, [filterTeamId])

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
          {checkpoint ? (
            <Button size="lg" className="gap-2" onClick={() => setShowNewBattleWarning(true)}>
              <Swords className="h-5 w-5" />
              Start New Battle
            </Button>
          ) : (
            <Link href="/battle/new">
              <Button size="lg" className="gap-2">
                <Swords className="h-5 w-5" />
                Start New Battle
              </Button>
            </Link>
          )}
        </div>

        <Dialog open={showNewBattleWarning} onOpenChange={setShowNewBattleWarning}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Abandon current battle?</DialogTitle>
              <DialogDescription>
                You have a saved battle in progress (Turn {checkpoint?.battleState.turn}). Starting
                a new battle will discard it. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewBattleWarning(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  clearCheckpoint()
                  setCheckpoint(null)
                  setShowNewBattleWarning(false)
                  router.push("/battle/new")
                }}
              >
                Discard &amp; Start New
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {checkpoint && (
          <div className="flex justify-center mb-8">
            <Card className="w-full max-w-xl border-primary/30">
              <CardContent className="p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Battle in Progress</h2>
                  <span className="text-xs text-muted-foreground">
                    {checkpoint.config.formatId} &middot;{" "}
                    {checkpoint.aiDifficulty.charAt(0).toUpperCase() +
                      checkpoint.aiDifficulty.slice(1)}{" "}
                    AI &middot; Turn {checkpoint.battleState.turn}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{checkpoint.config.playerName}</span>
                    <span className="text-xs text-muted-foreground">
                      {checkpoint.battleState.sides.p1.team.filter((p) => !p.fainted).length}/
                      {checkpoint.battleState.sides.p1.team.length} remaining
                    </span>
                  </div>
                  <PokemonRow pokemon={checkpoint.battleState.sides.p1.team} side="p1" />
                </div>

                <div className="border-t" />

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{checkpoint.config.opponentName}</span>
                    <span className="text-xs text-muted-foreground">
                      {checkpoint.battleState.sides.p2.team.filter((p) => !p.fainted).length}/
                      {checkpoint.battleState.sides.p2.team.length} remaining
                    </span>
                  </div>
                  <PokemonRow pokemon={checkpoint.battleState.sides.p2.team} side="p2" />
                </div>

                {(checkpoint.battleState.field.weather ||
                  checkpoint.battleState.field.terrain ||
                  checkpoint.battleState.field.trickRoom > 0) && (
                  <div className="flex gap-2 flex-wrap">
                    {checkpoint.battleState.field.weather && (
                      <span className="text-xs bg-muted px-2 py-0.5 rounded">
                        {checkpoint.battleState.field.weather}
                      </span>
                    )}
                    {checkpoint.battleState.field.terrain && (
                      <span className="text-xs bg-muted px-2 py-0.5 rounded">
                        {checkpoint.battleState.field.terrain} Terrain
                      </span>
                    )}
                    {checkpoint.battleState.field.trickRoom > 0 && (
                      <span className="text-xs bg-muted px-2 py-0.5 rounded">Trick Room</span>
                    )}
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <Button className="flex-1 gap-2" onClick={() => router.push("/battle/live")}>
                    <Play className="h-4 w-4" />
                    Resume
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2 text-destructive hover:text-destructive"
                    onClick={() => {
                      clearCheckpoint()
                      setCheckpoint(null)
                    }}
                  >
                    <X className="h-4 w-4" />
                    Abandon
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          <Link href="/battle/import">
            <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full p-4">
              <div className="text-base font-semibold flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Import Replay
              </div>
            </Card>
          </Link>
        </div>

        {/* Recent Battles */}
        <div className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Recent Battles
            </h2>
            {teams.length > 0 && (
              <Select value={filterTeamId} onValueChange={setFilterTeamId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All battles</SelectItem>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

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
