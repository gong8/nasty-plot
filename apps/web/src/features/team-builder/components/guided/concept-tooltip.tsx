"use client"

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface ConceptTooltipProps {
  term: string
  children: React.ReactNode
}

const CONCEPT_DICTIONARY: Record<string, string> = {
  STAB: "Same-Type Attack Bonus — moves matching the user's type deal 50% more damage",
  pivot:
    "A Pokemon that switches in to take hits and switches out with moves like U-turn or Volt Switch",
  "hazard setter":
    "Sets entry hazards (Stealth Rock, Spikes, Toxic Spikes) that damage opponents on switch-in",
  "hazard removal": "Removes entry hazards using Rapid Spin or Defog",
  wallbreaker: "A powerful attacker that breaks through defensive Pokemon",
  "revenge killer": "A fast Pokemon brought in after a teammate faints to KO the opponent",
  sweeper: "A Pokemon that aims to knock out multiple opponents, usually after a stat boost",
  check: "A Pokemon that can switch in on or force out a specific threat",
  counter: "A Pokemon that can reliably switch into and beat a specific threat",
  coverage: "Moves of different types to hit a wider range of opponents super-effectively",
  "win condition": "The Pokemon or strategy your team relies on to close out games",
  "speed tier": "Where a Pokemon sits relative to others in terms of Speed stat",
  "EV spread":
    "How Effort Values are distributed across stats — determines a Pokemon's stat priorities",
  nature: "Boosts one stat by 10% and lowers another by 10%, shaping a Pokemon's role",
  "tera type": "A type change available once per battle that changes the Pokemon's type and STAB",
}

export function ConceptTooltip({ term, children }: ConceptTooltipProps) {
  const definition = CONCEPT_DICTIONARY[term]

  if (!definition) {
    return <>{children}</>
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help border-b border-dotted border-muted-foreground/60">
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">{definition}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
