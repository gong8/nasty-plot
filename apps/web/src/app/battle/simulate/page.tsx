"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Play, BarChart3 } from "lucide-react"
import { LoadingSpinner } from "@/components/loading-spinner"
import type { BatchAnalytics } from "@nasty-plot/battle-engine/client"
import { FormatSelector } from "@/features/battle/components/FormatSelector"
import { TeamPicker, type TeamSelection } from "@/features/battle/components/TeamPicker"
import { useFormat } from "@/features/battle/hooks/use-formats"
import { DEFAULT_FORMAT_ID, parseShowdownPaste, type GameType } from "@nasty-plot/core"
import { fetchJson, postJson } from "@/lib/api-client"

type Phase = "setup" | "running" | "results"

interface BatchState {
  id: string
  status: string
  completedGames: number
  totalGames: number
  team1Wins: number
  team2Wins: number
  draws: number
  analytics: BatchAnalytics | null
}

const emptySelection = (paste: string): TeamSelection => ({
  teamId: null,
  paste,
  source: "paste",
})

function validatePaste(paste: string): { valid: boolean; errors: string[] } {
  const trimmed = paste.trim()
  if (!trimmed) return { valid: false, errors: ["No team selected"] }

  const parsed = parseShowdownPaste(trimmed)
  if (parsed.length === 0) return { valid: false, errors: ["Could not parse team"] }

  const errors: string[] = []
  for (const slot of parsed) {
    if (!slot.pokemonId) {
      errors.push(`Slot ${slot.position}: missing Pokemon`)
      continue
    }
    const moves = slot.moves?.filter(Boolean) ?? []
    if (moves.length === 0) {
      errors.push(`${slot.pokemonId}: needs at least 1 move`)
    }
  }
  return { valid: errors.length === 0, errors }
}

function TurnDistributionChart({ distribution }: { distribution: Record<string, number> }) {
  const entries = Object.entries(distribution).sort(([a], [b]) => Number(a) - Number(b))
  const maxCount = Math.max(...Object.values(distribution))
  return (
    <>
      <div className="flex items-end gap-1 h-[120px]">
        {entries.map(([bucket, count]) => {
          const height = maxCount > 0 ? (count / maxCount) * 100 : 0
          return (
            <div key={bucket} className="flex flex-col items-center flex-1 min-w-0">
              <div
                className="w-full bg-primary/60 rounded-t-sm min-h-[2px]"
                style={{ height: `${height}%` }}
                title={`${bucket}-${Number(bucket) + 4} turns: ${count} games`}
              />
              <span className="text-[9px] text-muted-foreground mt-1 truncate w-full text-center">
                {bucket}
              </span>
            </div>
          )
        })}
      </div>
      <p className="text-[10px] text-muted-foreground text-center mt-1">Turns (bucketed by 5)</p>
    </>
  )
}

