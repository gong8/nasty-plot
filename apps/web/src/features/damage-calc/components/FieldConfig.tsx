"use client"

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { WEATHERS, TERRAINS, type WeatherName, type TerrainName } from "@nasty-plot/core"

export interface FieldToggles {
  isReflect: boolean
  isLightScreen: boolean
  isAuroraVeil: boolean
  isCritical: boolean
  isDoubles: boolean
}

const TOGGLE_LABELS = [
  ["isReflect", "Reflect"],
  ["isLightScreen", "Light Screen"],
  ["isAuroraVeil", "Aurora Veil"],
  ["isCritical", "Critical Hit"],
  ["isDoubles", "Doubles"],
] as const

interface FieldConfigProps {
  weather: WeatherName
  terrain: TerrainName
  toggles: FieldToggles
  onWeatherChange: (weather: WeatherName) => void
  onTerrainChange: (terrain: TerrainName) => void
  onToggleChange: (toggles: FieldToggles) => void
}

export function FieldConfig({
  weather,
  terrain,
  toggles,
  onWeatherChange,
  onTerrainChange,
  onToggleChange,
}: FieldConfigProps) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium">Field Conditions</Label>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[10px]">Weather</Label>
          <Select value={weather} onValueChange={(v) => onWeatherChange(v as WeatherName)}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WEATHERS.map((w) => (
                <SelectItem key={w} value={w} className="text-xs">
                  {w}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-[10px]">Terrain</Label>
          <Select value={terrain} onValueChange={(v) => onTerrainChange(v as TerrainName)}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TERRAINS.map((t) => (
                <SelectItem key={t} value={t} className="text-xs">
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        {TOGGLE_LABELS.map(([key, label]) => (
          <div key={key} className="flex items-center justify-between">
            <Label className="text-[10px]">{label}</Label>
            <Switch
              checked={toggles[key]}
              onCheckedChange={(checked) => onToggleChange({ ...toggles, [key]: checked })}
              className="scale-75"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
