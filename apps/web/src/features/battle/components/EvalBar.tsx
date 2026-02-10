"use client";

import { cn } from "@/lib/utils";

interface EvalBarProps {
  p1WinProb: number; // 0-100
  p2WinProb: number; // 0-100
  p1Name?: string;
  p2Name?: string;
  className?: string;
}

export function EvalBar({ p1WinProb, p2WinProb, p1Name = "Player", p2Name = "Opponent", className }: EvalBarProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{p1Name}: {Math.round(p1WinProb)}%</span>
        <span>{p2Name}: {Math.round(p2WinProb)}%</span>
      </div>
      <div className="h-2.5 rounded-full overflow-hidden flex bg-muted">
        <div
          className="bg-blue-500 transition-all duration-700 ease-out"
          style={{ width: `${p1WinProb}%` }}
        />
        <div
          className="bg-red-500 transition-all duration-700 ease-out"
          style={{ width: `${p2WinProb}%` }}
        />
      </div>
    </div>
  );
}
