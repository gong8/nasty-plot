"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { TeamData } from "@nasty-plot/core"
import type { AIDifficulty, BattleFormat } from "@nasty-plot/battle-engine"
import { Swords, Zap, Brain, Cpu } from "lucide-react"

interface BattleSetupProps {
  onStart: (config: {
    playerTeamPaste: string
    opponentTeamPaste: string
    formatId: string
    gameType: BattleFormat
    aiDifficulty: AIDifficulty
  }) => void
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

const FORMAT_OPTIONS = [
  { value: "gen9ou", label: "Gen 9 OU", gameType: "singles" as BattleFormat },
  { value: "gen9vgc2024regh", label: "VGC 2024 Reg H", gameType: "doubles" as BattleFormat },
  { value: "gen9uu", label: "Gen 9 UU", gameType: "singles" as BattleFormat },
  { value: "gen9monotype", label: "Gen 9 Monotype", gameType: "singles" as BattleFormat },
  { value: "gen9doublesou", label: "Gen 9 Doubles OU", gameType: "doubles" as BattleFormat },
  { value: "gen9randombattle", label: "Random Battle", gameType: "singles" as BattleFormat },
]

const SAMPLE_TEAM_1 = `Garchomp @ Life Orb
Ability: Rough Skin
Level: 100
Tera Type: Ground
EVs: 252 Atk / 4 SpD / 252 Spe
Jolly Nature
- Earthquake
- Dragon Claw
- Swords Dance
- Scale Shot

Heatran @ Leftovers
Ability: Flash Fire
Level: 100
Tera Type: Fairy
EVs: 252 HP / 4 SpA / 252 SpD
Calm Nature
- Magma Storm
- Earth Power
- Flash Cannon
- Taunt

Clefable @ Leftovers
Ability: Unaware
Level: 100
Tera Type: Water
EVs: 252 HP / 252 Def / 4 SpD
Bold Nature
- Moonblast
- Flamethrower
- Thunder Wave
- Soft-Boiled

Weavile @ Choice Band
Ability: Pressure
Level: 100
Tera Type: Dark
EVs: 252 Atk / 4 SpD / 252 Spe
Jolly Nature
- Triple Axel
- Knock Off
- Ice Shard
- Low Kick

Slowbro @ Colbur Berry
Ability: Regenerator
Level: 100
Tera Type: Poison
EVs: 252 HP / 252 Def / 4 SpA
Bold Nature
- Scald
- Psychic
- Slack Off
- Thunder Wave

Dragapult @ Choice Specs
Ability: Infiltrator
Level: 100
Tera Type: Ghost
EVs: 4 HP / 252 SpA / 252 Spe
Timid Nature
- Shadow Ball
- Draco Meteor
- Flamethrower
- U-turn`

const SAMPLE_TEAM_2 = `Tyranitar @ Leftovers
Ability: Sand Stream
Level: 100
Tera Type: Water
EVs: 252 HP / 4 Atk / 252 SpD
Careful Nature
- Stone Edge
- Crunch
- Stealth Rock
- Thunder Wave

Iron Valiant @ Booster Energy
Ability: Quark Drive
Level: 100
Tera Type: Fairy
EVs: 4 HP / 252 SpA / 252 Spe
Timid Nature
- Moonblast
- Aura Sphere
- Thunderbolt
- Calm Mind

Corviknight @ Leftovers
Ability: Pressure
Level: 100
Tera Type: Water
EVs: 252 HP / 168 Def / 88 SpD
Impish Nature
- Brave Bird
- Body Press
- Defog
- Roost

Toxapex @ Black Sludge
Ability: Regenerator
Level: 100
Tera Type: Water
EVs: 252 HP / 252 Def / 4 SpD
Bold Nature
- Scald
- Toxic Spikes
- Recover
- Haze

Great Tusk @ Heavy-Duty Boots
Ability: Protosynthesis
Level: 100
Tera Type: Ground
EVs: 252 HP / 252 Atk / 4 Spe
Adamant Nature
- Earthquake
- Close Combat
- Rapid Spin
- Knock Off

Gholdengo @ Air Balloon
Ability: Good as Gold
Level: 100
Tera Type: Flying
EVs: 4 HP / 252 SpA / 252 Spe
Timid Nature
- Shadow Ball
- Make It Rain
- Recover
- Nasty Plot`

interface SampleTeam {
  id: string
  name: string
  formatId: string
  archetype: string | null
  paste: string
}

export function BattleSetup({ onStart }: BattleSetupProps) {
  const [teams, setTeams] = useState<TeamData[]>([])
  const [sampleTeams, setSampleTeams] = useState<SampleTeam[]>([])
  const [playerTeamPaste, setPlayerTeamPaste] = useState(SAMPLE_TEAM_1)
  const [opponentTeamPaste, setOpponentTeamPaste] = useState(SAMPLE_TEAM_2)
  const [formatId, setFormatId] = useState("gen9ou")
  const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>("greedy")

  // Fetch saved teams
  useEffect(() => {
    fetch("/api/teams")
      .then((r) => r.json())
      .then((data) => {
        if (data.data) setTeams(data.data)
      })
      .catch(() => {}) // Ignore errors, paste input is primary
  }, [])

  // Fetch sample teams for the selected format
  useEffect(() => {
    fetch(`/api/sample-teams?formatId=${formatId}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setSampleTeams(data)
        else setSampleTeams([])
      })
      .catch(() => setSampleTeams([]))
  }, [formatId])

  const handleLoadSampleTeam = (sampleTeamId: string, target: "player" | "opponent") => {
    const sample = sampleTeams.find((t) => t.id === sampleTeamId)
    if (sample?.paste) {
      if (target === "player") {
        setPlayerTeamPaste(sample.paste)
      } else {
        setOpponentTeamPaste(sample.paste)
      }
    }
  }

  const handleLoadTeam = async (teamId: string, target: "player" | "opponent") => {
    try {
      const res = await fetch(`/api/teams/${teamId}/export`)
      const data = await res.json()
      if (data.data?.paste) {
        if (target === "player") {
          setPlayerTeamPaste(data.data.paste)
        } else {
          setOpponentTeamPaste(data.data.paste)
        }
      }
    } catch {
      // Failed to load team
    }
  }

  const selectedFormat = FORMAT_OPTIONS.find((f) => f.value === formatId)
  const gameType = selectedFormat?.gameType || "singles"

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">New Battle</h1>
        <p className="text-muted-foreground">Set up a battle between two teams</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Player team */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Your Team</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {teams.length > 0 && (
              <div>
                <Label className="text-xs">Load saved team</Label>
                <Select onValueChange={(v) => handleLoadTeam(v, "player")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a team..." />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({t.formatId})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {sampleTeams.length > 0 && (
              <div>
                <Label className="text-xs">Load sample team</Label>
                <Select onValueChange={(v) => handleLoadSampleTeam(v, "player")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Browse sample teams..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sampleTeams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                        {t.archetype ? ` (${t.archetype})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-xs">Team paste (Showdown format)</Label>
              <Textarea
                value={playerTeamPaste}
                onChange={(e) => setPlayerTeamPaste(e.target.value)}
                placeholder="Paste your team here..."
                className="font-mono text-xs min-h-[200px]"
              />
            </div>
          </CardContent>
        </Card>

        {/* Opponent team */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Opponent Team</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {teams.length > 0 && (
              <div>
                <Label className="text-xs">Load saved team</Label>
                <Select onValueChange={(v) => handleLoadTeam(v, "opponent")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a team..." />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({t.formatId})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {sampleTeams.length > 0 && (
              <div>
                <Label className="text-xs">Load sample team</Label>
                <Select onValueChange={(v) => handleLoadSampleTeam(v, "opponent")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Browse sample teams..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sampleTeams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                        {t.archetype ? ` (${t.archetype})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-xs">Team paste (Showdown format)</Label>
              <Textarea
                value={opponentTeamPaste}
                onChange={(e) => setOpponentTeamPaste(e.target.value)}
                placeholder="Paste opponent team here..."
                className="font-mono text-xs min-h-[200px]"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Settings */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Format</Label>
              <Select value={formatId} onValueChange={setFormatId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMAT_OPTIONS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

      <div className="flex justify-center">
        <Button
          size="lg"
          onClick={() =>
            onStart({
              playerTeamPaste,
              opponentTeamPaste,
              formatId,
              gameType,
              aiDifficulty,
            })
          }
          disabled={!playerTeamPaste.trim() || !opponentTeamPaste.trim()}
          className="px-8"
        >
          <Swords className="h-4 w-4 mr-2" />
          Start Battle
        </Button>
      </div>
    </div>
  )
}
