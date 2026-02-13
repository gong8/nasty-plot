"use client"

import { cn, TypeBadge } from "@nasty-plot/ui"
import { STATUS_BADGE_CONFIG } from "@nasty-plot/core"
import type { BattleActionSet, BattlePokemon } from "@nasty-plot/battle-engine"
import { Button } from "@/components/ui/button"
import { HealthBar } from "./HealthBar"
import { PokemonSprite } from "@nasty-plot/ui"
import { ArrowLeft } from "lucide-react"

interface SwitchMenuProps {
  actions: BattleActionSet
  onSwitch: (pokemonIndex: number) => void
  onBack?: () => void
  /** Full team data for showing types and moves */
  team?: BattlePokemon[]
  className?: string
}

const NON_ALPHANUMERIC = /[^a-z0-9]/g

function toSpeciesKey(name: string): string {
  return name.toLowerCase().replace(NON_ALPHANUMERIC, "")
}

export function SwitchMenu({ actions, onSwitch, onBack, team, className }: SwitchMenuProps) {
  function findTeamPokemon(pokemonId: string): BattlePokemon | undefined {
    return team?.find((p) => p.pokemonId === pokemonId || toSpeciesKey(p.name) === pokemonId)
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
          const pokemon = findTeamPokemon(sw.pokemonId)
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
              <PokemonSprite
                pokemonId={sw.pokemonId}
                side="front"
                fainted={sw.fainted}
                size={36}
                animated
              />

              <div className="flex-1 min-w-0 space-y-0.5">
                {/* Name + status */}
                <div className="flex items-center gap-1">
                  <span className="font-medium text-xs truncate">{sw.name}</span>
                  {sw.status && STATUS_BADGE_CONFIG[sw.status] && (
                    <span
                      className={cn(
                        "text-[9px] px-1 rounded font-semibold shrink-0 text-white",
                        STATUS_BADGE_CONFIG[sw.status].color,
                      )}
                    >
                      {STATUS_BADGE_CONFIG[sw.status].label}
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
