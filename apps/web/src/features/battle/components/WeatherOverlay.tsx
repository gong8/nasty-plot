"use client";

import type { FieldState } from "@nasty-plot/battle-engine";
import { cn } from "@/lib/utils";

interface WeatherOverlayProps {
  field: FieldState;
  className?: string;
}

const WEATHER_STYLES: Record<string, string> = {
  Sun: "bg-gradient-to-b from-yellow-300/20 via-orange-200/10 to-transparent",
  Rain: "bg-gradient-to-b from-blue-400/20 via-blue-300/10 to-transparent",
  Sand: "bg-gradient-to-b from-yellow-600/15 via-yellow-500/10 to-transparent",
  Snow: "bg-gradient-to-b from-cyan-200/20 via-white/10 to-transparent",
  "Desolate Land": "bg-gradient-to-b from-red-500/25 via-orange-400/15 to-transparent",
  "Primordial Sea": "bg-gradient-to-b from-blue-600/25 via-blue-500/15 to-transparent",
  "Delta Stream": "bg-gradient-to-b from-emerald-400/20 via-cyan-300/10 to-transparent",
};

const TERRAIN_STYLES: Record<string, string> = {
  Electric: "bg-gradient-to-t from-yellow-400/15 via-yellow-300/5 to-transparent",
  Grassy: "bg-gradient-to-t from-green-500/20 via-green-400/10 to-transparent",
  Misty: "bg-gradient-to-t from-pink-300/15 via-pink-200/5 to-transparent",
  Psychic: "bg-gradient-to-t from-purple-400/15 via-purple-300/5 to-transparent",
};

export function WeatherOverlay({ field, className }: WeatherOverlayProps) {
  const weatherStyle = field.weather ? WEATHER_STYLES[field.weather] : "";
  const terrainStyle = field.terrain ? TERRAIN_STYLES[field.terrain] : "";

  if (!weatherStyle && !terrainStyle) return null;

  return (
    <>
      {weatherStyle && (
        <div className={cn(
          "absolute inset-0 pointer-events-none transition-opacity duration-1000 z-10",
          weatherStyle,
          className
        )} />
      )}
      {terrainStyle && (
        <div className={cn(
          "absolute inset-0 pointer-events-none transition-opacity duration-1000 z-10",
          terrainStyle,
          className
        )} />
      )}
    </>
  );
}
