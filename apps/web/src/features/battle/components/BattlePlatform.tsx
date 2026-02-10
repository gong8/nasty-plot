"use client";

import { cn } from "@/lib/utils";

interface BattlePlatformProps {
  variant: "player" | "opponent";
  className?: string;
}

export function BattlePlatform({ variant, className }: BattlePlatformProps) {
  return (
    <div
      className={cn(
        "absolute rounded-[50%]",
        variant === "player"
          ? "w-48 h-10 bg-gradient-to-r from-green-700/40 via-green-600/50 to-green-700/40 dark:from-green-800/40 dark:via-green-700/50 dark:to-green-800/40"
          : "w-40 h-8 bg-gradient-to-r from-green-700/30 via-green-600/40 to-green-700/30 dark:from-green-800/30 dark:via-green-700/40 dark:to-green-800/30",
        "blur-[1px]",
        className
      )}
    />
  );
}
