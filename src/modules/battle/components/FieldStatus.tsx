"use client";

import { cn } from "@/lib/utils";
import type { FieldState, SideConditions } from "../types";
import {
  Cloud,
  Sun,
  CloudRain,
  Snowflake,
  Zap,
  TreePine,
  Sparkles,
  Brain,
  RotateCcw,
  Shield,
  Wind,
} from "lucide-react";

interface FieldStatusProps {
  field: FieldState;
  p1Conditions: SideConditions;
  p2Conditions: SideConditions;
  className?: string;
}

const WEATHER_ICONS: Record<string, typeof Sun> = {
  Sun: Sun,
  Rain: CloudRain,
  Sand: Cloud,
  Snow: Snowflake,
  "Desolate Land": Sun,
  "Primordial Sea": CloudRain,
  "Delta Stream": Wind,
};

const WEATHER_COLORS: Record<string, string> = {
  Sun: "text-orange-500",
  Rain: "text-blue-500",
  Sand: "text-yellow-700",
  Snow: "text-cyan-400",
  "Desolate Land": "text-red-600",
  "Primordial Sea": "text-blue-700",
  "Delta Stream": "text-green-600",
};

const TERRAIN_ICONS: Record<string, typeof Zap> = {
  Electric: Zap,
  Grassy: TreePine,
  Misty: Sparkles,
  Psychic: Brain,
};

const TERRAIN_COLORS: Record<string, string> = {
  Electric: "text-yellow-500",
  Grassy: "text-green-500",
  Misty: "text-pink-400",
  Psychic: "text-purple-500",
};

function SideHazards({
  conditions,
  label,
  isPlayer,
}: {
  conditions: SideConditions;
  label: string;
  isPlayer: boolean;
}) {
  const hazards: string[] = [];
  if (conditions.stealthRock) hazards.push("Rocks");
  if (conditions.spikes > 0) hazards.push(`Spikes x${conditions.spikes}`);
  if (conditions.toxicSpikes > 0) hazards.push(`T.Spikes x${conditions.toxicSpikes}`);
  if (conditions.stickyWeb) hazards.push("Web");

  const screens: string[] = [];
  if (conditions.reflect > 0) screens.push(`Reflect (${conditions.reflect})`);
  if (conditions.lightScreen > 0) screens.push(`L.Screen (${conditions.lightScreen})`);
  if (conditions.auroraVeil > 0) screens.push(`A.Veil (${conditions.auroraVeil})`);
  if (conditions.tailwind > 0) screens.push(`Tailwind (${conditions.tailwind})`);

  if (hazards.length === 0 && screens.length === 0) return null;

  return (
    <div className="text-xs space-y-0.5">
      {hazards.length > 0 && (
        <div className="flex items-center gap-1 text-red-500">
          <span className="opacity-60">{label}:</span>
          {hazards.map((h) => (
            <span key={h} className="bg-red-500/10 px-1 rounded">{h}</span>
          ))}
        </div>
      )}
      {screens.length > 0 && (
        <div className="flex items-center gap-1 text-blue-500">
          <Shield className="h-3 w-3" />
          {screens.map((s) => (
            <span key={s} className="bg-blue-500/10 px-1 rounded">{s}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export function FieldStatus({ field, p1Conditions, p2Conditions, className }: FieldStatusProps) {
  const hasWeather = field.weather !== "";
  const hasTerrain = field.terrain !== "";
  const hasTrickRoom = field.trickRoom > 0;
  const hasP1Conditions = Object.values(p1Conditions).some((v) => v !== false && v !== 0);
  const hasP2Conditions = Object.values(p2Conditions).some((v) => v !== false && v !== 0);

  if (!hasWeather && !hasTerrain && !hasTrickRoom && !hasP1Conditions && !hasP2Conditions) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-md text-xs", className)}>
      {hasWeather && (() => {
        const Icon = WEATHER_ICONS[field.weather] || Cloud;
        const color = WEATHER_COLORS[field.weather] || "text-muted-foreground";
        return (
          <div className={cn("flex items-center gap-1", color)}>
            <Icon className="h-3.5 w-3.5" />
            <span>{field.weather}</span>
            {field.weatherTurns > 0 && (
              <span className="text-muted-foreground">({field.weatherTurns})</span>
            )}
          </div>
        );
      })()}

      {hasTerrain && (() => {
        const Icon = TERRAIN_ICONS[field.terrain] || Sparkles;
        const color = TERRAIN_COLORS[field.terrain] || "text-muted-foreground";
        return (
          <div className={cn("flex items-center gap-1", color)}>
            <Icon className="h-3.5 w-3.5" />
            <span>{field.terrain} Terrain</span>
            {field.terrainTurns > 0 && (
              <span className="text-muted-foreground">({field.terrainTurns})</span>
            )}
          </div>
        );
      })()}

      {hasTrickRoom && (
        <div className="flex items-center gap-1 text-purple-500">
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Trick Room ({field.trickRoom})</span>
        </div>
      )}

      <SideHazards conditions={p2Conditions} label="Opp" isPlayer={false} />
      <SideHazards conditions={p1Conditions} label="You" isPlayer={true} />
    </div>
  );
}
