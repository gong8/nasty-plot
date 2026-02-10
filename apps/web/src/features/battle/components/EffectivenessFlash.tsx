"use client";

import { cn } from "@/lib/utils";

interface EffectivenessFlashProps {
  text: string | null;
  className?: string;
}

export function EffectivenessFlash({ text, className }: EffectivenessFlashProps) {
  if (!text) return null;

  const color = text.includes("super effective")
    ? "text-green-400"
    : text.includes("Critical")
    ? "text-orange-400"
    : "text-white";

  return (
    <div className={cn(
      "absolute inset-0 z-30 flex items-center justify-center pointer-events-none",
      "animate-[battle-effectiveness_1s_ease-out_forwards]",
      className
    )}>
      <span className={cn(
        "text-xl font-black tracking-wider drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]",
        color
      )}>
        {text}
      </span>
    </div>
  );
}
