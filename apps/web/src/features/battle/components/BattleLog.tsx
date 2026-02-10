"use client";

import { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { BattleLogEntry, BattleLogType } from "@nasty-plot/battle-engine";

interface BattleLogProps {
  entries: BattleLogEntry[];
  className?: string;
}

const LOG_COLORS: Partial<Record<BattleLogType, string>> = {
  move: "text-foreground",
  damage: "text-red-500",
  heal: "text-green-500",
  status: "text-purple-500",
  boost: "text-blue-500",
  unboost: "text-orange-500",
  switch: "text-cyan-500",
  faint: "text-red-600 dark:text-red-400 font-semibold",
  weather: "text-yellow-600 dark:text-yellow-400",
  terrain: "text-green-600 dark:text-green-400",
  hazard: "text-amber-600 dark:text-amber-400",
  screen: "text-blue-400",
  tera: "text-pink-500 font-semibold",
  win: "text-foreground font-bold text-base",
  turn: "text-muted-foreground font-semibold border-t border-border pt-1 mt-1",
  crit: "text-orange-500 italic",
  supereffective: "text-green-500 italic",
  resisted: "text-muted-foreground italic",
  immune: "text-muted-foreground italic",
  info: "text-muted-foreground",
  item: "text-yellow-500",
  ability: "text-indigo-500 dark:text-indigo-400",
};

export function BattleLog({ entries, className }: BattleLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries.length]);

  return (
    <ScrollArea className={cn("h-full", className)}>
      <div className="p-3 space-y-0.5 text-sm font-mono">
        {entries.length === 0 && (
          <p className="text-muted-foreground italic">Battle log will appear here...</p>
        )}
        {entries.map((entry, i) => (
          <div
            key={i}
            className={cn(
              "leading-relaxed",
              LOG_COLORS[entry.type] || "text-foreground"
            )}
          >
            {entry.message}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
