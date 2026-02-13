"use client"

import { useState } from "react"
import { cn } from "@nasty-plot/ui"
import { Button } from "@/components/ui/button"
import { BattleSprite } from "./PokemonSprite"
import type { BattlePokemon } from "@nasty-plot/battle-engine"
import type { GameType } from "@nasty-plot/core"
import { Check } from "lucide-react"

const DOUBLES_PICK_COUNT = 4

interface TeamPreviewProps {
  playerTeam: BattlePokemon[]
  opponentTeam: BattlePokemon[]
  format: GameType
  onSubmit: (leadOrder: number[]) => void
  className?: string
}

export function TeamPreview({
  playerTeam,
  opponentTeam,
  format,
  onSubmit,
  className,
}: TeamPreviewProps) {
  const [selectedLead, setSelectedLead] = useState<number | null>(null)
  const [doublesOrder, setDoublesOrder] = useState<number[]>([])

  const isDoubles = format === "doubles"

  const handleSinglesSubmit = () => {
    if (selectedLead === null) return
    const rest = playerTeam.map((_, i) => i + 1).filter((pos) => pos !== selectedLead + 1)
    onSubmit([selectedLead + 1, ...rest])
  }

  const handleDoublesToggle = (index: number) => {
    setDoublesOrder((prev) => {
      if (prev.includes(index)) {
        return prev.filter((i) => i !== index)
      }
      if (prev.length >= DOUBLES_PICK_COUNT) return prev
      return [...prev, index]
    })
  }

  const handleDoublesSubmit = () => {
    if (doublesOrder.length !== DOUBLES_PICK_COUNT) return
    const order = doublesOrder.map((i) => i + 1)
    onSubmit(order)
  }

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

  // Singles render
  if (!isDoubles) {
    return (
      <div className={cn("space-y-6", className)}>
        <div className="text-center">
          <h2 className="text-lg font-bold">Team Preview</h2>
          <p className="text-sm text-muted-foreground">Select your lead Pokemon</p>
        </div>

        {opponentSection}
        {divider}

        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">Your Team</h3>
          <div className="flex gap-3 justify-center flex-wrap">
            {playerTeam.map((pokemon, i) => (
              <button
                key={i}
                onClick={() => setSelectedLead(i)}
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

  // Doubles render
  return (
    <div className={cn("space-y-6", className)}>
      <div className="text-center">
        <h2 className="text-lg font-bold">Team Preview</h2>
        <p className="text-sm text-muted-foreground">
          Pick {DOUBLES_PICK_COUNT} Pokemon in order — first 2 are your leads ({doublesOrder.length}
          /{DOUBLES_PICK_COUNT})
        </p>
      </div>

      {opponentSection}
      {divider}

      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-2">Your Team</h3>
        <div className="flex gap-3 justify-center flex-wrap">
          {playerTeam.map((pokemon, i) => {
            const position = doublesOrder.indexOf(i)
            const isSelected = position !== -1
            const isLead = position === 0 || position === 1
            return (
              <button
                key={i}
                onClick={() => handleDoublesToggle(i)}
                className={cn(
                  "flex flex-col items-center gap-1 p-2 rounded-lg",
                  "transition-all border-2",
                  isSelected
                    ? "border-primary bg-primary/10 shadow-md"
                    : doublesOrder.length >= DOUBLES_PICK_COUNT
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
                    <div
                      className={cn(
                        "absolute -top-1 -right-1 rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold",
                        isLead
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted-foreground text-background",
                      )}
                    >
                      {position + 1}
                    </div>
                  )}
                </div>
                <span className="text-xs font-medium">{pokemon.name}</span>
                {isLead && <span className="text-[10px] font-semibold text-primary">Lead</span>}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex justify-center">
        <Button
          onClick={handleDoublesSubmit}
          disabled={doublesOrder.length !== DOUBLES_PICK_COUNT}
          size="lg"
        >
          Start Battle
        </Button>
      </div>
    </div>
  )
}
