"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { BattleSprite } from "./PokemonSprite"
import type { BattlePokemon, BattleFormat } from "@nasty-plot/battle-engine"
import { Check } from "lucide-react"

interface TeamPreviewProps {
  playerTeam: BattlePokemon[]
  opponentTeam: BattlePokemon[]
  format: BattleFormat
  onSubmit: (leadOrder: number[]) => void
  className?: string
}

type DoublesPhase = "pick" | "leads"

export function TeamPreview({
  playerTeam,
  opponentTeam,
  format,
  onSubmit,
  className,
}: TeamPreviewProps) {
  // --- Singles state ---
  const [selectedLead, setSelectedLead] = useState<number | null>(null)

  // --- Doubles state ---
  const [doublesPhase, setDoublesPhase] = useState<DoublesPhase>("pick")
  const [selectedBring, setSelectedBring] = useState<Set<number>>(new Set())
  const [selectedLeads, setSelectedLeads] = useState<number[]>([])

  const isDoubles = format === "doubles"

  // --- Singles handlers ---
  const handleSinglesSelect = (index: number) => {
    setSelectedLead(index)
  }

  const handleSinglesSubmit = () => {
    if (selectedLead === null) return
    const order: number[] = [selectedLead + 1]
    for (let i = 0; i < playerTeam.length; i++) {
      if (i !== selectedLead) {
        order.push(i + 1)
      }
    }
    onSubmit(order)
  }

  // --- Doubles handlers ---
  const handleDoublesToggleBring = (index: number) => {
    setSelectedBring((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else if (next.size < 4) {
        next.add(index)
      }
      return next
    })
  }

  const handleDoublesNextPhase = () => {
    if (selectedBring.size !== 4) return
    setDoublesPhase("leads")
    setSelectedLeads([])
  }

  const handleDoublesBackPhase = () => {
    setDoublesPhase("pick")
    setSelectedLeads([])
  }

  const handleDoublesSelectLead = (index: number) => {
    setSelectedLeads((prev) => {
      if (prev.includes(index)) {
        return prev.filter((i) => i !== index)
      }
      if (prev.length >= 2) return prev
      return [...prev, index]
    })
  }

  const handleDoublesSubmit = () => {
    if (selectedLeads.length !== 2) return
    const remaining = Array.from(selectedBring).filter((i) => !selectedLeads.includes(i))
    const order = [selectedLeads[0] + 1, selectedLeads[1] + 1, ...remaining.map((i) => i + 1)]
    onSubmit(order)
  }

  // --- Shared opponent team section ---
  const opponentSection = (
    <div>
      <h3 className="text-sm font-semibold text-muted-foreground mb-2">Opponent&apos;s Team</h3>
      <div className="flex gap-3 justify-center flex-wrap">
        {opponentTeam.map((pokemon, i) => (
          <div key={i} className="flex flex-col items-center gap-1 p-2 rounded-lg bg-muted/50">
            <BattleSprite speciesId={pokemon.speciesId || pokemon.name} side="front" size={64} />
            <span className="text-xs font-medium">{pokemon.name}</span>
          </div>
        ))}
      </div>
    </div>
  )

  const divider = (
    <div className="flex items-center gap-4">
      <div className="flex-1 border-t" />
      <span className="text-xs text-muted-foreground font-semibold">VS</span>
      <div className="flex-1 border-t" />
    </div>
  )

  // --- Singles render ---
  if (!isDoubles) {
    return (
      <div className={cn("space-y-6", className)}>
        <div className="text-center">
          <h2 className="text-lg font-bold">Team Preview</h2>
          <p className="text-sm text-muted-foreground">Select your lead Pokemon</p>
        </div>

        {opponentSection}
        {divider}

        {/* Player team */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">Your Team</h3>
          <div className="flex gap-3 justify-center flex-wrap">
            {playerTeam.map((pokemon, i) => (
              <button
                key={i}
                onClick={() => handleSinglesSelect(i)}
                className={cn(
                  "flex flex-col items-center gap-1 p-2 rounded-lg",
                  "transition-all border-2",
                  selectedLead === i
                    ? "border-primary bg-primary/10 shadow-md"
                    : "border-transparent hover:bg-accent",
                )}
              >
                <div className="relative">
                  <BattleSprite
                    speciesId={pokemon.speciesId || pokemon.name}
                    side="back"
                    size={64}
                  />
                  {selectedLead === i && (
                    <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                      <Check className="h-3 w-3" />
                    </div>
                  )}
                </div>
                <span className="text-xs font-medium">{pokemon.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-center">
          <Button onClick={handleSinglesSubmit} disabled={selectedLead === null} size="lg">
            Start Battle
          </Button>
        </div>
      </div>
    )
  }

  // --- Doubles: Pick phase ---
  if (doublesPhase === "pick") {
    return (
      <div className={cn("space-y-6", className)}>
        <div className="text-center">
          <h2 className="text-lg font-bold">Team Preview</h2>
          <p className="text-sm text-muted-foreground">
            Select 4 Pokemon to bring ({selectedBring.size}/4 selected)
          </p>
        </div>

        {opponentSection}
        {divider}

        {/* Player team - pick 4 */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">Your Team</h3>
          <div className="flex gap-3 justify-center flex-wrap">
            {playerTeam.map((pokemon, i) => {
              const isSelected = selectedBring.has(i)
              return (
                <button
                  key={i}
                  onClick={() => handleDoublesToggleBring(i)}
                  className={cn(
                    "flex flex-col items-center gap-1 p-2 rounded-lg",
                    "transition-all border-2",
                    isSelected
                      ? "border-primary bg-primary/10 shadow-md"
                      : selectedBring.size >= 4
                        ? "border-transparent opacity-40 cursor-not-allowed"
                        : "border-transparent hover:bg-accent",
                  )}
                >
                  <div className="relative">
                    <BattleSprite
                      speciesId={pokemon.speciesId || pokemon.name}
                      side="back"
                      size={64}
                    />
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                  </div>
                  <span className="text-xs font-medium">{pokemon.name}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex justify-center">
          <Button onClick={handleDoublesNextPhase} disabled={selectedBring.size !== 4} size="lg">
            Next: Choose Leads
          </Button>
        </div>
      </div>
    )
  }

  // --- Doubles: Leads phase ---
  const bringIndices = Array.from(selectedBring).sort((a, b) => a - b)

  return (
    <div className={cn("space-y-6", className)}>
      <div className="text-center">
        <h2 className="text-lg font-bold">Team Preview</h2>
        <p className="text-sm text-muted-foreground">
          Select 2 leads ({selectedLeads.length}/2 selected)
        </p>
      </div>

      {opponentSection}
      {divider}

      {/* Player team - pick 2 leads from 4 selected */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-2">Your Pokemon</h3>
        <div className="flex gap-3 justify-center flex-wrap">
          {bringIndices.map((i) => {
            const pokemon = playerTeam[i]
            const leadPosition = selectedLeads.indexOf(i)
            const isLead = leadPosition !== -1
            return (
              <button
                key={i}
                onClick={() => handleDoublesSelectLead(i)}
                className={cn(
                  "flex flex-col items-center gap-1 p-2 rounded-lg",
                  "transition-all border-2",
                  isLead
                    ? "border-primary bg-primary/10 shadow-md"
                    : selectedLeads.length >= 2
                      ? "border-transparent opacity-60"
                      : "border-transparent hover:bg-accent",
                )}
              >
                <div className="relative">
                  <BattleSprite
                    speciesId={pokemon.speciesId || pokemon.name}
                    side="back"
                    size={64}
                  />
                  {isLead && (
                    <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">
                      {leadPosition + 1}
                    </div>
                  )}
                </div>
                <span className="text-xs font-medium">{pokemon.name}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex justify-center gap-3">
        <Button onClick={handleDoublesBackPhase} variant="outline" size="lg">
          Back
        </Button>
        <Button onClick={handleDoublesSubmit} disabled={selectedLeads.length !== 2} size="lg">
          Start Battle
        </Button>
      </div>
    </div>
  )
}
