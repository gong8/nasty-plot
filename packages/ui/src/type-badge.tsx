"use client";

import { cn } from "./utils";
import { TYPE_COLORS } from "@nasty-plot/core";
import type { PokemonType } from "@nasty-plot/core";

interface TypeBadgeProps {
  type: PokemonType;
  size?: "sm" | "md";
  className?: string;
  onClick?: () => void;
}

export function TypeBadge({ type, size = "md", className, onClick }: TypeBadgeProps) {
  const color = TYPE_COLORS[type];

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold text-white uppercase tracking-wide",
        size === "sm" && "px-2 py-0.5 text-[10px] min-w-[48px]",
        size === "md" && "px-3 py-1 text-xs min-w-[60px]",
        onClick && "cursor-pointer hover:opacity-80 transition-opacity",
        className
      )}
      style={{ backgroundColor: color }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
    >
      {type}
    </span>
  );
}