export default function SimulatePage() {
  const [phase, setPhase] = useState<Phase>("setup")
  const [team1Selection, setTeam1Selection] = useState<TeamSelection>(emptySelection(""))
  const [team2Selection, setTeam2Selection] = useState<TeamSelection>(emptySelection(""))
  const [team1Name, setTeam1Name] = useState("Team 1")
  const [team2Name, setTeam2Name] = useState("Team 2")
  const [formatId, setFormatId] = useState(DEFAULT_FORMAT_ID)
  const [totalGames, setTotalGames] = useState(50)
  const [aiDifficulty, setAiDifficulty] = useState("heuristic")
  const [batchState, setBatchState] = useState<BatchState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const format = useFormat(formatId)
  const gameType: GameType = format?.gameType ?? "singles"

  const team1Validation = useMemo(() => validatePaste(team1Selection.paste), [team1Selection.paste])
  const team2Validation = useMemo(() => validatePaste(team2Selection.paste), [team2Selection.paste])
  const canStart = team1Validation.valid && team2Validation.valid

  // Load sample teams from DB as defaults
  useEffect(() => {
    let cancelled = false
    fetchJson<Array<{ paste: string }>>(`/api/sample-teams?formatId=${formatId}`)
      .then((teams) => {
        if (cancelled) return
        if (teams.length >= 1 && !team1Selection.paste) {
          setTeam1Selection(emptySelection(teams[0].paste))
        }
        if (teams.length >= 2 && !team2Selection.paste) {
          setTeam2Selection(emptySelection(teams[1].paste))
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- only on mount

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  const startSimulation = async () => {
    setError(null)
    setPhase("running")

    try {
      const data = await postJson<{ id: string }>("/api/battles/batch", {
        formatId,
        simFormatId: format?.simFormatId,
        gameType,
        aiDifficulty,
        team1Paste: team1Selection.paste,
        team1Name,
        team2Paste: team2Selection.paste,
        team2Name,
        totalGames,
      })

      setBatchState({
        id: data.id,
        status: "running",
        completedGames: 0,
        totalGames,
        team1Wins: 0,
        team2Wins: 0,
        draws: 0,
        analytics: null,
      })

      // Poll for updates
      pollRef.current = setInterval(async () => {
        try {
          const statusData = await fetchJson<BatchState>(`/api/battles/batch/${data.id}`)
          setBatchState({ ...statusData, id: data.id })

          if (statusData.status === "completed" || statusData.status === "cancelled") {
            if (pollRef.current) clearInterval(pollRef.current)
            setPhase("results")
          }
        } catch {
          // Poll failure, keep trying
        }
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start simulation")
      setPhase("setup")
    }
  }

  return (
    <>
      <main className="container mx-auto p-4 max-w-4xl">
        <h1 className="text-2xl font-bold mb-6">Batch Battle Simulation</h1>

        {error && (
          <div className="text-destructive text-sm mb-4 p-3 border border-destructive/30 rounded-md">
            {error}
          </div>
        )}

        {phase === "setup" && (
          <div className="space-y-6">
            {/* Format & Settings */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-end gap-4 flex-wrap">
                  <div className="space-y-2 min-w-[200px]">
                    <Label>Format</Label>
                    <FormatSelector value={formatId} onChange={setFormatId} activeOnly />
                  </div>
                  <div className="space-y-2">
                    <Label>Number of Games</Label>
                    <Input
                      type="number"
                      min={10}
                      max={500}
                      value={totalGames}
                      onChange={(e) => setTotalGames(parseInt(e.target.value) || 50)}
                      className="w-28"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>AI Difficulty</Label>
                    <select
                      value={aiDifficulty}
                      onChange={(e) => setAiDifficulty(e.target.value)}
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="random">Random</option>
                      <option value="greedy">Greedy</option>
                      <option value="heuristic">Smart</option>
                      <option value="expert">Expert (MCTS)</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Team Pickers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardContent className="pt-6 space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="team1name">Team 1 Name</Label>
                    <Input
                      id="team1name"
                      value={team1Name}
                      onChange={(e) => setTeam1Name(e.target.value)}
                    />
                  </div>
                  <TeamPicker
                    label="Team 1"
                    formatId={formatId}
                    gameType={gameType}
                    selection={team1Selection}
                    onSelectionChange={setTeam1Selection}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="team2name">Team 2 Name</Label>
                    <Input
                      id="team2name"
                      value={team2Name}
                      onChange={(e) => setTeam2Name(e.target.value)}
                    />
                  </div>
                  <TeamPicker
                    label="Team 2"
                    formatId={formatId}
                    gameType={gameType}
                    selection={team2Selection}
                    onSelectionChange={setTeam2Selection}
                  />
                </CardContent>
              </Card>
            </div>

            {(!team1Validation.valid || !team2Validation.valid) && (
              <div className="text-destructive text-sm space-y-1">
                {team1Validation.errors.map((e, i) => (
                  <p key={`t1-${i}`}>Team 1: {e}</p>
                ))}
                {team2Validation.errors.map((e, i) => (
                  <p key={`t2-${i}`}>Team 2: {e}</p>
                ))}
              </div>
            )}

            <div className="flex justify-center">
              <Button onClick={startSimulation} disabled={!canStart} className="gap-1.5">
                <Play className="h-4 w-4" />
                Run Simulation
              </Button>
            </div>
          </div>
        )}

        {phase === "running" && batchState && (
          <div className="space-y-6 max-w-lg mx-auto text-center">
            <LoadingSpinner size="lg" label="Simulating..." />
            <Progress
              value={(batchState.completedGames / batchState.totalGames) * 100}
              className="w-full"
            />
            <p className="text-sm text-muted-foreground">
              {batchState.completedGames} / {batchState.totalGames} games completed
            </p>
            <div className="flex justify-center gap-6 text-sm">
              <span>
                {team1Name}: <strong>{batchState.team1Wins}</strong>
              </span>
              <span>
                {team2Name}: <strong>{batchState.team2Wins}</strong>
              </span>
              <span>
                Draws: <strong>{batchState.draws}</strong>
              </span>
            </div>
          </div>
        )}

        {phase === "results" && batchState && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Results
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-blue-500">{batchState.team1Wins}</div>
                    <div className="text-sm text-muted-foreground">{team1Name} Wins</div>
                    <div className="text-xs text-muted-foreground">
                      {batchState.analytics?.team1WinRate ??
                        Math.round((batchState.team1Wins / batchState.totalGames) * 100)}
                      %
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-muted-foreground">
                      {batchState.draws}
                    </div>
                    <div className="text-sm text-muted-foreground">Draws</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-500">{batchState.team2Wins}</div>
                    <div className="text-sm text-muted-foreground">{team2Name} Wins</div>
                    <div className="text-xs text-muted-foreground">
                      {batchState.analytics?.team2WinRate ??
                        Math.round((batchState.team2Wins / batchState.totalGames) * 100)}
                      %
                    </div>
                  </div>
                </div>

                {batchState.analytics && (
                  <div className="text-sm text-muted-foreground text-center pt-2 border-t">
                    Avg game length: {batchState.analytics.avgTurnCount} turns (
                    {batchState.analytics.minTurnCount}-{batchState.analytics.maxTurnCount} range)
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pokemon MVP Table */}
            {batchState.analytics && batchState.analytics.pokemonStats.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Pokemon Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground">
                          <th className="text-left py-2 px-2">Pokemon</th>
                          <th className="text-right py-2 px-2">Games</th>
                          <th className="text-right py-2 px-2">Faints</th>
                          <th className="text-right py-2 px-2">Faint Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {batchState.analytics.pokemonStats
                          .sort(
                            (a, b) =>
                              a.totalFaints / a.gamesAppeared - b.totalFaints / b.gamesAppeared,
                          )
                          .map((poke) => (
                            <tr key={poke.pokemonId} className="border-b last:border-0">
                              <td className="py-1.5 px-2 font-medium">{poke.name}</td>
                              <td className="text-right py-1.5 px-2">{poke.gamesAppeared}</td>
                              <td className="text-right py-1.5 px-2">{poke.totalFaints}</td>
                              <td className="text-right py-1.5 px-2">
                                {poke.gamesAppeared > 0
                                  ? `${Math.round((poke.totalFaints / poke.gamesAppeared) * 100)}%`
                                  : "—"}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Turn Distribution */}
            {batchState.analytics &&
              Object.keys(batchState.analytics.turnDistribution).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Game Length Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TurnDistributionChart distribution={batchState.analytics.turnDistribution} />
                  </CardContent>
                </Card>
              )}

            <Button
              variant="outline"
              onClick={() => {
                setPhase("setup")
                setBatchState(null)
              }}
            >
              New Simulation
            </Button>
          </div>
        )}
      </main>
    </>
  )
}
