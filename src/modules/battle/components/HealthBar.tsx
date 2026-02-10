"use client";

import { cn } from "@/lib/utils";

interface HealthBarProps {
  hp: number;
  maxHp: number;
  className?: string;
  showText?: boolean;
  animate?: boolean;
}

function getHealthColor(percent: number): string {
  if (percent > 50) return "bg-green-500";
  if (percent > 20) return "bg-yellow-500";
  return "bg-red-500";
}

export function HealthBar({ hp, maxHp, className, showText = true, animate = true }: HealthBarProps) {
  const percent = maxHp > 0 ? Math.round((hp / maxHp) * 100) : 0;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden border border-border">
        <div
          className={cn(
            "h-full rounded-full",
            getHealthColor(percent),
            animate && "transition-all duration-500 ease-out"
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      {showText && (
        <span className="text-xs font-mono text-muted-foreground min-w-[72px] text-right">
          {hp}/{maxHp}
        </span>
      )}
    </div>
  );
}
