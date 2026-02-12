"use client"

import { cn, TypeBadge } from "@nasty-plot/ui"
import type { BattleActionSet, BattlePokemon } from "@nasty-plot/battle-engine"
import { Button } from "@/components/ui/button"
import { HealthBar } from "./HealthBar"
import { BattleSprite } from "./PokemonSprite"
import { ArrowLeft } from "lucide-react"

interface SwitchMenuProps {
  actions: BattleActionSet
  onSwitch: (pokemonIndex: number) => void
  onBack?: () => void
  /** Full team data for showing types and moves */
  team?: BattlePokemon[]
  className?: string
}

const STATUS_LABELS: Record<string, string> = {
  brn: "BRN",
  par: "PAR",
  slp: "SLP",
  frz: "FRZ",
  psn: "PSN",
  tox: "TOX",
}

const STATUS_COLORS: Record<string, string> = {
  brn: "text-red-500 bg-red-500/10",
  par: "text-yellow-500 bg-yellow-500/10",
  slp: "text-muted-foreground bg-muted-foreground/10",
  frz: "text-cyan-400 bg-cyan-400/10",
  psn: "text-purple-500 bg-purple-500/10",
  tox: "text-purple-600 dark:text-purple-400 bg-purple-600/10 dark:bg-purple-400/15",
}

export function SwitchMenu({ actions, onSwitch, onBack, team, className }: SwitchMenuProps) {
  /** Find team data for a switch option by species */
  function getTeamPokemon(speciesId: string): BattlePokemon | undefined {
    return team?.find(
      (p) =>
        p.speciesId === speciesId || p.name.toLowerCase().replace(/[^a-z0-9]/g, "") === speciesId,
    )
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          {actions.forceSwitch ? "Choose a Pokemon to send out" : "Switch Pokemon"}
        </h3>
        {onBack && !actions.forceSwitch && (
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        {actions.switches.map((sw) => {
          const pokemon = getTeamPokemon(sw.speciesId)
          return (
            <button
              key={sw.index}
              onClick={() => onSwitch(sw.index)}
              disabled={sw.fainted}
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded-lg border",
                "transition-colors hover:bg-accent text-left",
                "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent",
                sw.fainted && "line-through",
              )}
            >
              <BattleSprite speciesId={sw.speciesId} side="front" fainted={sw.fainted} size={36} />

              <div className="flex-1 min-w-0 space-y-0.5">
                {/* Name + status */}
                <div className="flex items-center gap-1">
                  <span className="font-medium text-xs truncate">{sw.name}</span>
                  {sw.status && (
                    <span
                      className={cn(
                        "text-[9px] px-1 rounded font-semibold shrink-0",
                        STATUS_COLORS[sw.status] || "text-muted-foreground",
                      )}
                    >
                      {STATUS_LABELS[sw.status] || sw.status.toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Type badges */}
                {pokemon?.types && pokemon.types.length > 0 && (
                  <div className="flex gap-0.5">
                    {pokemon.types.map((t) => (
                      <TypeBadge key={t} type={t} size="sm" className="min-w-0 px-1.5 text-[8px]" />
                    ))}
                  </div>
                )}

                {/* HP bar */}
                <HealthBar hp={sw.hp} maxHp={sw.maxHp} showText={false} className="w-full" />
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
