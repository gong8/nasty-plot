"use client";

import { Shield, Flame, Bug, Wind, Snowflake } from "lucide-react";
import type { SideConditions } from "@nasty-plot/battle-engine";
import { cn } from "@/lib/utils";

interface SideConditionIndicatorsProps {
  conditions: SideConditions;
  side: "player" | "opponent";
  className?: string;
}

export function SideConditionIndicators({ conditions, side, className }: SideConditionIndicatorsProps) {
  const indicators: { icon: React.ReactNode; label: string; color: string }[] = [];

  if (conditions.stealthRock) {
    indicators.push({ icon: <Flame className="h-3 w-3" />, label: "SR", color: "text-amber-600 dark:text-amber-400" });
  }
  if (conditions.spikes > 0) {
    indicators.push({ icon: <Bug className="h-3 w-3" />, label: `Spk\u00d7${conditions.spikes}`, color: "text-amber-600 dark:text-amber-400" });
  }
  if (conditions.toxicSpikes > 0) {
    indicators.push({ icon: <Bug className="h-3 w-3" />, label: `TSpk\u00d7${conditions.toxicSpikes}`, color: "text-purple-600 dark:text-purple-400" });
  }
  if (conditions.stickyWeb) {
    indicators.push({ icon: <Bug className="h-3 w-3" />, label: "Web", color: "text-amber-600 dark:text-amber-400" });
  }
  if (conditions.reflect > 0) {
    indicators.push({ icon: <Shield className="h-3 w-3" />, label: `Ref(${conditions.reflect})`, color: "text-blue-500 dark:text-blue-400" });
  }
  if (conditions.lightScreen > 0) {
    indicators.push({ icon: <Shield className="h-3 w-3" />, label: `LS(${conditions.lightScreen})`, color: "text-yellow-500 dark:text-yellow-400" });
  }
  if (conditions.auroraVeil > 0) {
    indicators.push({ icon: <Snowflake className="h-3 w-3" />, label: `AV(${conditions.auroraVeil})`, color: "text-cyan-500 dark:text-cyan-400" });
  }
  if (conditions.tailwind > 0) {
    indicators.push({ icon: <Wind className="h-3 w-3" />, label: `TW(${conditions.tailwind})`, color: "text-teal-500 dark:text-teal-400" });
  }

  if (indicators.length === 0) return null;

  return (
    <div className={cn(
      "flex flex-wrap gap-1",
      side === "player" ? "justify-start" : "justify-end",
      className
    )}>
      {indicators.map((ind, i) => (
        <div
          key={i}
          className={cn(
            "flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium",
            "bg-black/10 dark:bg-white/10 backdrop-blur-sm",
            ind.color
          )}
          title={ind.label}
        >
          {ind.icon}
          <span>{ind.label}</span>
        </div>
      ))}
    </div>
  );
}
