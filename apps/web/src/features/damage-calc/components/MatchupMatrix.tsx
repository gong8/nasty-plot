"use client"

import { ScrollArea, ScrollBar } from "@/components/ui/ScrollArea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { AnalysisCard } from "@/components/AnalysisCard"
import { cn } from "@nasty-plot/ui"
import { PokemonAvatar } from "@/components/PokemonAvatar"
import type { MatchupMatrixEntry } from "@nasty-plot/core"

interface MatchupMatrixProps {
  matrix: MatchupMatrixEntry[][] | undefined
  isLoading?: boolean
}

function getDamageColor(maxPercent: number): string {
  if (maxPercent >= 100) return "bg-red-500/80 text-white"
  if (maxPercent >= 66) return "bg-red-400/60 text-red-950 dark:text-red-100"
  if (maxPercent >= 50) return "bg-orange-400/60 text-orange-950 dark:text-orange-100"
  if (maxPercent >= 33) return "bg-yellow-400/60 text-yellow-950 dark:text-yellow-100"
  if (maxPercent >= 20) return "bg-green-300/60 text-green-950 dark:text-green-100"
  return "bg-green-200/40 text-green-900 dark:bg-green-800/40 dark:text-green-200"
}

export function MatchupMatrix({ matrix, isLoading }: MatchupMatrixProps) {
  // Extract unique defender names from first row
  const defenderNames = matrix?.[0]?.map((entry) => entry.defenderName) ?? []

  return (
    <AnalysisCard
      title="Matchup Matrix"
      isLoading={isLoading}
      isEmpty={!matrix || matrix.length === 0}
      emptyMessage="No matchup data available. Add team members and threats to see the matrix."
    >
      <ScrollArea className="w-full">
        <div className="min-w-max">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="text-left p-2 font-medium sticky left-0 bg-card z-10">Team</th>
                {defenderNames.map((name) => (
                  <th key={name} className="p-2 font-medium text-center min-w-[100px]">
                    <div className="flex flex-col items-center gap-1">
                      <PokemonAvatar name={name} />
                      <span className="truncate max-w-[90px]">{name}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix!.map((row, rowIdx) => {
                const attackerName = row[0]?.attackerName ?? `Slot ${rowIdx + 1}`
                return (
                  <tr key={rowIdx} className="border-t">
                    <td className="p-2 font-medium sticky left-0 bg-card z-10">
                      <div className="flex items-center gap-2">
                        <PokemonAvatar name={attackerName} />
                        <span className="truncate max-w-[90px]">{attackerName}</span>
                      </div>
                    </td>
                    {row.map((entry, colIdx) => (
                      <td key={colIdx} className="p-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className={cn(
                                "rounded-md p-2 text-center cursor-default transition-colors",
                                getDamageColor(entry.maxPercent),
                              )}
                            >
                              <div className="font-mono font-semibold">
                                {entry.maxPercent > 0 ? `${entry.maxPercent}%` : "--"}
                              </div>
                              <div className="text-[10px] truncate opacity-80">
                                {entry.bestMove}
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-xs space-y-0.5">
                              <p className="font-medium">
                                {entry.attackerName} vs {entry.defenderName}
                              </p>
                              <p>Best move: {entry.bestMove}</p>
                              <p>Max damage: {entry.maxPercent}%</p>
                              <p>{entry.koChance}</p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </AnalysisCard>
  )
}
