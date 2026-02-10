"use client";

import { cn } from "@/lib/utils";

interface MoveNameFlashProps {
  moveName: string | null;
  side?: "p1" | "p2";
  className?: string;
}

export function MoveNameFlash({ moveName, side, className }: MoveNameFlashProps) {
  if (!moveName) return null;

  return (
    <div className={cn(
      "absolute z-30 pointer-events-none",
      side === "p1" ? "bottom-[35%] left-[15%]" : "top-[25%] right-[15%]",
      "animate-[battle-move-flash_1.2s_ease-out_forwards]",
      className
    )}>
      <span className="text-lg font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] tracking-wide">
        {moveName}
      </span>
    </div>
  );
}
