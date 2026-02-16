"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ArrowRight, Zap } from "lucide-react"
import { FeatureErrorBoundary } from "@/components/FeatureErrorBoundary"
import { useDamageCalcState } from "../hooks/use-damage-calc"
import { PokemonConfigPanel, CalcMoveSelector } from "./PokemonConfigPanel"
import { FieldConfig } from "./FieldConfig"
import { DamageResults } from "./DamageResults"

export function DamageCalculator() {
  const {
    attacker,
    setAttacker,
    defender,
    setDefender,
    moveName,
    setMoveName,
    weather,
    setWeather,
    terrain,
    setTerrain,
    fieldToggles,
    setFieldToggles,
    result,
    isPending,
    error,
    handleCalculate,
    canCalculate,
  } = useDamageCalcState()

  return (
    <FeatureErrorBoundary>
      <div className="space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Attacker Panel */}
          <PokemonConfigPanel label="Attacker" config={attacker} onChange={setAttacker} />

          {/* Center: Move + Field + Results */}
          <div className="flex flex-col gap-4 lg:w-80">
            {/* Move Selection */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <Zap className="h-4 w-4" />
                  Move
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <CalcMoveSelector
                  value={moveName}
                  pokemonId={attacker.pokemonId}
                  onSelect={setMoveName}
                />

                <Separator />

                <FieldConfig
                  weather={weather}
                  terrain={terrain}
                  toggles={fieldToggles}
                  onWeatherChange={setWeather}
                  onTerrainChange={setTerrain}
                  onToggleChange={setFieldToggles}
                />

                <Button
                  onClick={handleCalculate}
                  disabled={!canCalculate || isPending}
                  className="w-full"
                  size="sm"
                >
                  {isPending ? "Calculating..." : "Calculate"}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>

            {/* Results */}
            <DamageResults result={result} error={error} />
          </div>

          {/* Defender Panel */}
          <PokemonConfigPanel label="Defender" config={defender} onChange={setDefender} />
        </div>
      </div>
    </FeatureErrorBoundary>
  )
}
