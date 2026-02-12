"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Swords, Bot, Sparkles, Brain, Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface QuickBattleCardProps {
  teamId: string
  formatId: string
}

export function QuickBattleCard({ teamId, formatId }: QuickBattleCardProps) {
  const router = useRouter()
  const [difficulty, setDifficulty] = useState("heuristic")
  const [isStarting, setIsStarting] = useState(false)

  const handleStartBattle = async () => {
    try {
      setIsStarting(true)
      const res = await fetch("/api/battles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formatId,
          playerTeamId: teamId,
          opponentOptions: {
            type: "ai",
            difficulty,
            // Random team for now, later could be sample team
            teamSource: "random",
          },
        }),
      })

      if (!res.ok) throw new Error("Failed to start battle")

      const { id } = await res.json()
      router.push(`/battle/live?id=${id}`)
    } catch (error) {
      console.error("Failed to start battle:", error)
      setIsStarting(false)
    }
  }

  const difficulties = [
    {
      id: "random",
      name: "Random",
      icon: Bot,
      description: "Makes completely random moves. Good for testing mechanics.",
      color: "text-muted-foreground",
    },
    {
      id: "greedy",
      name: "Greedy",
      icon: Swords,
      description: "Always picks the highest damage move.",
      color: "text-blue-500",
    },
    {
      id: "heuristic",
      name: "Heuristic",
      icon: Brain,
      description: "Uses basic strategy and type matchups.",
      color: "text-accent",
    },
    {
      id: "expert",
      name: "Expert (MCTS)",
      icon: Trophy,
      description: "Looks ahead to find winning lines. Runs slower.",
      color: "text-primary",
    },
  ]

  return (
    <Card className="border-primary/20 bg-linear-to-br from-card to-primary/5 overflow-hidden relative">
      <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
        <Swords className="w-32 h-32 text-primary" />
      </div>

      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl text-primary">
          <Sparkles className="w-5 h-5" />
          Test in Battle
        </CardTitle>
        <CardDescription>Instantly test this team against an AI opponent.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">AI Difficulty</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {difficulties.map((d) => (
              <button
                key={d.id}
                onClick={() => setDifficulty(d.id)}
                className={cn(
                  "flex flex-col items-start p-3 rounded-lg border text-left transition-all hover:bg-accent/10 hover:border-accent/50",
                  difficulty === d.id
                    ? "border-primary bg-primary/10 ring-1 ring-primary"
                    : "border-border bg-card/50",
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <d.icon className={cn("w-4 h-4", d.color)} />
                  <span className="font-semibold text-sm">{d.name}</span>
                </div>
                <span className="text-xs text-muted-foreground leading-tight">{d.description}</span>
              </button>
            ))}
          </div>
        </div>

        <Button
          className="w-full h-12 text-lg font-display shadow-lg shadow-primary/20 bg-linear-to-r from-primary to-purple-600 hover:to-purple-500 transition-all hover:scale-[1.01]"
          onClick={handleStartBattle}
          disabled={isStarting}
        >
          {isStarting ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin">🌀</span> Preparing...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Swords className="w-5 h-5" /> Start Battle
            </span>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
