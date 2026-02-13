"use client"

import { useState, useRef, useMemo, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import type { AIDifficulty } from "@nasty-plot/battle-engine"
import { Swords, Zap, Brain, Cpu } from "lucide-react"
import { FormatSelector } from "./FormatSelector"
import { TeamPicker, type TeamSelection } from "./TeamPicker"
import { useFormat } from "../hooks/use-formats"
import { DEFAULT_FORMAT_ID, parseShowdownPaste, type GameType } from "@nasty-plot/core"
import type { TeamValidation } from "../types"
import { fetchJson } from "@/lib/api-client"

interface BattleSetupProps {
  onStart: (config: {
    playerTeamPaste: string
    opponentTeamPaste: string
    playerTeamId: string | null
    opponentTeamId: string | null
    formatId: string
    simFormatId?: string
    gameType: GameType
    aiDifficulty: AIDifficulty
  }) => void
  initialTeamId?: string
  initialFormatId?: string
}

const AI_OPTIONS: {
  value: AIDifficulty
  label: string
  description: string
  icon: typeof Swords
}[] = [
  { value: "random", label: "Random", description: "Picks random legal moves", icon: Swords },
  { value: "greedy", label: "Greedy", description: "Picks the highest damage move", icon: Zap },
  {
    value: "heuristic",
    label: "Smart",
    description: "Type-aware switching and status",
    icon: Brain,
  },
  {
    value: "expert",
    label: "Expert",
    description: "MCTS tree search (slower, strongest)",
    icon: Cpu,
  },
]

const emptySelection = (paste: string): TeamSelection => ({
  teamId: null,
  paste,
  source: "paste",
})

function validatePaste(paste: string): TeamValidation {
  const trimmed = paste.trim()
  if (!trimmed) {
    return { valid: false, pokemonCount: 0, errors: ["No team selected"] }
  }

  const parsed = parseShowdownPaste(trimmed)
  if (parsed.length === 0) {
    return {
      valid: false,
      pokemonCount: 0,
      errors: ["Could not parse team — check Showdown format"],
    }
  }

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

  return { valid: errors.length === 0, pokemonCount: parsed.length, errors }
}

export function BattleSetup({ onStart, initialTeamId, initialFormatId }: BattleSetupProps) {
  const [playerSelection, setPlayerSelection] = useState<TeamSelection>(emptySelection(""))
  const [opponentSelection, setOpponentSelection] = useState<TeamSelection>(emptySelection(""))
  const [formatId, setFormatId] = useState(initialFormatId || DEFAULT_FORMAT_ID)
  const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>("greedy")

  // Load sample teams from DB as defaults
  useEffect(() => {
    let cancelled = false
    fetchJson<Array<{ paste: string }>>(`/api/sample-teams?formatId=${formatId}`)
      .then((teams) => {
        if (cancelled) return
        if (teams.length >= 1 && !playerSelection.paste) {
          setPlayerSelection(emptySelection(teams[0].paste))
        }
        if (teams.length >= 2 && !opponentSelection.paste) {
          setOpponentSelection(emptySelection(teams[1].paste))
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- only on mount

  // Auto-select the player team when initialTeamId is provided
  useEffect(() => {
    if (!initialTeamId) return
    let cancelled = false
    fetch(`/api/teams/${initialTeamId}/export`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load team")
        return res.text()
      })
      .then((paste) => {
        if (!cancelled) {
          setPlayerSelection({ teamId: initialTeamId, paste, source: "saved" })
        }
      })
      .catch(() => {
        // Silently fail — user can pick manually
      })
    return () => {
      cancelled = true
    }
  }, [initialTeamId])
  const prevGameTypeRef = useRef<GameType>("singles")

  const format = useFormat(formatId)
  const gameType: GameType = format?.gameType ?? "singles"

  const playerValidation = useMemo(
    () => validatePaste(playerSelection.paste),
    [playerSelection.paste],
  )
  const opponentValidation = useMemo(
    () => validatePaste(opponentSelection.paste),
    [opponentSelection.paste],
  )
  const canStart = playerValidation.valid && opponentValidation.valid

  // Clear saved-team selections when gameType changes (e.g. singles -> doubles)
  if (gameType !== prevGameTypeRef.current) {
    prevGameTypeRef.current = gameType
    if (playerSelection.source === "saved") {
      setPlayerSelection(emptySelection(""))
    }
    if (opponentSelection.source === "saved") {
      setOpponentSelection(emptySelection(""))
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">New Battle</h1>
        <p className="text-muted-foreground">Set up a battle between two teams</p>
      </div>

      {/* Format & AI Settings */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Format</Label>
              <FormatSelector value={formatId} onChange={setFormatId} activeOnly />
            </div>

            <div>
              <Label>AI Difficulty</Label>
              <div className="flex gap-2 mt-1">
                {AI_OPTIONS.map((opt) => {
                  const Icon = opt.icon
                  return (
                    <Button
                      key={opt.value}
                      variant={aiDifficulty === opt.value ? "default" : "outline"}
                      size="sm"
                      className="flex-1 gap-1.5"
                      onClick={() => setAiDifficulty(opt.value)}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {opt.label}
                    </Button>
                  )
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {AI_OPTIONS.find((o) => o.value === aiDifficulty)?.description}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Team Pickers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardContent className="pt-6">
            <TeamPicker
              label="Your Team"
              formatId={formatId}
              gameType={gameType}
              selection={playerSelection}
              onSelectionChange={setPlayerSelection}
              validation={playerValidation}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <TeamPicker
              label="Opponent Team"
              formatId={formatId}
              gameType={gameType}
              selection={opponentSelection}
              onSelectionChange={setOpponentSelection}
              validation={opponentValidation}
            />
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col items-center gap-2">
        <Button
          size="lg"
          onClick={() =>
            onStart({
              playerTeamPaste: playerSelection.paste,
              opponentTeamPaste: opponentSelection.paste,
              playerTeamId: playerSelection.source === "saved" ? playerSelection.teamId : null,
              opponentTeamId:
                opponentSelection.source === "saved" ? opponentSelection.teamId : null,
              formatId,
              simFormatId: format?.simFormatId,
              gameType: gameType as GameType,
              aiDifficulty,
            })
          }
          disabled={!canStart}
          className="px-8"
        >
          <Swords className="h-4 w-4 mr-2" />
          Start Battle
        </Button>
        {!canStart && (playerSelection.paste.trim() || opponentSelection.paste.trim()) && (
          <p className="text-xs text-destructive text-center max-w-md">
            {[
              ...playerValidation.errors.map((e) => `Your team: ${e}`),
              ...opponentValidation.errors.map((e) => `Opponent: ${e}`),
            ].join(" · ")}
          </p>
        )}
      </div>
    </div>
  )
}
