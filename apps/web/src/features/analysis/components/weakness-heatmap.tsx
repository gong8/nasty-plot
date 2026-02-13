"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  POKEMON_TYPES,
  getTypeEffectiveness,
  type PokemonType,
  type TeamSlotData,
} from "@nasty-plot/core"
import { cn, TypeBadge } from "@nasty-plot/ui"

interface WeaknessHeatmapProps {
  slots: TeamSlotData[]
}

function getEffectivenessStyle(multiplier: number): {
  bg: string
  text: string
  label: string
} {
  if (multiplier === 0) return { bg: "bg-muted", text: "text-muted-foreground", label: "0x" }
  if (multiplier === 0.25)
    return { bg: "bg-green-800/70", text: "text-green-100", label: "\u00BCx" }
  if (multiplier === 0.5) return { bg: "bg-green-600/50", text: "text-green-100", label: "\u00BDx" }
  if (multiplier === 1) return { bg: "bg-muted/30", text: "text-muted-foreground", label: "1x" }
  if (multiplier === 2) return { bg: "bg-red-500/50", text: "text-red-100", label: "2x" }
  if (multiplier >= 4) return { bg: "bg-red-700/70", text: "text-red-100", label: "4x" }
  return { bg: "bg-muted/30", text: "text-muted-foreground", label: `${multiplier}x` }
}

export function WeaknessHeatmap({ slots }: WeaknessHeatmapProps) {
  if (slots.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Weakness Heatmap</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Add Pokemon to your team to see defensive matchups.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Weakness Heatmap</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="w-full">
          <div className="min-w-max">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left p-1.5 font-medium sticky left-0 bg-card z-10 min-w-[100px]">
                    Pokemon
                  </th>
                  {POKEMON_TYPES.map((type) => (
                    <th key={type} className="p-1 text-center min-w-[38px]">
                      <TypeBadge
                        type={type}
                        size="sm"
                        label={type.slice(0, 3)}
                        className="text-[9px] px-1 py-px rounded min-w-0"
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slots.map((slot) => {
                  const pokemonName = slot.species?.name ?? slot.pokemonId
                  const types = (slot.species?.types ?? []) as PokemonType[]

                  return (
                    <tr key={slot.position} className="border-t">
                      <td className="p-1.5 font-medium sticky left-0 bg-card z-10">
                        <div className="flex items-center gap-1.5">
                          <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[9px]">
                            {pokemonName.slice(0, 2)}
                          </div>
                          <span className="truncate max-w-[80px]">{pokemonName}</span>
                        </div>
                      </td>
                      {POKEMON_TYPES.map((attackType) => {
                        const multiplier =
                          types.length > 0 ? getTypeEffectiveness(attackType, types) : 1
                        const style = getEffectivenessStyle(multiplier)

                        return (
                          <td key={attackType} className="p-0.5">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className={cn(
                                    "rounded text-center py-1 px-0.5 text-[10px] font-mono cursor-default",
                                    style.bg,
                                    style.text,
                                  )}
                                >
                                  {style.label}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">
                                  {attackType} vs {pokemonName}: {style.label}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
                {/* Summary row */}
                <tr className="border-t-2 font-medium">
                  <td className="p-1.5 sticky left-0 bg-card z-10 text-xs">Total</td>
                  {POKEMON_TYPES.map((attackType) => {
                    let weakCount = 0
                    let resistCount = 0
                    for (const slot of slots) {
                      const types = (slot.species?.types ?? []) as PokemonType[]
                      if (types.length === 0) continue
                      const eff = getTypeEffectiveness(attackType, types)
                      if (eff > 1) weakCount++
                      else if (eff < 1) resistCount++
                    }

                    const net = resistCount - weakCount
                    let bgClass = "bg-muted/20"
                    if (weakCount >= 3) bgClass = "bg-red-600/40"
                    else if (weakCount >= 2 && resistCount === 0) bgClass = "bg-red-500/30"
                    else if (net > 0) bgClass = "bg-green-500/20"
                    else if (net < 0) bgClass = "bg-red-400/20"

                    return (
                      <td key={attackType} className="p-0.5">
                        <div
                          className={cn("rounded text-center py-1 text-[10px] font-mono", bgClass)}
                        >
                          {weakCount > 0 && (
                            <span className="text-red-500 dark:text-red-400">{weakCount}W</span>
                          )}
                          {weakCount > 0 && resistCount > 0 && "/"}
                          {resistCount > 0 && (
                            <span className="text-green-600 dark:text-green-400">
                              {resistCount}R
                            </span>
                          )}
                          {weakCount === 0 && resistCount === 0 && "-"}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              </tbody>
            </table>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
