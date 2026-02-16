"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { cn } from "@nasty-plot/ui"
import type { DamageCalcResult } from "@nasty-plot/core"

function getKoColor(koChance: string): string {
  if (koChance.includes("OHKO")) return "text-red-600 dark:text-red-400"
  if (koChance.includes("2HKO")) return "text-orange-600 dark:text-orange-400"
  if (koChance.includes("3HKO")) return "text-yellow-600 dark:text-yellow-400"
  if (koChance.includes("4HKO")) return "text-green-600 dark:text-green-400"
  return "text-muted-foreground"
}

interface DamageResultsProps {
  result: DamageCalcResult | undefined
  error: Error | null
}

export function DamageResults({ result, error }: DamageResultsProps) {
  return (
    <>
      {result && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Result</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Damage Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>{result.moveName}</span>
                <span className="font-mono">
                  {result.minPercent}% - {result.maxPercent}%
                </span>
              </div>
              <div className="relative">
                <Progress value={Math.min(result.maxPercent, 100)} className="h-4" />
                <div
                  className="absolute top-0 left-0 h-4 bg-red-500/30 rounded-full"
                  style={{ width: `${Math.min(result.minPercent, 100)}%` }}
                />
              </div>
            </div>

            {/* Damage Values */}
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {result.minDamage} - {result.maxDamage} HP
              </span>
            </div>

            {/* KO Chance */}
            <div
              className={cn("text-sm font-semibold text-center py-1", getKoColor(result.koChance))}
            >
              {result.koChance}
            </div>

            {/* Full Description */}
            <p className="text-[11px] text-muted-foreground leading-relaxed border-t pt-2">
              {result.description}
            </p>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-4">
            <p className="text-sm text-destructive">
              {error instanceof Error ? error.message : "Calculation error"}
            </p>
          </CardContent>
        </Card>
      )}
    </>
  )
}
