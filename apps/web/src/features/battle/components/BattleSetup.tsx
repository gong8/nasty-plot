"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import type { AIDifficulty, BattleFormat } from "@nasty-plot/battle-engine"
import { Swords, Zap, Brain, Cpu } from "lucide-react"
import { FormatSelector } from "./FormatSelector"
import { TeamPicker, type TeamSelection } from "./TeamPicker"
import { useFormat } from "../hooks/use-formats"
import type { GameType } from "@nasty-plot/core"

interface BattleSetupProps {
  onStart: (config: {
    playerTeamPaste: string
    opponentTeamPaste: string
    playerTeamId: string | null
    opponentTeamId: string | null
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

const emptySelection = (paste: string): TeamSelection => ({
  teamId: null,
  paste,
  source: "paste",
})

export function BattleSetup({ onStart }: BattleSetupProps) {
  const [playerSelection, setPlayerSelection] = useState<TeamSelection>(
    emptySelection(SAMPLE_TEAM_1),
  )
  const [opponentSelection, setOpponentSelection] = useState<TeamSelection>(
    emptySelection(SAMPLE_TEAM_2),
  )
  const [formatId, setFormatId] = useState("gen9ou")
  const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>("greedy")
  const prevGameTypeRef = useRef<GameType>("singles")

  const format = useFormat(formatId)
  const gameType: GameType = format?.gameType ?? "singles"

  const handleFormatChange = (newFormatId: string) => {
    setFormatId(newFormatId)
  }

  // Clear selections when gameType changes (e.g. switching from singles to doubles)
  // but keep them when staying in the same gameType (e.g. OU to UU)
  if (gameType !== prevGameTypeRef.current) {
    prevGameTypeRef.current = gameType
    // If selections reference saved teams, clear them since they may be incompatible
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
              <FormatSelector value={formatId} onChange={handleFormatChange} activeOnly />
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
            />
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-center">
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
              gameType: gameType as BattleFormat,
              aiDifficulty,
            })
          }
          disabled={!playerSelection.paste.trim() || !opponentSelection.paste.trim()}
          className="px-8"
        >
          <Swords className="h-4 w-4 mr-2" />
          Start Battle
        </Button>
      </div>
    </div>
  )
}
